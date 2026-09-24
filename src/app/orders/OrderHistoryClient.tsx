"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import { toast } from "sonner";

type RangeKey = "all" | "today" | "yesterday" | "this_week" | "this_month" | "custom";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", easypaisa: "EasyPaisa", jazzcash: "JazzCash", card: "Card",
  bank_transfer: "Bank Transfer", mobile_wallet: "Mobile Wallet", credit: "Credit / Udhaar", other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  returned: "Returned",
  partially_returned: "Partially Returned",
  voided: "Voided",
};

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  returned: "bg-red-100 text-red-700",
  partially_returned: "bg-red-50 text-red-600",
  voided: "bg-stone-200 text-stone-600",
};

export default function OrderHistoryClient({ initialData }: { initialData: any }) {
  const [range, setRange] = useState<RangeKey>((initialData?.rangeUsed as RangeKey) || "all");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<any>(initialData);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);
  // Out-of-order response guard for rapid filter/pagination changes.
  const reqId = useRef(0);

  const load = useCallback(async (page: number, overrides?: Partial<{ range: RangeKey; payment: string; status: string; search: string; customStart: string; customEnd: string }>) => {
    setLoading(true);
    const id = ++reqId.current;
    const o = overrides || {};
    const r = o.range ?? range;
    const pm = o.payment ?? payment;
    const st = o.status ?? status;
    const q = o.search ?? search;
    const cs = o.customStart ?? customStart;
    const ce = o.customEnd ?? customEnd;
    try {
      const qs = new URLSearchParams({ page: String(page), range: r, payment: pm, status: st });
      if (q.trim()) qs.set("search", q.trim());
      if (r === "custom") {
        if (cs) qs.set("start", cs);
        if (ce) qs.set("end", ce);
      }
      const res = await fetch(`/api/sales/history?${qs.toString()}`);
      if (res.ok && id === reqId.current) setData(await res.json());
    } catch {
      /* keep last */
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, payment, status, search, customStart, customEnd]);

  useEffect(() => {
    // Initial server data shows instantly; refetch client-side afterwards.
  }, []);

  function changeRange(r: RangeKey) {
    setRange(r);
    setExpandedId(null);
    load(1, { range: r });
  }

  function changePayment(p: string) {
    setPayment(p);
    setExpandedId(null);
    load(1, { payment: p });
  }

  function changeStatus(s: string) {
    setStatus(s);
    setExpandedId(null);
    load(1, { status: s });
  }

  function doSearch() {
    setExpandedId(null);
    load(1, { search });
  }

  function toggleExpand(orderId: string) {
    setExpandedId((cur) => (cur === orderId ? null : orderId));
    setReturnQtys({});
  }

  async function processReturn(order: any, action: "return" | "void") {
    if (processingId) return;
    if (action === "void" && !window.confirm(`Void sale ${order.saleNumber} entirely? This restocks every item and refunds the full amount.`)) {
      return;
    }
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));
    if (action === "return" && items.length === 0) {
      toast.error("Set a return quantity for at least one item");
      return;
    }
    setProcessingId(order._id);
    try {
      const res = await fetch(`/api/sales/${order._id}/return`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, items }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(result.error || "Couldn't process that");
        return;
      }
      toast.success(action === "void" ? "Sale voided, stock restored" : `Returned — Rs. ${Number(result.refundAmount).toFixed(2)} refunded`);
      setReturnQtys({});
      setExpandedId(null);
      load(page);
    } catch {
      toast.error("Something went wrong — try again");
    } finally {
      setProcessingId(null);
    }
  }

  const orders = data?.orders || [];
  const totalCount = data?.totalCount || 0;
  const page = data?.page || 1;
  const totalPages = data?.totalPages || 1;
  const pageSize = data?.pageSize || 50;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  return (
    <div className="px-6 py-8 w-full">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900 font-brand">Order History</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {totalCount} order{totalCount !== 1 ? "s" : ""} · full read-only log
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex rounded-lg border border-stone-300 overflow-hidden bg-white">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => changeRange(p.key)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  range === p.key ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {range === "custom" && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input w-40" />
              <span className="text-stone-400">→</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input w-40" />
              <button onClick={() => load(1)} className="btn-primary text-xs">Apply</button>
            </div>
          )}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              placeholder="Search sale #…"
              className="input pl-10"
            />
          </div>
          <select value={payment} onChange={(e) => changePayment(e.target.value)} className="input w-auto">
            <option value="all">All Payment Methods</option>
            {Object.entries(METHOD_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => changeStatus(e.target.value)} className="input w-auto">
            <option value="all">All Status</option>
            {Object.entries(STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </select>
          {loading && <span className="text-xs text-stone-400">Updating…</span>}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-xs text-stone-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">Sale #</th>
                <th className="text-left px-4 py-3 font-medium">Customer</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Payment</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-center px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {orders.map((o: any) => (
                <Fragment key={o._id}>
                  <tr className="hover:bg-stone-50 cursor-pointer" onClick={() => toggleExpand(o._id)}>
                    <td className="px-4 py-3 font-medium text-brand-700 tabular">{o.saleNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-stone-900">{o.customer?.name || o.customer?.phone || "Guest"}</div>
                      {o.customer?.phone && o.customer?.name && <div className="text-xs text-stone-400">{o.customer.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-stone-500 tabular">
                      {new Date(o.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-stone-600">{o.isPaid ? (METHOD_LABELS[o.paymentMethod] || o.paymentMethod || "—") : "Unpaid"}</td>
                    <td className="px-4 py-3 text-right font-medium tabular">Rs. {Number(o.total).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[o.status] || "bg-stone-100 text-stone-600"}`}>
                        {STATUS_LABELS[o.status] || o.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ChevronDown className={`w-4 h-4 inline text-stone-400 transition-transform ${expandedId === o._id ? "rotate-180" : ""}`} />
                    </td>
                  </tr>
                  {expandedId === o._id && (
                    <tr key={`${o._id}-detail`} className="bg-stone-50">
                      <td colSpan={7} className="px-4 py-4">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Items</h4>
                            <div className="space-y-1.5">
                              {(o.items || []).map((item: any, i: number) => (
                                <div key={i} className="flex items-center justify-between text-sm bg-white border border-stone-200 rounded-lg px-3 py-2">
                                  <span className="text-stone-900">
                                    {item.qty > 1 ? `${item.qty}× ` : ""}{item.name}
                                    {(item.lineDiscount ?? 0) > 0 && <span className="text-green-700 ml-1">(−Rs. {Number(item.lineDiscount).toFixed(2)})</span>}
                                  </span>
                                  <span className="font-medium tabular">Rs. {(Number(item.sellingPrice) * Number(item.qty) - (item.lineDiscount || 0)).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            {o.note && <p className="text-xs text-stone-500 mt-3">Note: {o.note}</p>}
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Details</h4>
                            <div className="space-y-1.5 text-sm bg-white border border-stone-200 rounded-lg px-3 py-2.5">
                              <div className="flex justify-between"><span className="text-stone-500">Subtotal</span><span className="tabular">Rs. {Number(o.subtotal).toFixed(2)}</span></div>
                              {(o.discountAmount ?? 0) > 0 && (
                                <div className="flex justify-between"><span className="text-stone-500">Discount ({o.discountPercent}%)</span><span className="tabular">− Rs. {Number(o.discountAmount).toFixed(2)}</span></div>
                              )}
                              <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular">Rs. {Number(o.total).toFixed(2)}</span></div>
                              {o.isPaid && <div className="flex justify-between"><span className="text-stone-500">Paid</span><span className="tabular">Rs. {Number(o.amountReceived ?? o.total).toFixed(2)}</span></div>}
                              {o.paymentMethod === "cash" && (o.change ?? 0) > 0 && (
                                <div className="flex justify-between"><span className="text-stone-500">Change</span><span className="tabular">Rs. {Number(o.change).toFixed(2)}</span></div>
                              )}
                              {(o.returnedAmount ?? 0) > 0 && (
                                <div className="flex justify-between text-red-600"><span>Returned</span><span className="tabular">Rs. {Number(o.returnedAmount).toFixed(2)}</span></div>
                              )}
                              {o.paymentMethod === "credit" && o.customer?.creditBalance != null && (
                                <div className="flex justify-between"><span className="text-stone-500">Customer Balance</span><span className="tabular">Rs. {Number(o.customer.creditBalance).toFixed(2)}</span></div>
                              )}
                              <div className="flex justify-between"><span className="text-stone-500">Cashier</span><span>{o.cashier?.name || "—"}</span></div>
                            </div>
                          </div>
                        </div>

                        {(o.status === "completed" || o.status === "partially_returned") && (
                          <div className="mt-4 pt-4 border-t border-stone-200">
                            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Return / Void</h4>
                            <div className="space-y-1.5">
                              {(o.items || []).map((item: any) => {
                                const left = item.qty - (item.qtyReturned || 0);
                                if (left <= 0) return null;
                                return (
                                  <div key={item._id} className="flex items-center justify-between text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 gap-3">
                                    <span className="text-stone-700">{item.name} <span className="text-stone-400">({left} sold, returnable)</span></span>
                                    <input
                                      type="number"
                                      min={0}
                                      max={left}
                                      value={returnQtys[item._id] || ""}
                                      onChange={(e) => {
                                        const v = Math.max(0, Math.min(left, Number(e.target.value) || 0));
                                        setReturnQtys((cur) => ({ ...cur, [item._id]: v }));
                                      }}
                                      placeholder="0"
                                      className="input w-20 text-right"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <button
                                type="button"
                                disabled={processingId === o._id}
                                onClick={() => processReturn(o, "return")}
                                className="btn-secondary text-xs disabled:opacity-50"
                              >
                                {processingId === o._id ? "Processing…" : "Process Return"}
                              </button>
                              <button
                                type="button"
                                disabled={processingId === o._id}
                                onClick={() => processReturn(o, "void")}
                                className="text-xs px-3 py-1.5 rounded-lg font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Void Entire Sale
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {orders.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-stone-400">No orders found matching your criteria</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6 text-sm">
        <span className="text-stone-500">
          Showing {totalCount === 0 ? 0 : from}–{to} of {totalCount}
        </span>
        <div className="flex space-x-2">
          {page > 1 && (
            <button onClick={() => load(page - 1)} className="btn-secondary text-xs">‹ Prev</button>
          )}
          {page < totalPages && (
            <button onClick={() => load(page + 1)} className="btn-secondary text-xs">Next ›</button>
          )}
        </div>
      </div>
    </div>
  );
}
