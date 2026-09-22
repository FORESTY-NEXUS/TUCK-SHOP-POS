"use client";

import Link from "next/link";
import { useState } from "react";

type Customer = {
  _id: string;
  name?: string;
  phone: string;
  loyaltyPoints: number;
};

type LoyaltyEntry = {
  _id: string;
  orderNumber: string;
  type: "dine_in" | "takeaway" | "delivery";
  total: number;
  createdAt: string;
  paymentMethod?: string;
  status?: string;
};

export default function CustomerLoyaltyClient({
  initialCustomer,
  initialHistory,
  allCustomers,
}: {
  initialCustomer: Customer | null;
  initialHistory: LoyaltyEntry[];
  allCustomers: Customer[];
}) {
  const [selectedCustomer] = useState<Customer | null>(initialCustomer);
  const [history] = useState<LoyaltyEntry[]>(initialHistory);

  return (
    <div className="px-6 py-8 w-full">
      {selectedCustomer ? (
        <div>
          <Link href="/customer-loyalty" className="mb-4 inline-block text-sm text-brand-700 hover:text-brand-800 font-medium">
            ← Back to all customers
          </Link>
          <div className="card p-6 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">
                  {selectedCustomer.name || "Guest"} · {selectedCustomer.phone}
                </h2>
                <p className="text-sm text-stone-500 mt-1">Loyalty history</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-brand-700 tabular">{selectedCustomer.loyaltyPoints}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide mt-1">points balance</div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="text-sm font-semibold text-stone-900">Order History</h3>
            </div>
            {history.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {history.map((entry) => (
                  <div key={entry._id} className="px-6 py-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900">Order {entry.orderNumber}</span>
                        <span className="text-xs text-stone-400">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-stone-500 mt-0.5 capitalize">
                        {entry.type.replace("_", " ")}
                        {entry.paymentMethod && ` · ${entry.paymentMethod}`}
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">{entry.status?.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-stone-900 tabular">Rs. {Number(entry.total).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-12 text-center text-stone-400 text-sm">No orders found for this customer.</div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-stone-900 font-brand">Customer Loyalty</h1>
            <p className="text-sm text-stone-500 mt-0.5">Directory by loyalty points — walk-in Guest excluded</p>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-xs text-stone-500 uppercase tracking-wider">
                    <th className="px-4 py-3 font-medium">Rank</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Phone</th>
                    <th className="px-4 py-3 font-medium">Loyalty Points</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {allCustomers.map((c, idx) => (
                    <tr key={c._id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-medium text-stone-400 tabular">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-stone-900">{c.name || "Guest"}</td>
                      <td className="px-4 py-3 text-stone-600 tabular">{c.phone}</td>
                      <td className="px-4 py-3 font-semibold text-brand-700 tabular">{c.loyaltyPoints}</td>
                      <td className="px-4 py-3">
                        <Link href={`/customer-loyalty?customerId=${c._id}`} className="text-brand-700 hover:text-brand-800 font-medium text-sm">
                          View History
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {allCustomers.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-stone-400">No customers yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
