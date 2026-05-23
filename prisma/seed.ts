import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();

  const wh1 = await prisma.warehouse.create({
    data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
  });
  const wh2 = await prisma.warehouse.create({
    data: { name: "Bangalore Hub", location: "Bangalore, Karnataka" },
  });

  const p1 = await prisma.product.create({
    data: {
      name: "Wireless Noise-Cancelling Headphones",
      sku: "WNC-001",
      description: "Premium over-ear headphones with 30hr battery life and active noise cancellation.",
      price: 4999.0,
    },
  });

  const p2 = await prisma.product.create({
    data: {
      name: "Mechanical Keyboard",
      sku: "MKB-002",
      description: "TKL layout, hot-swappable switches, RGB backlight.",
      price: 3499.0,
    },
  });

  const p3 = await prisma.product.create({
    data: {
      name: "USB-C Hub 7-in-1",
      sku: "HUB-003",
      description: "4K HDMI, 3x USB-A, SD card reader, 100W PD pass-through.",
      price: 1299.0,
    },
  });

  await prisma.stock.createMany({
    data: [
      { productId: p1.id, warehouseId: wh1.id, total: 10, reserved: 0 },
      { productId: p1.id, warehouseId: wh2.id, total: 5, reserved: 0 },
      { productId: p2.id, warehouseId: wh1.id, total: 8, reserved: 0 },
      { productId: p2.id, warehouseId: wh2.id, total: 3, reserved: 0 },
      { productId: p3.id, warehouseId: wh1.id, total: 20, reserved: 0 },
      { productId: p3.id, warehouseId: wh2.id, total: 1, reserved: 0 },
    ],
  });

  console.log("Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
