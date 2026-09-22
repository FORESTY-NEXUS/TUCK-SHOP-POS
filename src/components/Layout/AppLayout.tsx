"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import Sidebar from "./Sidebar";
import { LayoutGrid, Maximize2, Minimize2 } from "lucide-react";
import { useFullscreen } from "@/hooks/useFullscreen";

export default function AppLayout({ children, headerMiddleContent }: { children: React.ReactNode; headerMiddleContent?: React.ReactNode }) {
  const { user } = useSession();
  const { isFullscreen, toggleFullscreen } = useFullscreen();

  return (
    <Sidebar>
      <div className="flex flex-col h-full">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-[23px] flex items-center justify-between shrink-0">
          {/* Left: back to home */}
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brand-700 transition-colors group"
          >
            <LayoutGrid className="w-4 h-4 group-hover:scale-110 transition-transform" />
            <span>Home</span>
          </Link>

          {headerMiddleContent && (
            <div className="flex-1 flex justify-center mx-4">
              {headerMiddleContent}
            </div>
          )}

          {/* Right: user info + fullscreen toggle */}
          <div className="text-sm text-gray-500 flex items-center gap-4">
            {user?.name && <span className="text-gray-900 font-medium">{user.name}</span>}
            {user?.role && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-sm capitalize">
                {user.role}
              </span>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors flex items-center justify-center"
              title={isFullscreen ? "Exit fullscreen (F11)" : "Enter fullscreen (F11)"}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-5 h-5" />
              ) : (
                <Maximize2 className="w-5 h-5" />
              )}
            </button>
          </div>
        </header>
        {/* Page content */}
        <div className="flex-1 min-h-0 w-full overflow-auto">{children}</div>
      </div>
    </Sidebar>
  );
}
