"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface Customer {
  _id: string;
  name?: string;
  phone: string;
  loyaltyPoints: number;
  lastAddress?: string;
  createdAt?: string;
}

type OrderEntry = {
  _id: string;
  saleNumber: string;
  total: number;
  status?: string;
  createdAt: string;
  paymentMethod?: string;
  returnedAmount?: number;
};

type Props = {
  initialCustomers: Customer[];
  initialSelectedCustomer: Customer | null;
  initialOrderHistory: OrderEntry[];
};

export default function CustomersClient({
  initialCustomers,
  initialSelectedCustomer,
  initialOrderHistory,
}: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialSelectedCustomer);
  const [orderHistory, setOrderHistory] = useState<OrderEntry[]>(initialOrderHistory);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [editModalFor, setEditModalFor] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");

  // Live directory — keep it fresh after mutations.
  async function reloadCustomers() {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) setCustomers(await res.json());
    } catch { /* keep */ }
  }

  async function loadHistory(customerId: string) {
    try {
      const res = await fetch(`/api/sales/history?range=all&customerId=${encodeURIComponent(customerId)}`);
      if (res.ok) {
        const d = await res.json();
        setOrderHistory(d.orders || []);
      }
    } catch { /* keep */ }
  }

  function selectCustomer(customer: Customer) {
    setSelectedCustomer(customer);
    loadHistory(customer._id);
    router.push("/customers?customerId=" + customer._id, { scroll: false });
  }

  function backToList() {
    setSelectedCustomer(null);
    setOrderHistory([]);
    router.push("/customers", { scroll: false });
  }

  async function addCustomer() {
    if (!newPhone.trim() || submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, string> = { phone: newPhone.trim() };
      if (newName.trim()) payload.name = newName.trim();
      if (newAddress.trim()) payload.lastAddress = newAddress.trim();
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Customer created");
        setNewName(""); setNewPhone(""); setNewAddress("");
        setShowAddForm(false);
        await reloadCustomers();
      } else {
        toast.error("Failed to create customer");
      }
    } catch {
      toast.error("Cannot reach the server");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteCustomer(id: string) {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Customer deleted");
        if (selectedCustomer?._id === id) backToList();
        await reloadCustomers();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || "Delete failed");
      }
    } catch {
      toast.error("Cannot reach the server");
    }
  }

  function openEditModal(customer: Customer) {
    setEditModalFor(customer._id);
    setEditName(customer.name || "");
    setEditPhone(customer.phone);
    setEditAddress(customer.lastAddress || "");
  }

  async function saveEdit() {
    if (!editModalFor || !editPhone.trim()) return;
    try {
      const payload: Record<string, string> = { phone: editPhone.trim() };
      if (editName.trim()) payload.name = editName.trim();
      if (editAddress.trim()) payload.lastAddress = editAddress.trim();
      const res = await fetch(`/api/customers/${editModalFor}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        toast.success("Customer updated");
        setEditModalFor(null);
        await reloadCustomers();
        if (selectedCustomer?._id === editModalFor) {
          const updated = await res.json();
          setSelectedCustomer(updated);
        }
      } else {
        const d = await res.json().catch(() => ({}));
        const err = typeof d.error === "object" ? JSON.stringify(d.error) : d.error;
        toast.error(err || "Update failed");
      }
    } catch {
      toast.error("Cannot reach the server");
    }
  }

  const filtered = customers.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (c.name?.toLowerCase().includes(q)) || c.phone.includes(q);
  });

  const isGuest = (phone: string) => phone === "0000000000";

  return (
    <div className="px-6 py-8 w-full">
      {selectedCustomer ? (
        <div>
          <button onClick={backToList} className="mb-4 text-sm text-brand-700 hover:text-brand-800 font-medium">← Back to all customers</button>
          <div className="card p-6 mb-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-stone-900">{selectedCustomer.name || "Guest"}</h2>
                  {isGuest(selectedCustomer.phone) && (
                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Walk-in (no loyalty)</span>
                  )}
                </div>
                <p className="text-sm text-stone-500 mt-1">{selectedCustomer.phone}</p>
                {selectedCustomer.lastAddress && (
                  <p className="text-sm text-stone-500 mt-1">{selectedCustomer.lastAddress}</p>
                )}
                {!isGuest(selectedCustomer.phone) && (
                  <button onClick={() => openEditModal(selectedCustomer)} className="mt-3 btn-secondary text-xs">Edit</button>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-brand-700 tabular">{selectedCustomer.loyaltyPoints}</div>
                <div className="text-xs text-stone-500 uppercase tracking-wide mt-1">Loyalty Points</div>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200">
              <h3 className="text-sm font-semibold text-stone-900">Order History</h3>
            </div>
            {orderHistory.length > 0 ? (
              <div className="divide-y divide-stone-100">
                {orderHistory.map((entry) => (
                  <div key={entry._id} className="px-6 py-4 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-stone-900">Sale {entry.saleNumber}</span>
                        <span className="text-xs text-stone-400">{new Date(entry.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="text-sm text-stone-500 mt-0.5 capitalize">
                        {(entry.paymentMethod || "").replace("_", " ")}
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">{entry.status?.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-stone-900 tabular">Rs. {Number(entry.total).toFixed(2)}</div>
                      {(entry.returnedAmount ?? 0) > 0 && (
                        <div className="text-xs text-red-600 tabular">returned Rs. {Number(entry.returnedAmount).toFixed(2)}</div>
                      )}
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
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 font-brand">Customers</h1>
              <p className="text-sm text-stone-500 mt-0.5">{customers.length} customers in directory</p>
            </div>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">+ Add Customer</button>
          </div>

          {showAddForm && (
            <div className="card p-4 mb-6">
              <h2 className="text-sm font-semibold text-stone-900 mb-3">New Customer</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (optional)" className="input" />
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone (required)" className="input" />
                <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Address (optional)" className="input" />
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={addCustomer} disabled={submitting || !newPhone.trim()} className="btn-primary">
                  {submitting ? "Saving…" : "Save Customer"}
                </button>
                <button onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center gap-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone…"
                className="input max-w-md"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr className="text-xs text-stone-500 uppercase tracking-wider">
                    <th className="py-3 px-4 font-medium">Name</th>
                    <th className="py-3 px-4 font-medium">Phone</th>
                    <th className="py-3 px-4 font-medium">Loyalty Points</th>
                    <th className="py-3 px-4 font-medium">Address</th>
                    <th className="py-3 px-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c._id} className="border-b border-stone-100 hover:bg-stone-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-stone-900">{c.name || "—"}</span>
                        {isGuest(c.phone) && (
                          <span className="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Walk-in</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-stone-600 tabular">{c.phone}</td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-100 text-brand-800 tabular">
                          {c.loyaltyPoints} pts
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-500 text-sm truncate max-w-[220px]">{c.lastAddress || "—"}</td>
                      <td className="py-3 px-4">
                        <div className="flex gap-3">
                          <button onClick={() => selectCustomer(c)} className="text-brand-700 hover:text-brand-800 text-sm font-medium">View History</button>
                          {!isGuest(c.phone) && (
                            <>
                              <button onClick={() => openEditModal(c)} className="text-amber-600 hover:text-amber-700 text-sm font-medium">Edit</button>
                              <button onClick={() => deleteCustomer(c._id)} className="text-red-500 hover:text-red-700 text-sm">Delete</button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={5} className="py-12 text-center text-stone-400">No customers found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {editModalFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-stone-900 mb-4">Edit Customer</h2>
            <div className="space-y-3">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name (optional)" className="input" />
              <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone (required)" className="input" />
              <input value={editAddress} onChange={(e) => setEditAddress(e.target.value)} placeholder="Delivery address (optional)" className="input" />
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setEditModalFor(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} disabled={!editPhone.trim()} className="btn-primary">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
