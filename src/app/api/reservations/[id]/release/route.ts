import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }
    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot release a ${reservation.status.toLowerCase()} reservation` },
        { status: 409 }
      );
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: "RELEASED" },
      include: {
        product: { select: { name: true, sku: true } },
        warehouse: { select: { name: true } },
      },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      product: updated.product,
      warehouse: updated.warehouse,
    });
  } catch (err) {
    console.error("[POST /api/reservations/:id/release]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
