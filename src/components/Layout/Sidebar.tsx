"use client";

import { useSyncExternalStore } from "react";
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
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pos", label: "POS Cockpit", icon: ShoppingCart },
  { href: "/orders", label: "Order History", icon: Clock },
  { href: "/reports", label: "Sales Reports", icon: PieChart },
  { href: "/reports/shifts", label: "Shift History", icon: ClipboardList },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/admin/categories", label: "Categories", icon: ListTree },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/udhaar", label: "Udhaar", icon: HandCoins },
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
  const isCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarCollapsedPreference,
    () => false,
  );

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
          {navItems.map((item) => (
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

          <Link
            href="/login"
            onClick={clearFrontendSession}
            title={isCollapsed ? "Log out" : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-stone-500 hover:bg-red-50 hover:text-red-600 transition-colors ${
              isCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!isCollapsed && <span>Log out</span>}
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 w-full h-full overflow-auto">{children}</div>
    </div>
  );
}
