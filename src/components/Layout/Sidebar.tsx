"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FRONTEND_SESSION_COOKIE, FRONTEND_SESSION_STORAGE_KEY } from "@/lib/frontend-auth";
import {
  LayoutDashboard,
  ShoppingCart,
  Clock,
  PieChart,
  ClipboardList,
  Users,
  ListTree,
  Package,
  HandCoins,
  Settings,
  Info,
  LogOut,
  ChevronLeft,
  ChevronRight,
  KeyRound,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS Cockpit", icon: ShoppingCart },
  { href: "/orders", label: "Order History", icon: Clock },
  { href: "/reports", label: "Sales Reports", icon: PieChart },
  { href: "/reports/shifts", label: "Shift History", icon: ClipboardList },
  { href: "/admin/categories", label: "Categories", icon: ListTree },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/udhaar", label: "Udhaar", icon: HandCoins },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/about", label: "About Us", icon: Info },
];

const SIDEBAR_COLLAPSED_STORAGE_KEY = "sevesto-pos:sidebar-collapsed";
const SIDEBAR_COLLAPSED_CHANGE_EVENT = "sevesto-pos:sidebar-collapsed-change";

function clearFrontendSession() {
  localStorage.removeItem(FRONTEND_SESSION_STORAGE_KEY);
  document.cookie = `${FRONTEND_SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_COLLAPSED_CHANGE_EVENT, onStoreChange);
  };
}

function getSidebarCollapsedPreference() {
  return localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      } ${collapsed ? "justify-center px-0" : ""}`}
    >
      <Icon className={`w-5 h-5 shrink-0 ${active ? "text-white" : "text-stone-400"}`} />
      {!collapsed && <span>{label}</span>}
    </Link>
  );
}

function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={`py-4 border-b border-stone-200 ${collapsed ? "px-0 flex justify-center" : "px-5"}`}>
      <Link href="/" className="flex items-center gap-3">
        <div className="w-9 h-9 flex items-center justify-center shrink-0">
          <img src="/branding/sevesto-mark.svg" alt="Sevesto" className="w-9 h-9 object-contain" />
        </div>
        {!collapsed && (
          <div>
            <div className="font-semibold text-stone-900 text-sm leading-tight font-brand">Sevesto POS</div>
            <div className="text-xs text-stone-400">Made by foresty</div>
          </div>
        )}
      </Link>
    </div>
  );
}

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  async function handleLogout() {
    // This is the ONLY thing that actually clears the real (httpOnly) session
    // cookie -- clearFrontendSession() only touches a separate legacy cookie.
    // Without this call, the session stays valid and simply navigating back
    // to e.g. /pos would silently resume the previous person's session.
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* still navigate to /login even if the request fails */ }
    clearFrontendSession();
    // Full reload, not router.push -- clears all client state for the next person.
    window.location.href = "/login";
  }
  const [udhaarEnabled, setUdhaarEnabled] = useState(true);
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s && s.udhaarEnabled === false) setUdhaarEnabled(false); })
      .catch(() => {});
  }, []);
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarCollapsedPreference,
    () => false,
  );

  const [pinModalOpen, setPinModalOpen] = useState(false);

  const toggleCollapsed = () => {
    localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(!isCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_COLLAPSED_CHANGE_EVENT));
  };

  return (
    <div className="flex h-screen w-full bg-stone-50">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-stone-200 flex flex-col shrink-0 transition-all duration-200 ${
          isCollapsed ? "w-16" : "w-56"
        }`}
      >
        <Logo collapsed={isCollapsed} />

        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.filter((item) => udhaarEnabled || item.href !== "/admin/udhaar").map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              collapsed={isCollapsed}
              active={pathname === item.href}
            />
          ))}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-stone-100 space-y-1">
          <button
            onClick={toggleCollapsed}
            title={isCollapsed ? "Expand" : "Collapse"}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5 shrink-0 text-stone-400" />
            ) : (
              <ChevronLeft className="w-5 h-5 shrink-0 text-stone-400" />
            )}
            {!isCollapsed && <span>Collapse</span>}
          </button>

          <button
            type="button"
            onClick={() => setPinModalOpen(true)}
            title={isCollapsed ? "Change PIN" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <KeyRound className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Change PIN</span>}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title={isCollapsed ? "Log out" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 w-full h-full overflow-auto">{children}</div>

      {pinModalOpen && <ChangePinModal onClose={() => setPinModalOpen(false)} />}
    </div>
  );
}

function ChangePinModal({ onClose }: { onClose: () => void }) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    if (!/^\d{4,6}$/.test(newPin)) return setError("New PIN must be 4-6 digits");
    if (newPin !== confirmPin) return setError("New PIN and confirmation do not match");
    setSubmitting(true);
    try {
      const res = await fetch("/api/settings/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (res.ok) {
        setSuccess(true);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not change PIN");
    } catch {
      setError("Cannot reach the server");
    }
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        {success ? (
          <div>
            <h2 className="text-lg font-bold text-stone-900 mb-2">PIN changed</h2>
            <p className="text-sm text-stone-500 mb-4">Use your new PIN next time you log in.</p>
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h2 className="text-lg font-bold text-stone-900">Change your PIN</h2>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Current PIN</label>
              <input type="password" inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} className="input" autoComplete="off" autoFocus />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">New PIN (4-6 digits)</label>
              <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} className="input" autoComplete="off" />
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Confirm new PIN</label>
              <input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className="input" autoComplete="off" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
