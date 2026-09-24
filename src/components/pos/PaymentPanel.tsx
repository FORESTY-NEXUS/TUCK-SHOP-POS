"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const METHODS = [
  { key: "cash", label: "Cash" },
  { key: "easypaisa", label: "EasyPaisa" },
  { key: "jazzcash", label: "JazzCash" },
  { key: "card", label: "Card" },
  { key: "bank", label: "Bank Transfer" },
] as const;

export default function PaymentPanel({
  order,
}: {
  order: { _id: string; orderNumber: string; total: number };
}) {
  const router = useRouter();
  const [method, setMethod] = useState<string>("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function confirmPayment() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/orders/${order._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pay: { method, amount: order.total } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Payment failed");
        setSubmitting(false);
        return;
      }
      toast.success("Payment received");
      // Print the receipt; failures must never block the payment flow.
      try {
        await fetch(`/api/orders/${order._id}/print`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "receipt" }),
        });
        toast.success("Receipt printed");
      } catch {
        toast.error("Receipt print failed — check the printer");
      }
      router.push("/pos");
    } catch {
      setError("Cannot reach the server");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen gap-6 bg-stone-100 px-6">
      <div className="text-center">
        <div className="text-sm text-stone-500">Order {order.orderNumber}</div>
        <div className="text-4xl font-bold text-stone-900 mt-1 tabular">Rs. {order.total.toFixed(2)}</div>
      </div>

      <div className="w-full max-w-sm">
        <p className="text-xs text-stone-500 uppercase tracking-wide mb-2 font-medium">Payment Method</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMethod(m.key)}
              className={`py-3.5 rounded-lg font-medium border-2 transition-colors ${
                method === m.key
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-stone-700 border-stone-200 hover:border-brand-400"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <button
        disabled={submitting}
        onClick={confirmPayment}
        className="w-full max-w-sm py-3.5 rounded-lg bg-brand-600 text-white font-semibold disabled:opacity-40 hover:bg-brand-700 transition-colors text-sm"
      >
        {submitting ? "Processing…" : `Pay Rs. ${order.total.toFixed(0)}`}
      </button>

      {error && <p className="text-red-600 text-sm bg-red-50 px-4 py-2 rounded-lg">{error}</p>}
    </div>
  );
}
