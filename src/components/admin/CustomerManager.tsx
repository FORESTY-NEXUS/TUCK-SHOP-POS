"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

type Customer = {
  _id: string;
  name?: string;
  phone: string;
  loyaltyPoints: number;
  lastAddress?: string;
  createdAt?: string;
};

export default function CustomerManager({ initialCustomers }: { initialCustomers: Customer[] }) {
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const filteredCustomers = customers
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (c.name?.toLowerCase().includes(q)) || c.phone.includes(q);
    })
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  async function reload() {
    try {
      const res = await fetch("/api/customers");
      if (res.ok) setCustomers(await res.json());
    } catch { /* keep */ }
  }

  async function loadCustomerHistory(customerId: string) {
    setSelectedCustomer(customerId);
    try {
      const res = await fetch(`/api/orders/history?range=all&customerId=${encodeURIComponent(customerId)}`);
      if (res.ok) {
        const d = await res.json();
        setOrderHistory(d.orders || []);
      }
    } catch {
      setOrderHistory([]);
    }
  }

  async function addCustomer() {
    if (!newPhone.trim()) return;
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
      await reload();
    } else {
      toast.error("Failed to create customer");
    }
  }

  async function deleteCustomer(id: string) {
    if (!confirm("Delete this customer? This cannot be undone.")) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Customer deleted");
      if (selectedCustomer === id) { setSelectedCustomer(null); setOrderHistory([]); }
      await reload();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Delete failed");
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-stone-500">{filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary">+ Add Customer</button>
      </div>

      <div className="card p-4 mb-6">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone..." className="input max-w-md" />
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
            <button onClick={addCustomer} disabled={!newPhone.trim()} className="btn-primary">Save Customer</button>
            <button onClick={() => setShowAddForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
            <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">All Customers</h2>
          </div>
          <div className="divide-y divide-stone-100 max-h-[70vh] overflow-y-auto">
            {filteredCustomers.map((c) => {
              const isGuest = c.phone === "0000000000";
              const isSelected = selectedCustomer === c._id;
              return (
                <button
                  key={c._id}
                  onClick={() => loadCustomerHistory(c._id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-stone-50 transition-colors ${
                    isSelected ? "bg-brand-50" : ""
                  } ${isGuest ? "opacity-60" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0 ${
                    isGuest ? "bg-stone-100 text-stone-400" : "bg-brand-100 text-brand-700"
                  }`}>
                    {(c.name || c.phone).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-stone-900 truncate">{c.name || "Guest"}</span>
                      {isGuest && <span className="text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded font-medium shrink-0">Walk-in</span>}
                    </div>
                    <div className="text-sm text-stone-500 tabular">{c.phone}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium text-brand-700 tabular">{c.loyaltyPoints} pts</div>
                  </div>
                </button>
              );
            })}
            {filteredCustomers.length === 0 && (
              <div className="py-12 text-center text-stone-400">No customers found</div>
            )}
          </div>
        </div>

        <div>
          {selectedCustomer ? (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Customer Details</h2>
                <button onClick={() => { setSelectedCustomer(null); setOrderHistory([]); }} className="text-xs text-stone-500 hover:text-stone-700">Close</button>
              </div>
              {(() => {
                const customer = customers.find((c) => c._id === selectedCustomer);
                if (!customer) return null;
                const isGuest = customer.phone === "0000000000";
                return (
                  <>
                    <div className="p-4">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-medium ${
                          isGuest ? "bg-stone-100 text-stone-400" : "bg-brand-100 text-brand-700"
                        }`}>
                          {(customer.name || customer.phone).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-stone-900 text-base">{customer.name || "Guest"}</div>
                          <div className="text-sm text-stone-500 tabular">{customer.phone}</div>
                          {customer.lastAddress && <div className="text-xs text-stone-400 mt-0.5">{customer.lastAddress}</div>}
                          {isGuest && (
                            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded mt-1 inline-block">Walk-in (no loyalty)</div>
                          )}
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-2xl font-bold text-brand-700 tabular">{customer.loyaltyPoints}</div>
                          <div className="text-xs text-stone-400">loyalty points</div>
                        </div>
                      </div>
                      {!isGuest && (
                        <button onClick={() => deleteCustomer(selectedCustomer)} className="text-sm text-red-600 hover:text-red-800 font-medium">Delete Customer</button>
                      )}
                    </div>
                    {orderHistory.length > 0 ? (
                      <div className="border-t border-stone-200">
                        <div className="px-4 py-2 bg-stone-50 border-b border-stone-200">
                          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Order History</h3>
                        </div>
                        <div className="divide-y divide-stone-100 max-h-96 overflow-y-auto">
                          {orderHistory.map((o) => (
                            <div key={o._id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                              <div>
                                <span className="font-medium text-stone-900 tabular">{o.orderNumber}</span>
                                <span className="text-stone-400 mx-2">·</span>
                                <span className="text-stone-500 capitalize">{o.type?.replace("_", " ")}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium text-stone-900 tabular">Rs. {Number(o.total).toFixed(2)}</span>
                                <div className="text-xs text-stone-400">{o.status?.replace(/_/g, " ")}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="border-t border-stone-200 p-4 text-center text-sm text-stone-400">No orders yet</div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : (
            <div className="card p-12 text-center text-stone-400">
              <Users className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p className="text-sm">Select a customer to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
