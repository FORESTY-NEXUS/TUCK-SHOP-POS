"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, ChevronDown } from "lucide-react";

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
  cash: "Cash", easypaisa: "EasyPaisa", jazzcash: "JazzCash", card: "Card", bank: "Bank Transfer",
};

export default function OrderHistoryClient({ initialData }: { initialData: any }) {
  const [range, setRange] = useState<RangeKey>((initialData?.rangeUsed as RangeKey) || "all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<any>(initialData);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Out-of-order response guard for rapid filter/pagination changes.
  const reqId = useRef(0);

  const load = useCallback(async (page: number, overrides?: Partial<{ range: RangeKey; type: string; status: string; search: string; customStart: string; customEnd: string }>) => {
    setLoading(true);
    const id = ++reqId.current;
    const o = overrides || {};
    const r = o.range ?? range;
    const t = o.type ?? type;
    const st = o.status ?? status;
    const q = o.search ?? search;
    const cs = o.customStart ?? customStart;
    const ce = o.customEnd ?? customEnd;
    try {
      const qs = new URLSearchParams({ page: String(page), range: r, type: t, status: st });
      if (q.trim()) qs.set("search", q.trim());
      if (r === "custom") {
        if (cs) qs.set("start", cs);
        if (ce) qs.set("end", ce);
      }
      const res = await fetch(`/api/orders/history?${qs.toString()}`);
      if (res.ok && id === reqId.current) setData(await res.json());
    } catch {
      /* keep last */
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, type, status, search, customStart, customEnd]);

  useEffect(() => {
    // Initial server data shows instantly; refetch client-side afterwards.
  }, []);

  function changeRange(r: RangeKey) {
    setRange(r);
    setExpandedId(null);
    load(1, { range: r });
  }

  function changeType(t: string) {
    setType(t);
    setExpandedId(null);
    load(1, { type: t });
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
              placeholder="Search order #, address, note…"
              className="input pl-10"
            />
          </div>
          <select value={type} onChange={(e) => changeType(e.target.value)} className="input w-auto">
            <option value="all">All Types</option>
            <option value="dine_in">Dine In</option>
            <option value="takeaway">Takeaway</option>
            <option value="delivery">Delivery</option>
          </select>
          <select value={status} onChange={(e) => changeStatus(e.target.value)} className="input w-auto">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="refunded">Refunded</option>
            <option value="partially_refunded">Partially Refunded</option>
            <option value="cancelled">Cancelled</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="dispatched">Dispatched</option>
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
                <th className="text-left px-4 py-3 font-medium">Order #</th>
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
                  <tr className="hover:bg-stone-50 cursor-pointer" onClick={() => setExpandedId(expandedId === o._id ? null : o._id)}>
                    <td className="px-4 py-3 font-medium text-brand-700 tabular">{o.orderNumber}</td>
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
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        o.status === "completed" ? "bg-green-100 text-green-800" :
                        o.status === "refunded" ? "bg-red-100 text-red-700" :
                        o.status === "partially_refunded" ? "bg-red-50 text-red-600" :
                        o.status === "cancelled" ? "bg-stone-200 text-stone-600" :
                        o.status === "dispatched" ? "bg-stone-200 text-stone-700" :
                        o.status === "ready" ? "bg-brand-100 text-brand-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {o.status.replace(/_/g, " ")}
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
                                    {item.lineDiscountPercent > 0 && <span className="text-green-700 ml-1">(−{item.lineDiscountPercent}%)</span>}
                                    {item.isVoided && <span className="text-red-500 ml-1">(voided)</span>}
                                  </span>
                                  <span className="font-medium tabular">Rs. {(item.price * item.qty * (1 - (item.lineDiscountPercent || 0) / 100)).toFixed(2)}</span>
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
                              {(o.deliveryCharges ?? 0) > 0 && (
                                <div className="flex justify-between"><span className="text-stone-500">Delivery</span><span className="tabular">Rs. {Number(o.deliveryCharges).toFixed(2)}</span></div>
                              )}
                              <div className="flex justify-between font-semibold"><span>Total</span><span className="tabular">Rs. {Number(o.total).toFixed(2)}</span></div>
                              {o.isPaid && <div className="flex justify-between"><span className="text-stone-500">Paid</span><span className="tabular">Rs. {Number(o.paidAmount).toFixed(2)}</span></div>}
                              {(o.refundedAmount ?? 0) > 0 && (
                                <div className="flex justify-between text-red-600"><span>Refunded</span><span className="tabular">Rs. {Number(o.refundedAmount).toFixed(2)}</span></div>
                              )}
                              {o.table && <div className="flex justify-between"><span className="text-stone-500">Table</span><span className="tabular">{o.table}</span></div>}
                              {o.waiter?.name && <div className="flex justify-between"><span className="text-stone-500">Waiter</span><span>{o.waiter.name}</span></div>}
                              {o.rider?.name && <div className="flex justify-between"><span className="text-stone-500">Rider</span><span>{o.rider.name}</span></div>}
                              {o.deliveryAddress && <div className="flex justify-between gap-3"><span className="text-stone-500 shrink-0">Address</span><span className="text-right">{o.deliveryAddress}</span></div>}
                              {o.refund && <div className="flex justify-between text-red-600"><span>Refund reason</span><span className="text-right">{o.refund.reason}</span></div>}
                              {o.voidReason && <div className="flex justify-between text-stone-500"><span>Void reason</span><span>{o.voidReason}</span></div>}
                            </div>
                          </div>
                        </div>
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
