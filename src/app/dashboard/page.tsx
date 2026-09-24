"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppLayout from "@/components/Layout/AppLayout";
import Link from "next/link";
import { TrendingUp, ShoppingCart, Receipt, ArrowRight, Users } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type RangeKey = "today" | "yesterday" | "this_week" | "this_month" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

export default function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [customerCount, setCustomerCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  // Out-of-order response guard — a stale fetch must never overwrite newer data.
  const reqId = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    const id = ++reqId.current;
    try {
      const qs = new URLSearchParams({ range });
      if (range === "custom") {
        if (customStart) qs.set("start", customStart);
        if (customEnd) qs.set("end", customEnd);
      }
      const [reportRes, historyRes, customersRes] = await Promise.all([
        fetch(`/api/reports/sales?${qs.toString()}`),
        fetch(`/api/sales/history?${qs.toString()}&page=1`),
        fetch("/api/customers"),
      ]);
      if (reportRes.ok && id === reqId.current) setData(await reportRes.json());
      if (historyRes.ok && id === reqId.current) {
        const h = await historyRes.json();
        setRecent((h.orders || []).slice(0, 6));
      }
      if (customersRes.ok && id === reqId.current) {
        const c = await customersRes.json();
        setCustomerCount(Array.isArray(c) ? c.length : null);
      }
    } catch {
      /* keep last */
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [range, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary;
  const avgOrder = summary?.totalOrders ? summary.netRevenue / summary.totalOrders : 0;

  const stats = [
    {
      title: "Net Revenue",
      value: summary ? `Rs. ${Number(summary.netRevenue).toLocaleString()}` : "—",
      icon: TrendingUp,
      note: `${summary ? Number(summary.grossRevenue).toLocaleString() : "—"} gross · ${summary ? Number(summary.totalRefunded).toLocaleString() : "—"} refunded`,
    },
    { title: "Orders", value: summary ? String(summary.totalOrders) : "—", icon: ShoppingCart, note: `Dine In ${summary?.orderCounts?.dine_in ?? 0} · TA ${summary?.orderCounts?.takeaway ?? 0} · DL ${summary?.orderCounts?.delivery ?? 0}` },
    { title: "Average Order", value: avgOrder ? `Rs. ${avgOrder.toLocaleString()}` : "—", icon: Receipt, note: "net ÷ orders" },
    { title: "Customers", value: customerCount != null ? String(customerCount) : "—", icon: Users, note: "in directory" },
  ];

  const chartData = (summary?.dailySeries || []).length > 0
    ? summary.dailySeries.map((d: any) => ({ name: d.date.slice(5), revenue: d.revenue }))
    : [];

  return (
    <AppLayout>
      <div className="px-6 py-8 w-full">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900 font-brand">Dashboard</h1>
            <p className="text-sm text-stone-500 mt-0.5">Live sales snapshot</p>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex rounded-lg border border-stone-300 overflow-hidden bg-white">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-3.5 py-2 text-sm font-medium transition-colors ${
                    range === r.key ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            {range === "custom" && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input w-40" />
                <span className="text-stone-400">→</span>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input w-40" />
              </div>
            )}
          </div>
        </div>

        {loading && summary === null ? (
          <p className="text-stone-400 text-sm">Loading…</p>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {stats.map((s) => (
                <div key={s.title} className="card p-4">
                  <div className="text-sm text-stone-500 mb-1">{s.title}</div>
                  <div className="text-2xl font-bold text-stone-900 tabular">{s.value}</div>
                  <div className="text-xs text-stone-400 mt-1">{s.note}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chart */}
              <div className="card p-4 lg:col-span-2">
                <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Revenue by day</h3>
                {chartData.length > 0 ? (
                  <div key={`${range}-${chartData.length}`} className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#78716c" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #E7E5E4", borderRadius: "8px", fontSize: "12px" }}
                          formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, "Revenue"]}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#226B49" strokeWidth={2} dot={{ r: 3, fill: "#226B49" }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-72 flex items-center justify-center text-stone-400 text-sm">No paid orders in this range</div>
                )}
              </div>

              {/* Top items */}
              <div className="card p-4">
                <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Top items</h3>
                <div className="space-y-3">
                  {(summary?.topItems || []).slice(0, 6).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-stone-100 last:border-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-medium shrink-0">
                          {i + 1}
                        </div>
                        <span className="font-medium text-stone-900 text-sm truncate">{item.name}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-semibold text-stone-900 tabular">{item.qty}×</div>
                        <div className="text-xs text-stone-400 tabular">Rs. {Number(item.revenue).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {(summary?.topItems || []).length === 0 && (
                    <p className="text-sm text-stone-400">No sales recorded in this range.</p>
                  )}
                </div>
                <Link href="/reports" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                  Full sales report <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Recent orders */}
            <div className="card mt-6 overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Recent orders</h3>
                <Link href="/orders" className="text-xs font-medium text-brand-700 hover:text-brand-800">View all</Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr className="text-xs text-stone-500 uppercase tracking-wider">
                      <th className="text-left px-4 py-2.5 font-medium">Sale #</th>
                      <th className="text-left px-4 py-2.5 font-medium">Customer</th>
                      <th className="text-left px-4 py-2.5 font-medium">Payment</th>
                      <th className="text-left px-4 py-2.5 font-medium">Time</th>
                      <th className="text-right px-4 py-2.5 font-medium">Total</th>
                      <th className="text-center px-4 py-2.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {recent.map((o: any) => (
                      <tr key={o._id} className="hover:bg-stone-50">
                        <td className="px-4 py-2.5 font-medium text-brand-700 tabular">{o.saleNumber}</td>
                        <td className="px-4 py-2.5">{o.customer?.name || o.customer?.phone || "Guest"}</td>
                        <td className="px-4 py-2.5 capitalize">{(o.paymentMethod || "").replace("_", " ")}</td>
                        <td className="px-4 py-2.5 text-stone-500 tabular">
                          {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium tabular">Rs. {Number(o.total).toFixed(2)}</td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            o.status === "completed" ? "bg-green-100 text-green-800" :
                            o.status === "voided" ? "bg-stone-200 text-stone-600" : "bg-red-100 text-red-700"
                          }`}>{o.status.replace(/_/g, " ")}</span>
                        </td>
                      </tr>
                    ))}
                    {recent.length === 0 && (
                      <tr><td colSpan={6} className="py-10 text-center text-stone-400">No orders in this range</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
