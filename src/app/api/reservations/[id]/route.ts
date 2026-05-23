import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, sku: true, price: true } },
        warehouse: { select: { name: true, location: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: reservation.id,
      status: reservation.status,
      expiresAt: reservation.expiresAt,
      quantity: reservation.quantity,
      product: { ...reservation.product, price: reservation.product.price.toString() },
      warehouse: reservation.warehouse,
      createdAt: reservation.createdAt,
    });
  } catch (err) {
    console.error("[GET /api/reservations/:id]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
