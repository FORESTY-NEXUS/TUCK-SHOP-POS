"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  HandCoins,
  Users,
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Plus,
  ArrowLeft,
  Banknote,
  X,
  Receipt,
  Activity,
  Crown,
} from "lucide-react";

/* ────────────────────────────────── Types ─────────────────────────────────── */

type Stats = {
  totalUdhaar: number;
  customersWithCredit: number;
  collectedThisMonth: number;
  creditGivenThisMonth: number;
  netCreditChange: number;
  period: string;
};

type CustomerRow = {
  _id: string;
  name?: string;
  phone: string;
  outstanding: number;
  cachedBalance: number;
  lastActivity: string | null;
};

type LedgerEntry = {
  _id: string;
  type: "credit" | "payment" | "return" | "adjustment";
  amount: number;
  runningBalance: number;
  notes?: string;
  saleNumber?: string;
  createdAt: string;
};

type CustomerDetail = {
  customer: { _id: string; name?: string; phone: string; address?: string };
  outstanding: number;
  cachedBalance: number;
  ledger: LedgerEntry[];
};

type RecentEntry = {
  _id: string;
  customerName: string;
  customerId: string;
  type: string;
  amount: number;
  notes?: string;
  createdAt: string;
};

/* ────────────────────────────── Helpers ───────────────────────────────── */

function formatRs(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-PK")}`;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-PK", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "all", label: "All Time" },
];

const FILTER_TABS = [
  { value: "outstanding", label: "Outstanding" },
  { value: "all_credit", label: "All Credit Customers" },
  { value: "recently_active", label: "Recently Active" },
];

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "easypaisa", label: "Easypaisa" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "bank_transfer", label: "Bank Transfer" },
];

/* ────────────────────────────── Component ─────────────────────────────── */

