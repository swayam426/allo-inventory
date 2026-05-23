import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateReservationSchema } from "@/lib/schemas";
import { getExpiresAt, stockIdToLockKey } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get("idempotency-key");

    // Idempotency check
    if (idempotencyKey) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: `POST:reservations:${idempotencyKey}` },
      });
      if (existing) {
        return NextResponse.json(JSON.parse(existing.body), { status: existing.statusCode });
      }
    }

    const body = await req.json();
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 });
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // Find the stock row first
    const stockRow = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stockRow) {
      return NextResponse.json({ error: "Product or warehouse not found" }, { status: 404 });
    }

    const lockKey = stockIdToLockKey(stockRow.id);

    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        // Acquire advisory lock — ensures serial access for this stock row
        await tx.$queryRawUnsafe(`SELECT pg_advisory_xact_lock(${lockKey})::text`);
        const now = new Date();

        // Compute active reservations inside the lock
        const activeReserved = await tx.reservation.aggregate({
          _sum: { quantity: true },
          where: {
            productId,
            warehouseId,
            status: "PENDING",
            expiresAt: { gt: now },
          },
        });

        const reserved = activeReserved._sum.quantity ?? 0;
        const available = Math.max(0, stockRow.total - reserved);

        if (available < quantity) {
          const err = new Error("INSUFFICIENT_STOCK");
          (err as Error & { available: number }).available = available;
          throw err;
        }

        return tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            expiresAt: getExpiresAt(),
            idempotencyKey: idempotencyKey ?? undefined,
          },
          include: {
            product: { select: { name: true, sku: true, price: true } },
            warehouse: { select: { name: true, location: true } },
          },
        });
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "INSUFFICIENT_STOCK") {
        const available = (err as Error & { available?: number }).available ?? 0;
        const responseBody = { error: "Insufficient stock", available, requested: quantity };
        if (idempotencyKey) {
          await prisma.idempotencyRecord.create({
            data: {
              key: `POST:reservations:${idempotencyKey}`,
              statusCode: 409,
              body: JSON.stringify(responseBody),
            },
          }).catch(() => {});
        }
        return NextResponse.json(responseBody, { status: 409 });
      }
      throw err;
    }

    const responseBody = {
      id: reservation.id,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      quantity: reservation.quantity,
      product: {
        name: reservation.product.name,
        sku: reservation.product.sku,
        price: reservation.product.price.toString(),
      },
      warehouse: reservation.warehouse,
    };

    if (idempotencyKey) {
      await prisma.idempotencyRecord.create({
        data: {
          key: `POST:reservations:${idempotencyKey}`,
          statusCode: 201,
          body: JSON.stringify(responseBody),
        },
      }).catch(() => {});
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch (err) {
    console.error("[POST /api/reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
