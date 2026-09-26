"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FRONTEND_SESSION_COOKIE,
  FRONTEND_SESSION_STORAGE_KEY,
} from "@/lib/frontend-auth";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  async function submitPin(value: string) {
    if (submitting || submittedRef.current) return;
    const candidate = value.trim();
    if (!candidate) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      
      if (!res.ok) {
        setError("Incorrect PIN");
        setPin("");
        setSubmitting(false);
        return;
      }
      
      submittedRef.current = true;
      localStorage.setItem(FRONTEND_SESSION_STORAGE_KEY, "true");
      document.cookie = `${FRONTEND_SESSION_COOKIE}=true; path=/; max-age=43200; samesite=lax`;
      const requestedPath = searchParams.get("next");
      router.push(requestedPath?.startsWith("/") ? requestedPath : "/");
      router.refresh();
    } catch {
      setError("Cannot reach server");
      setPin("");
      setSubmitting(false);
    }
  }

  function tap(digit: string) {
    if (submitting) return;
    const next = (pin + digit).slice(0, 6);
    setPin(next);
    if (next.length === 4) submitPin(next);
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (submitting) return;
      if (e.key >= "0" && e.key <= "9") {
        tap(e.key);
      } else if (e.key === "Backspace") {
        setPin((p) => p.slice(0, -1));
      } else if (e.key === "Delete" || e.key === "Escape") {
        setPin("");
      } else if (e.key === "Enter") {
        if (pin.length > 0) submitPin(pin);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pin, submitting]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <img src="/branding/sevesto-mark.svg" alt="Sevesto" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-stone-900 font-brand">Sevesto POS</h1>
          <p className="text-sm text-stone-500 mt-1">Made by foresty</p>
        </div>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full transition-all duration-150 ${
                pin.length > i ? "bg-brand-600 scale-110" : "bg-stone-200 border border-stone-300"
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-center">
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              disabled={submitting}
              onClick={() => tap(d)}
              className="h-14 rounded-xl bg-white border border-stone-200 text-lg font-semibold text-stone-900 hover:bg-stone-50 hover:border-stone-300 active:bg-stone-100 disabled:opacity-40 transition-colors shadow-sm"
            >
              {d}
            </button>
          ))}
          <button
            disabled={submitting}
            onClick={() => setPin("")}
            className="h-14 rounded-xl bg-white border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40 transition-colors shadow-sm"
          >
            Clear
          </button>
          <button
            disabled={submitting}
            onClick={() => tap("0")}
            className="h-14 rounded-xl bg-white border border-stone-200 text-lg font-semibold text-stone-900 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40 transition-colors shadow-sm"
          >
            0
          </button>
          <button
            disabled={submitting}
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="h-14 rounded-xl bg-white border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 active:bg-stone-100 disabled:opacity-40 transition-colors shadow-sm"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