export default function UdhaarClient() {
  // Dashboard state
  const [stats, setStats] = useState<Stats | null>(null);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentEntry[]>([]);
  const [topDebtors, setTopDebtors] = useState<CustomerRow[]>([]);
  const [totalCustomersWithLedger, setTotalCustomersWithLedger] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filter, setFilter] = useState("outstanding");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [period, setPeriod] = useState("this_month");

  // Customer detail state
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentNote, setPaymentNote] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);

  // Add customer state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [canCollect, setCanCollect] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.permissions?.includes("udhaarCollect")) setCanCollect(true); })
      .catch(() => {});
  }, []);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [addingCustomer, setAddingCustomer] = useState(false);

  // ── Search debounce ─────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Fetch dashboard data ────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    try {
      const url = new URL("/api/udhaar", window.location.origin);
      url.searchParams.set("filter", filter);
      url.searchParams.set("period", period);
      if (searchDebounced) url.searchParams.set("search", searchDebounced);

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();

      setStats(data.stats);
      setCustomers(data.customers);
      setRecentActivity(data.recentActivity);
      setTopDebtors(data.topDebtors);
      setTotalCustomersWithLedger(data.totalCustomersWithLedger);
    } catch {
      toast.error("Failed to load Udhaar data");
    } finally {
      setLoading(false);
    }
  }, [filter, period, searchDebounced]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ── Fetch customer detail ───────────────────────────────────────────────
  async function openCustomerDetail(customerId: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/udhaar/${customerId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSelectedCustomer(data);
    } catch {
      toast.error("Failed to load customer details");
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setSelectedCustomer(null);
    setShowPaymentModal(false);
    setShowPaymentConfirmation(false);
  }

  // ── Payment flow ────────────────────────────────────────────────────────
  function openPaymentModal(fullPayment = false) {
    if (!selectedCustomer) return;
    setPaymentAmount(fullPayment ? String(selectedCustomer.outstanding) : "");
    setPaymentMethod("cash");
    setPaymentNote("");
    setShowPaymentModal(true);
    setShowPaymentConfirmation(false);
  }

  function requestPaymentConfirmation() {
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (selectedCustomer && amount > selectedCustomer.outstanding + 0.01) {
      toast.error(
        `Payment cannot exceed outstanding balance of ${formatRs(selectedCustomer.outstanding)}`
      );
      return;
    }
    setShowPaymentConfirmation(true);
  }

  async function confirmPayment() {
    if (!selectedCustomer || paymentSubmitting) return;
    const amount = Number(paymentAmount);

    setPaymentSubmitting(true);
    try {
      const res = await fetch(`/api/udhaar/${selectedCustomer.customer._id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          paymentMethod,
          notes: paymentNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Payment failed");
      }

      const result = await res.json();
      toast.success(
        `Payment of ${formatRs(amount)} received. New balance: ${formatRs(result.newBalance)}`
      );

      // Refresh detail and dashboard
      setShowPaymentModal(false);
      setShowPaymentConfirmation(false);
      await openCustomerDetail(selectedCustomer.customer._id);
      fetchDashboard();
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setPaymentSubmitting(false);
    }
  }

  // ── Add customer ────────────────────────────────────────────────────────
  async function addCustomer() {
    if (!newPhone.trim() || addingCustomer) return;
    setAddingCustomer(true);
    try {
      const payload: Record<string, string> = { phone: newPhone.trim() };
      if (newName.trim()) payload.name = newName.trim();
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create customer");
      toast.success("Customer created");
      setNewName("");
      setNewPhone("");
      setNewNotes("");
      setShowAddCustomer(false);
      fetchDashboard();
    } catch {
      toast.error("Failed to create customer");
    } finally {
      setAddingCustomer(false);
    }
  }

  // ── Render: Loading ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="px-6 py-8 w-full">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
            <HandCoins className="w-5 h-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 font-brand">Udhaar</h1>
            <p className="text-sm text-stone-500">Loading credit data…</p>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-4 mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-3 bg-stone-200 rounded w-20 mb-3" />
              <div className="h-7 bg-stone-200 rounded w-28" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Render: Customer Detail View ────────────────────────────────────────
  if (selectedCustomer) {
    const c = selectedCustomer.customer;
    const outstanding = selectedCustomer.outstanding;

    return (
      <div className="px-6 py-8 w-full">
        {/* Back button */}
        <button
          onClick={closeDetail}
          className="mb-5 flex items-center gap-2 text-sm text-brand-700 hover:text-brand-800 font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Udhaar
        </button>

        {/* Customer header */}
        <div className="card p-6 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-xl font-bold text-brand-700">
                {(c.name || c.phone).charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-bold text-stone-900 font-brand">
                  {c.name || "Unnamed Customer"}
                </h2>
                <p className="text-sm text-stone-500 tabular mt-0.5">{c.phone}</p>
                {c.address && (
                  <p className="text-xs text-stone-400 mt-0.5">{c.address}</p>
                )}
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-stone-500 uppercase tracking-wider mb-1">
                Outstanding
              </div>
              <div
                className={`text-3xl font-bold tabular ${
                  outstanding > 0 ? "text-red-600" : "text-brand-700"
                }`}
              >
                {formatRs(outstanding)}
              </div>
            </div>
          </div>

          {/* Payment buttons */}
          {outstanding > 0 && canCollect && (
            <div className="flex gap-3 mt-5 pt-5 border-t border-stone-100">
              <button
                onClick={() => openPaymentModal(false)}
                className="btn-primary flex items-center gap-2"
              >
                <Banknote className="w-4 h-4" />
                Receive Payment
              </button>
              <button
                onClick={() => openPaymentModal(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                Receive Full Payment
              </button>
            </div>
          )}
        </div>

        {/* Ledger table */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50">
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
              Credit Ledger
              <span className="ml-2 text-xs font-normal text-stone-400">
                {selectedCustomer.ledger.length} entries
              </span>
            </h3>
          </div>

          {selectedCustomer.ledger.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-xs text-stone-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4 text-left font-medium">Date</th>
                    <th className="py-2.5 px-4 text-left font-medium">Type</th>
                    <th className="py-2.5 px-4 text-right font-medium">Amount</th>
                    <th className="py-2.5 px-4 text-right font-medium">Balance</th>
                    <th className="py-2.5 px-4 text-left font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {selectedCustomer.ledger.map((entry) => {
                    const isCredit = entry.type === "credit" || entry.type === "adjustment";
                    const typeLabel =
                      entry.type === "credit"
                        ? entry.saleNumber
                          ? `Credit Sale #${entry.saleNumber}`
                          : "Credit Sale"
                        : entry.type === "payment"
                        ? "Payment"
                        : entry.type === "return"
                        ? "Return"
                        : "Adjustment";

                    return (
                      <tr key={entry._id} className="hover:bg-stone-50/50">
                        <td className="py-3 px-4 text-stone-600 whitespace-nowrap">
                          <div>{formatDate(entry.createdAt)}</div>
                          <div className="text-xs text-stone-400">
                            {formatTime(entry.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                              isCredit
                                ? "bg-red-50 text-red-700"
                                : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {isCredit ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : (
                              <ArrowDownRight className="w-3 h-3" />
                            )}
                            {typeLabel}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-semibold tabular whitespace-nowrap ${
                            isCredit ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {isCredit ? "+" : "−"}
                          {formatRs(entry.amount)}
                        </td>
                        <td className="py-3 px-4 text-right text-stone-700 tabular font-medium whitespace-nowrap">
                          {formatRs(entry.runningBalance)}
                        </td>
                        <td className="py-3 px-4 text-stone-500 text-xs max-w-[200px] truncate">
                          {entry.notes || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-stone-400">
              <Receipt className="w-10 h-10 mx-auto mb-3 text-stone-300" />
              <p className="text-sm">No credit transactions yet</p>
            </div>
          )}
        </div>

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
              {!showPaymentConfirmation ? (
                /* Step 1: Enter payment details */
                <div className="p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-lg font-bold text-stone-900 font-brand">
                      Receive Payment
                    </h3>
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className="p-1 text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-1 mb-5 p-3 bg-stone-50 rounded-lg">
                    <p className="text-sm text-stone-600">
                      <span className="font-medium">{c.name || c.phone}</span>
                    </p>
                    <p className="text-sm text-stone-500">
                      Outstanding:{" "}
                      <span className="font-bold text-red-600 tabular">
                        {formatRs(outstanding)}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5 font-medium">
                        Amount
                      </label>
                      <input
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0"
                        className="input text-lg font-semibold tabular"
                        min={1}
                        max={outstanding}
                        autoFocus
                      />
                      {Number(paymentAmount) > outstanding && (
                        <p className="text-xs text-red-600 mt-1">
                          Cannot exceed outstanding balance of {formatRs(outstanding)}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5 font-medium">
                        Payment Method
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="input"
                      >
                        {PAYMENT_METHODS.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-stone-500 mb-1.5 font-medium">
                        Note <span className="text-stone-400">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        placeholder="e.g. Cash at shop"
                        className="input"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 mt-6">
                    <button
                      onClick={() => setShowPaymentModal(false)}
                      className="btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={requestPaymentConfirmation}
                      disabled={
                        !Number(paymentAmount) ||
                        Number(paymentAmount) <= 0 ||
                        Number(paymentAmount) > outstanding + 0.01
                      }
                      className="btn-primary flex-1"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2: Confirm payment */
                <div className="p-6">
                  <h3 className="text-lg font-bold text-stone-900 font-brand mb-5">
                    Confirm Payment
                  </h3>

                  <div className="space-y-3 p-4 bg-stone-50 rounded-lg mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Customer</span>
                      <span className="font-medium text-stone-900">
                        {c.name || c.phone}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Previous Balance</span>
                      <span className="font-semibold text-red-600 tabular">
                        {formatRs(outstanding)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-500">Payment</span>
                      <span className="font-semibold text-emerald-600 tabular">
                        − {formatRs(Number(paymentAmount))}
                      </span>
                    </div>
                    <div className="border-t border-stone-200 pt-3 flex justify-between text-sm">
                      <span className="text-stone-700 font-medium">New Balance</span>
                      <span className="font-bold text-stone-900 tabular text-base">
                        {formatRs(outstanding - Number(paymentAmount))}
                      </span>
                    </div>
                    {Number(paymentAmount) >= outstanding - 0.01 && (
                      <div className="text-center pt-1">
                        <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                          ✓ This will clear the full balance
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPaymentConfirmation(false)}
                      className="btn-secondary flex-1"
                    >
                      Back
                    </button>
                    <button
                      onClick={confirmPayment}
                      disabled={paymentSubmitting}
                      className="btn-primary flex-1"
                    >
                      {paymentSubmitting ? "Processing…" : "Confirm Payment"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Render: Main Dashboard ──────────────────────────────────────────────
  return (
    <div className="px-6 py-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center">
            <HandCoins className="w-5 h-5 text-brand-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900 font-brand">Udhaar</h1>
            <p className="text-sm text-stone-500">
              Credit management &amp; payment tracking
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddCustomer(!showAddCustomer)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      {/* Add Customer Form */}
      {showAddCustomer && (
        <div className="card p-4 mb-6">
          <h2 className="text-sm font-semibold text-stone-900 mb-3">New Customer</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Customer name"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Phone *</label>
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="03XX-XXXXXXX"
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">
                Notes <span className="text-stone-400">(optional)</span>
              </label>
              <input
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Any notes"
                className="input"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              onClick={addCustomer}
              disabled={!newPhone.trim() || addingCustomer}
              className="btn-primary"
            >
              {addingCustomer ? "Saving…" : "Save Customer"}
            </button>
            <button onClick={() => setShowAddCustomer(false)} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <StatCard
            label="Total Udhaar"
            value={formatRs(stats.totalUdhaar)}
            icon={<HandCoins className="w-4 h-4" />}
            color="red"
          />
          <StatCard
            label="Customers with Credit"
            value={String(stats.customersWithCredit)}
            subtitle={`of ${totalCustomersWithLedger} total`}
            icon={<Users className="w-4 h-4" />}
            color="amber"
          />
          <StatCard
            label="Collected"
            value={formatRs(stats.collectedThisMonth)}
            subtitle={PERIOD_OPTIONS.find((p) => p.value === period)?.label}
            icon={<TrendingDown className="w-4 h-4" />}
            color="green"
          />
          <StatCard
            label="Credit Given"
            value={formatRs(stats.creditGivenThisMonth)}
            subtitle={PERIOD_OPTIONS.find((p) => p.value === period)?.label}
            icon={<TrendingUp className="w-4 h-4" />}
            color="blue"
          />
          <StatCard
            label="Net Credit Change"
            value={
              (stats.netCreditChange >= 0 ? "+" : "") +
              formatRs(Math.abs(stats.netCreditChange))
            }
            subtitle={PERIOD_OPTIONS.find((p) => p.value === period)?.label}
            icon={<Activity className="w-4 h-4" />}
            color={stats.netCreditChange > 0 ? "red" : "green"}
          />
        </div>
      )}

      {/* Period Selector + Search + Filters */}
      <div className="card p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="input w-auto"
          >
            {PERIOD_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer name or phone…"
              className="input pl-9"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-stone-100 rounded-lg p-0.5">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filter === tab.value
                    ? "bg-white text-stone-900 shadow-sm"
                    : "text-stone-500 hover:text-stone-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Customer Table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
            {filter === "outstanding" ? "Outstanding Credit" : "Credit Customers"}
            <span className="ml-2 text-xs font-normal text-stone-400">
              {customers.length}
            </span>
          </h2>
        </div>

        {customers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-200">
                <tr className="text-xs text-stone-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4 text-left font-medium">Customer</th>
                  <th className="py-2.5 px-4 text-left font-medium">Phone</th>
                  <th className="py-2.5 px-4 text-right font-medium">Udhaar</th>
                  <th className="py-2.5 px-4 text-right font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {customers.map((c) => (
                  <tr
                    key={c._id}
                    onClick={() => openCustomerDetail(c._id)}
                    className="hover:bg-brand-50/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-xs font-bold text-brand-700 shrink-0">
                          {(c.name || c.phone).charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-stone-900">
                          {c.name || "Unnamed"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-stone-500 tabular">{c.phone}</td>
                    <td
                      className={`py-3 px-4 text-right font-semibold tabular ${
                        c.outstanding > 0 ? "text-red-600" : "text-stone-400"
                      }`}
                    >
                      {c.outstanding > 0 ? formatRs(c.outstanding) : "—"}
                    </td>
                    <td className="py-3 px-4 text-right text-stone-500 text-xs">
                      {timeAgo(c.lastActivity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-stone-400">
            <HandCoins className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="text-sm">
              {search
                ? "No customers match your search"
                : filter === "outstanding"
                ? "No outstanding credit — great!"
                : "No credit customers found"}
            </p>
          </div>
        )}
      </div>

      {/* Bottom: Top Debtors + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Debtors */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
              Highest Outstanding
            </h3>
          </div>
          {topDebtors.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {topDebtors.map((d, i) => (
                <button
                  key={d._id}
                  onClick={() => openCustomerDetail(d._id)}
                  className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors"
                >
                  <span className="w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-stone-900 text-sm truncate block">
                      {d.name || d.phone}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-red-600 tabular">
                    {formatRs(d.outstanding)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-stone-400 text-sm">
              No outstanding credit
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
              Recent Credit Activity
            </h3>
          </div>
          {recentActivity.length > 0 ? (
            <div className="divide-y divide-stone-100">
              {recentActivity.map((entry) => {
                const isCredit = entry.type === "credit" || entry.type === "adjustment";
                return (
                  <button
                    key={entry._id}
                    onClick={() => openCustomerDetail(entry.customerId)}
                    className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        isCredit
                          ? "bg-red-50 text-red-600"
                          : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {isCredit ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-stone-900 text-sm block truncate">
                        {entry.customerName}
                      </span>
                      <span className="text-xs text-stone-400 capitalize">
                        {entry.type === "credit" ? "Credit Sale" : entry.type}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-semibold tabular ${
                          isCredit ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {isCredit ? "+" : "−"}
                        {formatRs(entry.amount)}
                      </span>
                      <div className="text-xs text-stone-400">
                        {timeAgo(entry.createdAt)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-stone-400 text-sm">
              No recent activity
            </div>
          )}
        </div>
      </div>

      {/* Loading detail overlay */}
      {loadingDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-white/60">
          <div className="card p-6 shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-stone-600">Loading customer details…</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────── Stat Card ─────────────────────────────── */

function StatCard({
  label,
  value,
  subtitle,
  icon,
  color,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  color: "red" | "amber" | "green" | "blue";
}) {
  const colors = {
    red: "text-red-600 bg-red-50",
    amber: "text-amber-600 bg-amber-50",
    green: "text-emerald-600 bg-emerald-50",
    blue: "text-blue-600 bg-blue-50",
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}
        >
          {icon}
        </div>
        <span className="text-xs text-stone-500 font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="text-xl font-bold text-stone-900 tabular">{value}</div>
      {subtitle && (
        <div className="text-xs text-stone-400 mt-0.5">{subtitle}</div>
      )}
    </div>
  );
}
