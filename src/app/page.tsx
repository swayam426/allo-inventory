"use client";

import { useEffect, useState } from "react";

interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  total: number;
  reserved: number;
  available: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description: string;
  price: string;
  stock: StockEntry[];
}

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<{ product: Product; stock: StockEntry } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState("");

  async function fetchProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      const data = await res.json();
      setProducts(data);
    } catch {
      setError("Could not load products. Please refresh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchProducts(); }, []);

  async function handleReserve() {
    if (!modal) return;
    setReserving(true);
    setReserveError("");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: modal.product.id,
          warehouseId: modal.stock.warehouseId,
          quantity,
        }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setReserveError(`Not enough stock. Only ${data.available} unit(s) available.`);
        return;
      }
      if (!res.ok) {
        setReserveError(data.error || "Reservation failed.");
        return;
      }
      setModal(null);
      window.location.href = `/reservations/${data.id}`;
    } catch {
      setReserveError("Network error. Please try again.");
    } finally {
      setReserving(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="text-gray-400 animate-pulse">Loading products...</div>
    </div>
  );

  if (error) return (
    <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-1">Products</h1>
        <p className="text-gray-400 text-sm">Select a product and warehouse to reserve inventory.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-3 hover:border-gray-700 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-semibold text-white text-sm leading-snug">{product.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">{product.sku}</p>
              </div>
              <span className="text-cyan-400 font-bold text-sm whitespace-nowrap">₹{parseFloat(product.price).toLocaleString("en-IN")}</span>
            </div>

            {product.description && (
              <p className="text-xs text-gray-400 leading-relaxed">{product.description}</p>
            )}

            <div className="space-y-2 mt-1">
              {product.stock.map((s) => (
                <div key={s.warehouseId} className="bg-gray-800/60 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-xs font-medium text-gray-200">{s.warehouseName}</p>
                      <p className="text-xs text-gray-500">{s.warehouseLocation}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      s.available === 0 ? "bg-red-900/50 text-red-400" :
                      s.available <= 2 ? "bg-yellow-900/50 text-yellow-400" :
                      "bg-green-900/50 text-green-400"
                    }`}>
                      {s.available} avail
                    </span>
                  </div>
                  <button
                    onClick={() => { setModal({ product, stock: s }); setQuantity(1); setReserveError(""); }}
                    disabled={s.available === 0}
                    className="w-full text-xs bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium py-1.5 rounded-md transition-colors"
                  >
                    {s.available === 0 ? "Out of stock" : "Reserve"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Reserve Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="font-bold text-white mb-1">Reserve Units</h2>
            <p className="text-gray-400 text-sm mb-4">{modal.product.name} — {modal.stock.warehouseName}</p>

            <div className="bg-gray-800 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between text-gray-300 mb-1">
                <span>Available stock</span>
                <span className="font-mono text-green-400">{modal.stock.available}</span>
              </div>
              <div className="flex justify-between text-gray-300">
                <span>Unit price</span>
                <span className="font-mono text-cyan-400">₹{parseFloat(modal.product.price).toLocaleString("en-IN")}</span>
              </div>
            </div>

            <label className="block text-sm text-gray-300 mb-1">Quantity</label>
            <input
              type="number"
              min={1}
              max={modal.stock.available}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(modal.stock.available, parseInt(e.target.value) || 1)))}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm mb-4 focus:outline-none focus:border-cyan-500"
            />

            {reserveError && (
              <div className="bg-red-900/40 border border-red-700 text-red-300 text-xs rounded-lg p-2 mb-3">
                {reserveError}
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleReserve}
                disabled={reserving}
                className="flex-1 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {reserving ? "Reserving..." : `Reserve ${quantity} unit${quantity > 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
