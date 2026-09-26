"use client";

import { useState } from "react";
import { UserPlus, UserCog, Bike, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

type StaffMember = { _id: string; name: string; role: "waiter" | "rider"; phone?: string; isActive?: boolean };

export default function StaffManager({ initialStaff }: { initialStaff: StaffMember[] }) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<"waiter" | "rider">("waiter");

  async function reload() {
    try {
      const res = await fetch("/api/staff?includeInactive=1");
      if (res.ok) setStaff(await res.json());
    } catch { /* keep */ }
  }

  async function addStaff() {
    if (!name.trim()) return;
    const res = await fetch("/api/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), role, phone: phone.trim() || undefined }),
    });
    if (res.ok) {
      const s = await res.json();
      setStaff((prev) => [...prev, s]);
      setName(""); setPhone("");
      toast.success("Staff added");
    } else {
      toast.error("Failed to add staff");
    }
  }

  async function setActive(id: string, active: boolean) {
    const res = await fetch(`/api/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: active }),
    });
    if (res.ok) {
      toast.success(active ? "Staff activated" : "Staff deactivated");
      await reload();
    } else {
      toast.error("Update failed");
    }
  }

  async function hardDelete(id: string, name_: string) {
    if (!confirm(`Permanently delete "${name_}"? Past orders referencing them will show a blank name.`)) return;
    const res = await fetch(`/api/staff/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Staff deleted");
      await reload();
    } else {
      toast.error("Delete failed");
    }
  }

  const active = staff.filter((s) => s.isActive !== false);
  const deactivated = staff.filter((s) => s.isActive === false);

  function MemberCard({ s, deactivatedItem }: { s: StaffMember; deactivatedItem?: boolean }) {
    return (
      <div key={s._id} data-testid={`staff-card-${s._id}`} className={`card px-4 py-3 flex items-center gap-3 ${deactivatedItem ? "opacity-60" : ""}`}>
        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-sm font-medium text-brand-700 shrink-0">
          {s.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-stone-900 truncate">{s.name}</div>
          {s.phone && <div className="text-sm text-stone-500 tabular">{s.phone}</div>}
        </div>
        {deactivatedItem ? (
          <button onClick={() => setActive(s._id, true)} className="btn-secondary text-xs flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Activate
          </button>
        ) : (
          <button onClick={() => setActive(s._id, false)} className="text-amber-600 hover:text-amber-700 text-xs font-medium">
            Deactivate
          </button>
        )}
        <button onClick={() => hardDelete(s._id, s.name)} className="text-red-400 hover:text-red-600 text-xs font-medium flex items-center gap-1" title="Permanently delete">
          <Trash2 className="w-3 h-3" /> Delete
        </button>
      </div>
    );
  }

  function RoleSection({ r }: { r: "waiter" | "rider" }) {
    const roleLabel = r === "waiter" ? "Waiters" : "Riders";
    const Icon = r === "waiter" ? UserCog : Bike;
    const members = active.filter((s) => s.role === r);
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center"><Icon className="w-4 h-4" /></div>
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">
            {roleLabel}
            <span className="ml-2 text-xs font-normal text-stone-400">{members.length}</span>
          </h2>
        </div>
        <div className="space-y-2">
          {members.length > 0 ? members.map((s) => <MemberCard key={s._id} s={s} />) : (
            <div className="card border-dashed px-4 py-8 text-center">
              <p className="text-stone-400 text-sm">No active {roleLabel.toLowerCase()}s</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Add Staff Member</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-stone-500 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="input" onKeyDown={(e) => { if (e.key === "Enter") addStaff(); }} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-stone-500 mb-1">Phone <span className="text-stone-400">(optional)</span></label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contact number" className="input" />
          </div>
          <div className="w-36">
            <label className="block text-xs text-stone-500 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as "waiter" | "rider")} className="input">
              <option value="waiter">Waiter</option>
              <option value="rider">Rider</option>
            </select>
          </div>
          <button onClick={addStaff} disabled={!name.trim()} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RoleSection r="waiter" />
        <RoleSection r="rider" />
      </div>

      {deactivated.length > 0 && (
        <div className="mt-8" data-testid="deactivated-section">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">
            Deactivated
            <span className="ml-2 text-xs font-normal text-stone-400">{deactivated.length}</span>
          </h2>
          <div className="space-y-2">
            {deactivated.map((s) => <MemberCard key={s._id} s={s} deactivatedItem />)}
          </div>
        </div>
      )}
    </div>
  );
}
