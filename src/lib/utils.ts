import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getAvailableStock(total: number, reserved: number): number {
  return Math.max(0, total - reserved);
}

export function getTTLMinutes(): number {
  return parseInt(process.env.RESERVATION_TTL_MINUTES || "10", 10);
}

export function getExpiresAt(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + getTTLMinutes());
  return d;
}

// Derive a stable bigint from a stock ID string for pg_advisory_xact_lock
export function stockIdToLockKey(stockId: string): bigint {
  let hash = 0n;
  for (let i = 0; i < stockId.length; i++) {
    hash = (hash * 31n + BigInt(stockId.charCodeAt(i))) & 0x7fffffffffffffffn;
  }
  return hash;
}
