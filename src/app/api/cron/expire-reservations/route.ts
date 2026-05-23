import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const expired = await prisma.reservation.findMany({
      where: { status: "PENDING", expiresAt: { lt: now } },
    });

    if (expired.length === 0) {
      return NextResponse.json({ released: 0 });
    }

    const ids = expired.map((r) => r.id);
    await prisma.reservation.updateMany({
      where: { id: { in: ids } },
      data: { status: "RELEASED" },
    });

    return NextResponse.json({ released: expired.length });
  } catch (err) {
    console.error("[CRON expire-reservations]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
