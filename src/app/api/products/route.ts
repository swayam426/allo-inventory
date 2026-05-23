import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const now = new Date();

    const products = await prisma.product.findMany({
      include: {
        stock: {
          include: { warehouse: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // For each stock row, compute available = total - reserved (pending & not expired)
    const result = await Promise.all(
      products.map(async (product) => {
        const stockWithAvailable = await Promise.all(
          product.stock.map(async (s) => {
            const activeReserved = await prisma.reservation.aggregate({
              _sum: { quantity: true },
              where: {
                productId: product.id,
                warehouseId: s.warehouseId,
                status: "PENDING",
                expiresAt: { gt: now },
              },
            });
            const reserved = activeReserved._sum.quantity ?? 0;
            const available = Math.max(0, s.total - reserved);
            return {
              warehouseId: s.warehouseId,
              warehouseName: s.warehouse.name,
              warehouseLocation: s.warehouse.location,
              total: s.total,
              reserved,
              available,
            };
          })
        );

        return {
          id: product.id,
          name: product.name,
          sku: product.sku,
          description: product.description,
          price: product.price.toString(),
          stock: stockWithAvailable,
        };
      })
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/products]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
