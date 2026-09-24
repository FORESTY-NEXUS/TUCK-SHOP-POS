"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Play, Square, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

type ShiftInfo = {
  _id: string;
  openingBalance?: number;
  openingCash?: number;
  openedAt: string;
  cashier?: { name?: string };
  cashierName?: string;
  isOpen?: boolean;
  orderCount?: number;
} | null;

type CloseSummary = {
  expectedCash: number;
  actualCash: number;
  difference: number;
  cashCollected?: number;
  cashRefunded?: number;
} | null;

type ButtonBaseStyles = {
  backgroundColor: string;
  boxShadow: string;
  transform: string;
  transformOrigin: string;
  computedBoxShadow: string;
};

export default function ShiftBar() {
  const [shift, setShift] = useState<ShiftInfo>(null);
  const [loaded, setLoaded] = useState(false);
  const [showOpen, setShowOpen] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [summary, setSummary] = useState<CloseSummary>(null);
  const [busy, setBusy] = useState(false);
  const startShiftButtonRef = useRef<HTMLButtonElement>(null);
  const attentionTimeline = useRef<gsap.core.Timeline | null>(null);
  const startShiftBaseStyles = useRef<ButtonBaseStyles | null>(null);

  useEffect(() => {
    const drawAttentionToStart = () => {
      const button = startShiftButtonRef.current;
      if (!button) return;

      if (!startShiftBaseStyles.current) {
        startShiftBaseStyles.current = {
          backgroundColor: button.style.backgroundColor,
          boxShadow: button.style.boxShadow,
          transform: button.style.transform,
          transformOrigin: button.style.transformOrigin,
          computedBoxShadow: window.getComputedStyle(button).boxShadow,
        };
      }
      const baseStyles = startShiftBaseStyles.current;
      attentionTimeline.current?.kill();
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Reset only the properties controlled by this timeline before replaying it.
      gsap.set(button, {
        x: 0,
        scale: 1,
        backgroundColor: "#226b49",
        boxShadow: baseStyles.computedBoxShadow,
        transformOrigin: "center center",
      });

      const timeline = gsap.timeline({
        onComplete: () => {
          // Restore the exact pre-animation inline values so Tailwind's normal
          // button classes fully control its resting appearance again.
          gsap.set(button, {
            backgroundColor: baseStyles.backgroundColor,
            boxShadow: baseStyles.boxShadow,
            transform: baseStyles.transform,
            transformOrigin: baseStyles.transformOrigin,
          });
        },
      });

      timeline.to(button, {
        backgroundColor: "#dc2626",
        scale: reducedMotion ? 1 : 1.2,
        boxShadow: "0 0 0 5px rgba(220, 38, 38, 0.28), 0 10px 22px rgba(220, 38, 38, 0.24)",
        duration: 0.16,
        ease: "power3.out",
      });

      if (!reducedMotion) {
        timeline
          .to(button, { x: -6, duration: 0.055, ease: "power2.inOut" })
          .to(button, { x: 6, duration: 0.07, ease: "power2.inOut" })
          .to(button, { x: -5, duration: 0.07, ease: "power2.inOut" })
          .to(button, { x: 4, duration: 0.07, ease: "power2.inOut" })
          .to(button, { x: -2, duration: 0.06, ease: "power2.inOut" })
          .to(button, { x: 0, duration: 0.08, ease: "power2.out" });
      }

      // Hold the unmistakable red state long enough to clearly signal the action.
      timeline.to(button, {
        scale: reducedMotion ? 1 : 1.2,
        duration: 0.55,
      });

      timeline.to(button, {
        backgroundColor: "#226b49",
        scale: 1,
        x: 0,
        boxShadow: baseStyles.computedBoxShadow,
        duration: 0.42,
        ease: "power2.inOut",
      });

      attentionTimeline.current = timeline;
    };

    window.addEventListener("shift:start-required", drawAttentionToStart);
    return () => {
      window.removeEventListener("shift:start-required", drawAttentionToStart);
      attentionTimeline.current?.kill();
    };
  }, []);

  const loadShift = useCallback(async () => {
    try {
      const res = await fetch("/api/shifts?current=1");
      if (!res.ok) return;
      const data = await res.json();
      const current = data.shifts?.[0];
      if (current && (current.isOpen ?? true)) {
        setShift(current);
      } else {
        setShift(null);
      }
    } catch {
      /* offline-safe fallback */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadShift();
    const id = setInterval(loadShift, 15000);
    return () => clearInterval(id);
  }, [loadShift]);

  async function openShift() {
    if (busy) return;
    setBusy(true);
    try {
      const amount = Number(openingBalance) || 0;
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: amount, openingCash: amount }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setShift(data);
        setShowOpen(false);
        setOpeningBalance("0");
        toast.success("Shift started successfully");
        loadShift();
      } else {
        toast.error(data.error || "Could not start shift");
        loadShift();
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  async function closeShift() {
    if (!shift || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/shifts/${shift._id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actualCash: Number(actualCash) || 0 }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.summary) {
        setSummary({
          expectedCash: data.summary.expectedCash,
          actualCash: data.summary.actualCash,
          difference: data.summary.difference,
          cashCollected: data.summary.cashCollected,
          cashRefunded: data.summary.cashRefunded,
        });
        setShift(null);
        toast.success("Shift closed");
      } else if (res.ok) {
        setShowClose(false);
        setShift(null);
        toast.success("Shift closed");
      } else {
        toast.error(data.error || "Could not close shift");
      }
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-2.5 bg-stone-900 text-stone-200 text-xs border-b border-stone-800">
        <div className="flex items-center gap-3">
          <span className="font-brand font-bold text-white text-sm tracking-tight">Sevesto POS</span>
          <span className="text-stone-700">|</span>

          <span className="flex items-center gap-2 font-medium">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                loaded && shift ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
              }`}
            />
            {loaded && shift ? "Active Shift" : "No Active Shift"}
          </span>

          {loaded && shift ? (
            <span className="text-stone-400 border-l border-stone-700 pl-3">
              Opened by{" "}
              <strong className="text-stone-200 font-semibold">
                {shift.cashier?.name || shift.cashierName || "Cashier"}
              </strong>{" "}
              at{" "}
              <span className="font-semibold text-white tabular">
                {new Date(shift.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </span>
          ) : loaded ? (
            <span className="text-stone-400 border-l border-stone-800 pl-3 hidden md:inline">
              Orders cannot be placed until a shift is started.
            </span>
          ) : null}
        </div>

        <div>
          {loaded &&
            (shift ? (
              <button
                onClick={() => {
                  setSummary(null);
                  setActualCash("");
                  setShowClose(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-red-300 hover:bg-stone-700 hover:text-red-200 transition-colors font-medium text-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>End Shift</span>
              </button>
            ) : (
              <button
                ref={startShiftButtonRef}
                onClick={() => setShowOpen(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 shadow-sm hover:shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Shift</span>
              </button>
            ))}
        </div>
      </div>

      {/* Start Shift Dialog */}
      <Dialog open={showOpen} onOpenChange={setShowOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Start Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-stone-500">
              Enter the starting cash float amount to begin register operations.
            </p>
            <div>
              <label className="text-xs font-medium text-stone-500 block mb-1">
                Opening Cash Float (Rs.)
              </label>
              <input
                autoFocus
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowOpen(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={openShift}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{busy ? "Starting…" : "Start Shift"}</span>
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog
        open={showClose}
        onOpenChange={(open) => {
          if (!open && summary) return;
          setShowClose(open);
          if (!open) setSummary(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{summary ? "Shift Summary" : "End Shift — Count Cash Drawer"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {!summary ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-stone-500 block mb-1">
                    Actual Cash Counted (Rs.)
                  </label>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-stone-500 mt-1.5">
                    Expected cash equals starting float + cash sales minus refunds.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-stone-700 py-2">
                <div className="flex justify-between">
                  <span className="text-stone-500">Cash Collected</span>
                  <span className="font-medium text-stone-900 tabular">
                    Rs. {(summary.cashCollected ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Cash Refunds</span>
                  <span className="font-medium text-stone-900 tabular">
                    − Rs. {(summary.cashRefunded ?? 0).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Expected Cash</span>
                  <span className="font-medium text-stone-900 tabular">
                    Rs. {summary.expectedCash.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Actual Cash</span>
                  <span className="font-medium text-stone-900 tabular">
                    Rs. {summary.actualCash.toFixed(2)}
                  </span>
                </div>
                <div
                  className={`flex justify-between font-semibold border-t border-stone-200 pt-2 ${
                    summary.difference !== 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  <span>Difference</span>
                  <span className="tabular">
                    {summary.difference >= 0 ? "+" : ""}
                    {summary.difference.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
          {!summary ? (
            <DialogFooter>
              <button
                onClick={() => {
                  setShowClose(false);
                  setActualCash("");
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={closeShift}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{busy ? "Closing…" : "End Shift"}</span>
              </button>
            </DialogFooter>
          ) : (
            <DialogFooter>
              <button
                onClick={() => {
                  setShowClose(false);
                  setSummary(null);
                  setActualCash("");
                }}
                className="w-full px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 transition-colors"
              >
                Done
              </button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
