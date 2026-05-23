import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const idempotencyKey = req.headers.get("idempotency-key");

    if (idempotencyKey) {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: `POST:reservations:${id}:confirm:${idempotencyKey}` },
      });
      if (existing) {
        return NextResponse.json(JSON.parse(existing.body), { status: existing.statusCode });
      }
    }

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (reservation.status === "CONFIRMED") {
      return NextResponse.json({ error: "Already confirmed" }, { status: 409 });
    }
    if (reservation.status === "RELEASED") {
      return NextResponse.json({ error: "Reservation was released" }, { status: 410 });
    }
    if (reservation.expiresAt < new Date()) {
      // Mark as released on the way out
      await prisma.reservation.update({ where: { id }, data: { status: "RELEASED" } });
      return NextResponse.json({ error: "Reservation has expired" }, { status: 410 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const confirmed = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: {
          product: { select: { name: true, sku: true } },
          warehouse: { select: { name: true } },
        },
      });

      // Permanently decrement total stock
      await tx.stock.updateMany({
        where: { productId: reservation.productId, warehouseId: reservation.warehouseId },
        data: { total: { decrement: reservation.quantity } },
      });

      return confirmed;
    });

    const responseBody = {
      id: updated.id,
      status: updated.status,
      quantity: updated.quantity,
      product: updated.product,
      warehouse: updated.warehouse,
    };

    if (idempotencyKey) {
      await prisma.idempotencyRecord.create({
        data: {
          key: `POST:reservations:${id}:confirm:${idempotencyKey}`,
          statusCode: 200,
          body: JSON.stringify(responseBody),
        },
      }).catch(() => {});
    }

    return NextResponse.json(responseBody);
  } catch (err) {
    console.error("[POST /api/reservations/:id/confirm]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
