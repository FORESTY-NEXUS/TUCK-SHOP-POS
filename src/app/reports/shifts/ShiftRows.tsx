"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

type ShiftData = {
  _id: string;
  cashier?: { name?: string };
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  expectedCash?: number;
  difference?: number | null;
  isOpen: boolean;
  orderCount?: number;
  refundCount?: number;
  byMethod?: Record<string, { gross: number; refunded: number; net: number }> | null;
};

type Props = {
  initialShifts: ShiftData[];
  page: number;
  totalPages: number;
  totalCount: number;
};

export default function ShiftRows({ initialShifts, page, totalPages, totalCount }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);


  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Cashier</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Opening</th>
              <th className="px-4 py-3 text-right">Closing</th>
              <th className="px-4 py-3 text-right">Expected</th>
              <th className="px-4 py-3 text-right">Difference</th>
              <th className="px-4 py-3 text-center">Orders</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {initialShifts.map((shift) => {
              const difference = shift.difference ?? null;
              const isOver = difference !== null && difference > 0;
              const isShort = difference !== null && difference < 0;
              const isExpanded = expandedId === shift._id;
              const byMethod = shift.byMethod ?? null;

              const cashNet = byMethod?.cash?.net ?? 0;
              const totalNet = Object.values(byMethod ?? {}).reduce((s, m) => s + (m.net ?? 0), 0);

              return (
                <React.Fragment key={shift._id ?? shift.openedAt}>
                  <tr key={shift._id ?? shift.openedAt} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {new Date(shift.openedAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {shift.closedAt && ` - ${new Date(shift.closedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                      </div>
                    </td>
                    <td className="px-4 py-3">{shift.cashier?.name || "—"}</td>
                    <td className="px-4 py-3">
                      {shift.isOpen ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Open</span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Closed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">Rs. {shift.openingBalance.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">
                      {shift.closingBalance != null ? `Rs. ${shift.closingBalance.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {shift.expectedCash != null ? `Rs. ${shift.expectedCash.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {difference !== null ? (
                        <span className={isOver ? "text-green-600" : isShort ? "text-red-600" : "text-gray-600"}>
                          {isOver ? "+" : ""}{difference.toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-900">
                      {shift.orderCount ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : shift._id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${shift._id ?? shift.openedAt}-detail`} className="border-b border-gray-100">
                      <td colSpan={9} className="px-4 py-4 bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                              Sales by Payment Method
                            </h4>
                            {byMethod && Object.keys(byMethod).length > 0 ? (
                              <div className="space-y-2">
                                {Object.entries(byMethod).map(([method, data]) => {
                                  const labels: Record<string, string> = {
                                    cash: "Cash",
                                    easypaisa: "EasyPaisa",
                                    jazzcash: "JazzCash",
                                    card: "Card",
                                    bank: "Bank Transfer",
                                  };
                                  return (
                                    <div key={method} className="flex items-center justify-between text-sm">
                                      <span className="text-gray-600">{labels[method] || method}</span>
                                      <span className="font-medium text-gray-900">
                                        Rs. {data.net.toLocaleString()}
                                        <span className="text-gray-400 text-xs ml-1">
                                          (in {data.gross.toLocaleString()} / out {data.refunded.toLocaleString()})
                                        </span>
                                      </span>
                                    </div>
                                  );
                                })}
                                <div className="border-t border-gray-200 pt-2 mt-2 flex items-center justify-between text-sm font-semibold">
                                  <span className="text-gray-700">Total</span>
                                  <span className="text-gray-900">Rs. {totalNet.toLocaleString()}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 italic">
                                {shift.isOpen ? "Breakdown available at shift close" : "No breakdown data"}
                              </p>
                            )}
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                              Cash Reconciliation
                            </h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-gray-600">Opening balance</span>
                                <span className="font-medium text-gray-900">Rs. {shift.openingBalance.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Cash collected (net)</span>
                                <span className="font-medium text-gray-900">Rs. {cashNet.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Expected cash</span>
                                <span className="font-medium text-gray-900">
                                  {shift.expectedCash != null ? `Rs. ${shift.expectedCash.toLocaleString()}` : "—"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-600">Actual cash</span>
                                <span className="font-medium text-gray-900">
                                  {shift.closingBalance != null ? `Rs. ${shift.closingBalance.toLocaleString()}` : "—"}
                                </span>
                              </div>
                              {difference !== null && (
                                <div className="flex justify-between pt-2 border-t border-gray-200">
                                  <span className="text-gray-700 font-medium">Difference</span>
                                  <span className={`font-semibold ${isOver ? "text-green-600" : isShort ? "text-red-600" : "text-gray-600"}`}>
                                    {isOver ? "+" : ""}{difference.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between pt-2 border-t border-gray-200">
                                <span className="text-gray-600">Total orders</span>
                                <span className="font-medium text-gray-900">{shift.orderCount ?? 0}</span>
                              </div>
                              {shift.refundCount != null && shift.refundCount > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Refunds</span>
                                  <span className="font-medium text-gray-900">{shift.refundCount}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 text-sm">
          <span>
            Showing page {page} of {totalPages} ({totalCount} shifts)
          </span>
          <div className="flex space-x-2">
            {page > 1 && (
              <Link
                href={`/reports/shifts?page=${page - 1}`}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                ‹ Prev
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/reports/shifts?page=${page + 1}`}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                Next ›
              </Link>
            )}
          </div>
        </div>
      )}
    </>
  );
}
