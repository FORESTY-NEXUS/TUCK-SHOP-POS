"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { FRONTEND_SESSION_COOKIE, FRONTEND_SESSION_STORAGE_KEY } from "@/lib/frontend-auth";
import {
  ShoppingCart,
  LayoutGrid,
  Clock,
  PieChart,
  ListFilter,
  Package,
  HandCoins,
  Settings,
  ArrowRight,
  LogOut,
} from "lucide-react";

type ModuleTile = {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
  primary?: boolean;
};

const modules: ModuleTile[] = [
  { href: "/pos", icon: ShoppingCart, title: "POS Counter", description: "Take orders, manage carts, process payments.", primary: true },
  { href: "/dashboard", icon: LayoutGrid, title: "Dashboard", description: "See all the useful business data and insights." },
  { href: "/orders", icon: Clock, title: "Order History", description: "Browse all orders, search and filter easily." },
  { href: "/reports", icon: PieChart, title: "Sales Reports", description: "Revenue, top items, payment breakdown." },
  { href: "/admin/products", icon: Package, title: "Products", description: "Menu items, variants, pricing, availability." },
  { href: "/admin/udhaar", icon: HandCoins, title: "Udhaar", description: "Customer credit, payments and ledger." },
  { href: "/admin/settings", icon: Settings, title: "Settings", description: "Loyalty, printer, speed dial configuration." },
];

export default function Home() {
  const { user } = useSession();
  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "N";
  const userRole = user?.role || "Admin";
  const clearFrontendSession = () => {
    localStorage.removeItem(FRONTEND_SESSION_STORAGE_KEY);
    document.cookie = `${FRONTEND_SESSION_COOKIE}=; path=/; max-age=0; samesite=lax`;
  };

  return (
    <div className="h-dvh overflow-hidden bg-stone-100 flex flex-col font-sans text-stone-900 w-full">
      {/* Top Navbar */}
      <header className="bg-white border-b border-stone-200 px-8 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <img src="/branding/sevesto-mark.svg" alt="Sevesto" className="w-9 h-9 object-contain shrink-0" />
          <div>
            <div className="font-bold text-stone-900 text-sm leading-tight font-brand">Sevesto POS</div>
            <div className="text-xs text-stone-400 leading-tight">Made by foresty</div>
          </div>
        </div>

        <Link
          href="/login"
          onClick={clearFrontendSession}
          className="flex items-center gap-2 text-xs font-medium text-stone-500 hover:text-stone-900 px-3 py-2 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4 text-stone-400" />
          <span>Log out</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="home-scrollbar min-h-0 flex-1 overflow-y-auto w-full">
        <div className="py-12 px-6 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <img src="/branding/sevesto-logo.svg" alt="Sevesto POS" className="h-12 mx-auto mb-5 object-contain" />
          <span className="text-xs font-semibold tracking-wider text-brand-700 uppercase mb-2 block">WELCOME</span>
          <p className="text-stone-500 mt-1 text-sm sm:text-base">Made by foresty — choose a module to get started.</p>
          <div className="w-10 h-0.5 bg-brand-300 mx-auto mt-4 rounded-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className={`group relative p-5 rounded-2xl border transition-all duration-150 flex flex-col justify-between min-h-[170px] ${
                module.primary
                  ? "bg-brand-600 border-brand-600 text-white hover:bg-brand-700"
                  : "bg-white border-stone-200 text-stone-900 hover:border-brand-300"
              }`}
            >
              <div>
                <div className="flex items-start gap-3.5 mb-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    module.primary ? "bg-white/15 text-white" : "bg-brand-50 text-brand-700"
                  }`}>
                    <module.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className={`font-bold text-base truncate ${module.primary ? "text-white" : "text-stone-900"}`}>{module.title}</h3>
                  </div>
                </div>
                <p className={`text-xs leading-relaxed ${module.primary ? "text-brand-50" : "text-stone-500"}`}>{module.description}</p>
              </div>

              <div className={`mt-4 flex items-center justify-end text-xs font-semibold ${
                module.primary ? "text-white" : "text-brand-700"
              }`}>
                <span>Open</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white/60">
        <div className="px-8 py-4 flex items-center justify-between text-xs text-stone-400">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-stone-800 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {userInitial}
            </div>
            <div>
              <span className="text-[11px] text-stone-400 block leading-tight">Logged in as</span>
              <span className="font-bold text-stone-900 text-xs block leading-tight capitalize">{userRole}</span>
            </div>
          </div>

          <div>
            Sevesto POS made by{" "}
            <a
              href="https://foresty-nexus.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-500  font-bold hover:text-brand-800 underline underline-offset-2 transition-colors"
            >
              FORESTY
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
