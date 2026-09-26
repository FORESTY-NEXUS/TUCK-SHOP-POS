"use client";

import { useEffect, useState } from "react";
import { UserPlus, RotateCcw, KeyRound, Ban } from "lucide-react";
import { toast } from "sonner";
import { PERMISSION_GROUPS, PERMISSION_LABELS, DEFAULT_PERMISSIONS, type Permission } from "@/lib/permissions";

type Role = "cashier" | "manager" | "admin";
type Account = {
  _id: string;
  name: string;
  role: Role;
  isActive: boolean;
  mustChangePin?: boolean;
  permissions?: Permission[];
};

export default function StaffAccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("cashier");
  const [pin, setPin] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/users");
      if (res.ok) setAccounts(await res.json());
    } catch { /* keep current list */ }
  }

  useEffect(() => {
    load();
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.user?.userId) setCurrentUserId(d.user.userId); })
      .catch(() => {});
  }, []);

  async function send(method: string, url: string, body?: unknown): Promise<boolean> {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return true;
    const data = await res.json().catch(() => ({}));
    toast.error(data.error || "Request failed");
    return false;
  }

  async function addAccount() {
    if (!name.trim() || !pin) return;
    if (await send("POST", "/api/users", { name: name.trim(), role, pin })) {
      toast.success("Staff account created. They will set their own PIN on first login.");
      setName(""); setPin(""); setRole("cashier");
      await load();
    }
  }

  async function changeRole(account: Account, newRole: Role) {
    const isSelf = account._id === currentUserId;
    if (isSelf) {
      const ok = window.confirm(
        newRole === "admin"
          ? "Give yourself the Admin role?"
          : `Change your OWN role to ${newRole}? If this removes admin access you may lose the ability to undo it.`
      );
      if (!ok) return;
    }
    if (await send("PATCH", `/api/users/${account._id}`, { role: newRole })) {
      toast.success("Role updated");
      await load();
    }
  }

  async function togglePermission(account: Account, perm: Permission) {
    const current = account.permissions ?? DEFAULT_PERMISSIONS[account.role];
    const next = current.includes(perm) ? current.filter((p: Permission) => p !== perm) : [...current, perm];
    if (await send("PATCH", `/api/users/${account._id}`, { permissions: next })) {
      await load();
    }
  }

  async function setActive(id: string, active: boolean) {
    if (await send("PATCH", `/api/users/${id}`, { isActive: active })) {
      toast.success(active ? "Account activated" : "Account deactivated");
      await load();
    }
  }

  async function resetPin(id: string, who: string) {
    const newPin = window.prompt(`Temporary PIN for ${who} (4-6 digits). They must change it on next login.`);
    if (!newPin) return;
    if (await send("PATCH", `/api/users/${id}`, { resetPin: newPin })) {
      toast.success("PIN reset. They must set a new PIN on next login.");
      await load();
    }
  }

  const active = accounts.filter((a) => a.isActive);
  const inactive = accounts.filter((a) => !a.isActive);

  function Row({ a }: { a: Account }) {
    const isSelf = a._id === currentUserId;
    const perms = a.permissions ?? DEFAULT_PERMISSIONS[a.role];
    const isExpanded = expandedId === a._id;
    const grantedCount = a.role === "admin" ? "all" : perms.length;

    return (
      <div className={`card px-4 py-3 ${a.isActive ? "" : "opacity-60"}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <div className="font-medium text-stone-900">
              {a.name}
              {isSelf && <span className="ml-2 text-xs text-brand-600 font-normal">(You)</span>}
            </div>
            {a.mustChangePin && <div className="text-xs text-amber-600">PIN change required</div>}
          </div>
          <select
            value={a.role}
            onChange={(e) => changeRole(a, e.target.value as Role)}
            className="input w-32"
            disabled={!a.isActive}
          >
            <option value="cashier">Cashier</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          {a.role !== "admin" && (
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : a._id)}
              className="text-xs text-brand-700 hover:underline"
            >
              Permissions ({grantedCount}) {isExpanded ? "▲" : "▼"}
            </button>
          )}
          <button onClick={() => resetPin(a._id, a.name)} className="btn-secondary text-xs flex items-center gap-1">
            <KeyRound className="w-3 h-3" /> Reset PIN
          </button>
          {a.isActive ? (
            isSelf ? (
              <span className="text-xs text-stone-400" title="You can't deactivate your own account">
                <Ban className="w-3 h-3 inline mr-1" /> Deactivate
              </span>
            ) : (
              <button onClick={() => setActive(a._id, false)} className="text-amber-600 hover:text-amber-700 text-xs font-medium flex items-center gap-1">
                <Ban className="w-3 h-3" /> Deactivate
              </button>
            )
          ) : (
            <button onClick={() => setActive(a._id, true)} className="btn-secondary text-xs flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Activate
            </button>
          )}
        </div>

        {a.role === "admin" && (
          <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-400">
            Admins always have full access.
          </div>
        )}

        {a.role !== "admin" && isExpanded && a.isActive && (
          <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.key}>
                <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.permissions.map((perm) => (
                    <label key={perm} className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={perms.includes(perm as Permission)}
                        onChange={() => togglePermission(a, perm as Permission)}
                        className="rounded border-stone-300"
                      />
                      {PERMISSION_LABELS[perm as Permission]}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">Add Staff Account</h2>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-stone-500 mb-1">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="input" />
          </div>
          <div className="w-36">
            <label className="block text-xs text-stone-500 mb-1">Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value as Role)} className="input">
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="w-36">
            <label className="block text-xs text-stone-500 mb-1">Starting PIN</label>
            <input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4-6 digits" className="input" />
          </div>
          <button onClick={addAccount} disabled={!name.trim() || !pin} className="btn-primary">
            <UserPlus className="w-4 h-4" /> Add
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2">
          New Cashier and Manager accounts get sensible defaults. Click "Permissions" on any account below to fine-tune exactly what they can do.
        </p>
      </div>

      <div className="space-y-2">
        {active.map((a) => <Row key={a._id} a={a} />)}
        {active.length === 0 && <p className="text-stone-400 text-sm">No active staff accounts.</p>}
      </div>

      {inactive.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">Deactivated</h2>
          <div className="space-y-2">
            {inactive.map((a) => <Row key={a._id} a={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}
