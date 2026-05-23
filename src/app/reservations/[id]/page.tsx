"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface Reservation {
  id: string;
  status: "PENDING" | "CONFIRMED" | "RELEASED";
  expiresAt: string;
  quantity: number;
  product: { name: string; sku: string; price: string };
  warehouse: { name: string; location: string };
  createdAt: string;
}

function useCountdown(expiresAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return secondsLeft;
}

export default function ReservationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionLoading, setActionLoading] = useState<"confirm" | "release" | null>(null);

  const secondsLeft = useCountdown(reservation?.expiresAt ?? null);
  const isExpired = reservation?.status === "PENDING" && secondsLeft === 0;

  const fetchReservation = useCallback(async () => {
    try {
      const res = await fetch(`/api/reservations/${id}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setReservation(data);
    } catch {
      setError("Could not load reservation.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchReservation(); }, [fetchReservation]);

  async function handleConfirm() {
    setActionLoading("confirm");
    setActionError("");
    try {
      const res = await fetch(`/api/reservations/${id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (res.status === 410) {
        setActionError("This reservation has expired and can no longer be confirmed.");
        await fetchReservation();
        return;
      }
      if (!res.ok) {
        setActionError(data.error || "Confirmation failed.");
        return;
      }
      await fetchReservation();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRelease() {
    setActionLoading("release");
    setActionError("");
    try {
      const res = await fetch(`/api/reservations/${id}/release`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || "Release failed.");
        return;
      }
      await fetchReservation();
    } catch {
      setActionError("Network error. Please try again.");
    } finally {
      setActionLoading(null);
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-400 animate-pulse">Loading reservation...</div>
    </div>
  );

  if (error) return (
    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>
  );

  if (!reservation) return null;

  const statusColors = {
    PENDING: "bg-yellow-900/40 text-yellow-300 border-yellow-700",
    CONFIRMED: "bg-green-900/40 text-green-300 border-green-700",
    RELEASED: "bg-gray-800 text-gray-400 border-gray-700",
  };

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={() => router.push("/")} className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors">
        ← Back to products
      </button>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-bold text-white text-lg">Reservation</h1>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{reservation.id}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusColors[reservation.status]}`}>
            {reservation.status}
          </span>
        </div>

        <div className="border-t border-gray-800 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Product</span>
            <span className="text-white font-medium text-right max-w-xs">{reservation.product.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">SKU</span>
            <span className="text-gray-300 font-mono">{reservation.product.sku}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Warehouse</span>
            <span className="text-gray-300">{reservation.warehouse.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Quantity</span>
            <span className="text-white font-semibold">{reservation.quantity}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total</span>
            <span className="text-cyan-400 font-bold">
              ₹{(parseFloat(reservation.product.price) * reservation.quantity).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* Countdown */}
        {reservation.status === "PENDING" && (
          <div className={`rounded-xl p-4 text-center border ${isExpired ? "bg-red-900/30 border-red-800" : secondsLeft < 60 ? "bg-orange-900/30 border-orange-800" : "bg-gray-800/60 border-gray-700"}`}>
            {isExpired ? (
              <div>
                <p className="text-red-400 font-bold text-lg">Reservation Expired</p>
                <p className="text-red-300/70 text-xs mt-1">This hold has been released. The units are available again.</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-400 text-xs mb-1">Time remaining to confirm</p>
                <p className={`text-3xl font-mono font-bold ${secondsLeft < 60 ? "text-orange-400" : "text-white"}`}>
                  {formatTime(secondsLeft)}
                </p>
                <p className="text-gray-500 text-xs mt-1">Expires at {new Date(reservation.expiresAt).toLocaleTimeString()}</p>
              </div>
            )}
          </div>
        )}

        {reservation.status === "CONFIRMED" && (
          <div className="bg-green-900/30 border border-green-800 rounded-xl p-4 text-center">
            <p className="text-green-400 font-bold">Purchase Confirmed!</p>
            <p className="text-green-300/70 text-xs mt-1">Your order has been placed successfully.</p>
          </div>
        )}

        {reservation.status === "RELEASED" && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-center">
            <p className="text-gray-400 font-medium">Reservation Released</p>
            <p className="text-gray-500 text-xs mt-1">The held units have been returned to available stock.</p>
          </div>
        )}

        {actionError && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-lg p-3">
            {actionError}
          </div>
        )}

        {reservation.status === "PENDING" && !isExpired && (
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleRelease}
              disabled={actionLoading !== null}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {actionLoading === "release" ? "Cancelling..." : "Cancel"}
            </button>
            <button
              onClick={handleConfirm}
              disabled={actionLoading !== null}
              className="flex-1 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
            >
              {actionLoading === "confirm" ? "Confirming..." : "Confirm Purchase"}
            </button>
          </div>
        )}

        {(reservation.status !== "PENDING" || isExpired) && (
          <button
            onClick={() => router.push("/")}
            className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-colors"
          >
            Browse Products
          </button>
        )}
      </div>
    </div>
  );
}
