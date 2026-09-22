"use client";

import { useCallback, useRef, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Line, Legend,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

type RangeKey = "today" | "yesterday" | "this_week" | "this_month" | "custom";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  easypaisa: "EasyPaisa",
  jazzcash: "JazzCash",
  card: "Card",
  bank: "Bank Transfer",
};

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

export default function ReportsClient({ initialData }: { initialData: any }) {
  const [range, setRange] = useState<RangeKey>((initialData?.range?.label as RangeKey) || "today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [data, setData] = useState<any>(initialData);
  const [loading, setLoading] = useState(false);
  // Out-of-order guard: only the latest request may commit state.
  const reqId = useRef(0);

  const load = useCallback(async (r: RangeKey, s?: string, e?: string) => {
    setLoading(true);
    const id = ++reqId.current;
    try {
      const qs = new URLSearchParams({ range: r });
      if (r === "custom") {
        if (s) qs.set("start", s);
        if (e) qs.set("end", e);
      }
      const res = await fetch(`/api/reports/sales?${qs.toString()}`);
      if (res.ok && id === reqId.current) setData(await res.json());
    } catch {
      /* keep last */
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, []);

  function changeRange(r: RangeKey) {
    setRange(r);
    if (r !== "custom") load(r);
    else load(r, customStart, customEnd);
  }

  const summary = data?.summary || {};

  const prev = summary.prevPeriod || {};
  const pct = prev.revenueChangePct;
  const cards = [
    {
      label: "Net Revenue",
      value: summary.netRevenue != null ? `Rs. ${Number(summary.netRevenue).toLocaleString()}` : "—",
      delta: pct,
      deltaText: pct == null ? null : `${pct >= 0 ? "+" : ""}${pct}% vs prev. period`,
    },
    {
      label: "Gross Revenue",
      value: summary.grossRevenue != null ? `Rs. ${Number(summary.grossRevenue).toLocaleString()}` : "—",
      delta: null,
      deltaText: null,
    },
    {
      label: "Refunded",
      value: summary.totalRefunded != null ? `Rs. ${Number(summary.totalRefunded).toLocaleString()}` : "—",
      danger: (summary.totalRefunded ?? 0) > 0,
      delta: null,
      deltaText: null,
    },
    {
      label: "Orders",
      value: summary.totalOrders != null ? String(summary.totalOrders) : "—",
      delta: null,
      deltaText:
        prev.orders != null
          ? `${summary.totalOrders >= prev.orders ? "+" : ""}${summary.totalOrders - prev.orders} vs prev. period`
          : null,
    },
  ];

  const chartData = (summary.dailySeries || []).map((d: any) => ({
    name: d.date.slice(5),
    revenue: d.revenue,
    aov: d.aov ?? 0,
  }));
  const hourlyData = (summary.hourlyPattern || []).map((b: any) => ({
    name: HOUR_LABELS[b.hour] || String(b.hour),
    revenue: b.revenue,
  }));
  const bestItems = summary.bestItems || [];
  const worstItems = summary.worstItems || [];

  return (
    <div className="space-y-6">
      {/* Range control */}
      <div className="card p-4 flex items-center gap-3 flex-wrap">
        <div className="flex rounded-lg border border-stone-300 overflow-hidden bg-white">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => changeRange(r.key)}
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
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="input max-w-40" />
            <span className="text-stone-400">→</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="input max-w-40" />
            <button onClick={() => load(range, customStart, customEnd)} className="btn-primary">Apply</button>
          </div>
        )}
        {loading && <span className="text-xs text-stone-400">Updating…</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-sm text-stone-500 mb-1">{c.label}</div>
            <div className={`text-2xl font-bold tabular ${c.danger ? "text-red-600" : "text-stone-900"}`}>{c.value}</div>
            {c.deltaText && (
              <div className={`text-xs mt-1 flex items-center gap-1 ${c.delta != null && c.delta < 0 ? "text-red-600" : "text-green-700"}`}>
                {c.delta != null && c.delta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {c.deltaText}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by day + AOV trend */}
        <div className="card p-4 lg:col-span-2">
          <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Revenue by day</h3>
          {chartData.length > 0 ? (
            <div key={`${range}-${chartData.length}-${Date.now() % 97}`} className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#78716c" }} />
                  <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: "#78716c" }} />
                  <YAxis yAxisId="aov" orientation="right" tick={{ fontSize: 11, fill: "#78716c" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #E7E5E4", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: any, nameKey: any) => [nameKey === "aov" ? `Rs. ${Number(value).toLocaleString()}` : `Rs. ${Number(value).toLocaleString()}`, nameKey]}
                  />
                  <Legend />
                  <Bar yAxisId="rev" dataKey="revenue" name="Revenue (Rs.)" fill="#226B49" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="aov" type="monotone" dataKey="aov" name="Avg order value" stroke="#B45309" strokeWidth={2} dot={{ r: 3, fill: "#B45309" }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-72 flex items-center justify-center text-stone-400 text-sm">
              No paid orders in this range
            </div>
          )}
        </div>

        {/* Hourly pattern */}
        <div className="card p-4">
          <h3 className="text-[15px] font-semibold text-stone-900 mb-1">Sales by hour</h3>
          <p className="text-xs text-stone-400 mb-4">Average revenue per hour (multi-day ranges)</p>
          {hourlyData.some((h: any) => h.revenue > 0) ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7E5E4" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#78716c" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#78716c" }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #E7E5E4", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: any) => [`Rs. ${Number(value).toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="#57A87A" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-stone-400 text-sm">No hourly data in this range</div>
          )}
        </div>

        {/* Best & worst sellers */}
        <div className="card p-4">
          <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Best & worst sellers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Best</p>
              <div className="space-y-2">
                {bestItems.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-stone-700 truncate pr-2">{it.name}</span>
                    <span className="font-medium text-stone-900 tabular shrink-0">{it.qty}×</span>
                  </div>
                ))}
                {bestItems.length === 0 && <p className="text-sm text-stone-400">No sales in this range</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">Worst</p>
              <div className="space-y-2">
                {worstItems.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-stone-700 truncate pr-2">{it.name}</span>
                    <span className="font-medium text-stone-900 tabular shrink-0">{it.qty}×</span>
                  </div>
                ))}
                {worstItems.length === 0 && <p className="text-sm text-stone-400">No sales in this range</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment method breakdown + category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-4">
          <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Revenue by payment method</h3>
          <div className="space-y-3">
            {Object.entries(summary.methodBreakdown || {}).map(([method, v]: any) => (
              <div key={method} className="flex items-center justify-between text-sm">
                <span className="text-stone-600">{METHOD_LABELS[method] || method}</span>
                <span className="font-medium text-stone-900 tabular">Rs. {Number(v.net).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-[15px] font-semibold text-stone-900 mb-4">Revenue by category</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {(summary.revenueByCategory || []).map((c: any) => (
              <div key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-700">{c.category}</span>
                  <span className="font-medium text-stone-900 tabular">Rs. {Number(c.revenue).toLocaleString()}</span>
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5">
                  <div
                    className="bg-brand-600 h-1.5 rounded-full"
                    style={{ width: `${Math.min(100, (c.revenue / (Math.max(...(summary.revenueByCategory || []).map((x: any) => x.revenue), 1))) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {(summary.revenueByCategory || []).length === 0 && (
              <p className="text-sm text-stone-400">No sales in this range</p>
            )}
          </div>
        </div>
      </div>

      {/* Top items */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
          <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Top selling items</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr className="text-xs text-stone-500 uppercase tracking-wider">
                <th className="text-left px-4 py-2.5 font-medium">#</th>
                <th className="text-left px-4 py-2.5 font-medium">Item</th>
                <th className="text-right px-4 py-2.5 font-medium">Qty sold</th>
                <th className="text-right px-4 py-2.5 font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {(summary.topItems || []).map((item: any, i: number) => (
                <tr key={i} className="hover:bg-stone-50">
                  <td className="px-4 py-2.5 text-stone-400 tabular">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium text-stone-900">{item.name}</td>
                  <td className="px-4 py-2.5 text-right tabular">{item.qty}</td>
                  <td className="px-4 py-2.5 text-right font-medium tabular">Rs. {Number(item.revenue).toLocaleString()}</td>
                </tr>
              ))}
              {(summary.topItems || []).length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-stone-400">No sales in this range</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
