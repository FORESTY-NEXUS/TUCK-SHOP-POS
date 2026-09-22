"use client";

import { useState } from "react";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type DeliveryReadyPopupProps = {
  order: {
    _id: string;
    orderNumber: string;
    type: "delivery";
    items?: Array<{ name: string; price: number; qty: number; lineDiscountPercent?: number; note?: string }>;
    deliveryAddress?: string;
    customer?: { name?: string; phone?: string };
    note?: string;
    total: number;
  } | null;
  onClose: () => void;
};

export default function DeliveryReadyPopup({ order, onClose }: DeliveryReadyPopupProps) {
  const ord = order!;
  // Guard against null order (can occur from async state race between dialog open and state update)
  if (!ord) return null;

  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ success: boolean; error?: string } | null>(null);

  async function printReceipt() {
    if (printing) return;
    setPrinting(true);
    setPrintResult(null);
    try {
      const res = await fetch(`/api/orders/${ord._id}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "receipt" }),
      });
      const data = await res.json().catch(() => ({}));
      const ok = res.ok && data.success;
      setPrintResult({ success: ok, error: ok ? undefined : (data.error || "Print failed") });
      if (ok) toast.success("Receipt printed");
      else toast.error("Print failed", { description: data.error || "Check printer connection" });
    } catch {
      setPrintResult({ success: false, error: "Cannot reach the server" });
      toast.error("Print failed", { description: "Cannot reach the server" });
    } finally {
      setPrinting(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          Ready for Dispatch
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-3 py-1">
        <div className="flex items-start gap-3 p-3 bg-stone-50 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-brand-700">
              {(ord.customer?.name || "G").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-stone-900 text-sm">{ord.customer?.name || "Guest"}</p>
            <p className="text-xs text-stone-500">{ord.customer?.phone}</p>
          </div>
        </div>

        <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
          <p className="text-xs text-stone-500 uppercase tracking-wide mb-0.5">Delivery Address</p>
          <p className="text-sm text-stone-900">{ord.deliveryAddress || "No address provided"}</p>
        </div>

        {(ord.items || []).length > 0 && (
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wide mb-2 font-medium">Items</p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {(ord.items || []).map((item, idx) => (
                <div key={idx} className="flex items-start justify-between p-2 bg-white border border-stone-200 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-900 text-sm truncate">
                      {item.qty > 1 ? <span className="text-brand-700">{item.qty}× </span> : null}
                      {item.name}
                    </p>
                    {item.note && <p className="text-xs text-amber-700 mt-0.5">Note: {item.note}</p>}
                  </div>
                  <p className="text-sm font-semibold text-stone-900 ml-3 whitespace-nowrap tabular">
                    Rs. {(item.price * item.qty * (1 - (item.lineDiscountPercent || 0) / 100)).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {ord.note && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-stone-500 uppercase tracking-wide mb-0.5">Order Note</p>
            <p className="text-sm text-stone-900">{ord.note}</p>
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-stone-200">
          <span className="text-sm text-stone-600">Total</span>
          <span className="text-xl font-bold text-brand-700 tabular">Rs. {ord.total.toFixed(2)}</span>
        </div>

        {printResult && (
          <div className={`p-2.5 rounded-lg text-sm flex items-center gap-2 ${
            printResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            <span>{printResult.success ? "Receipt printed" : `Print failed: ${printResult.error || "Unknown"}`}</span>
          </div>
        )}
      </div>

      <DialogFooter>
        <button onClick={onClose} disabled={printing} className="btn-secondary flex-1">Close</button>
        <button onClick={printReceipt} disabled={printing} className="btn-primary flex-1">
          {printing ? "Printing…" : "Print Receipt"}
        </button>
      </DialogFooter>
    </>
  );
}
