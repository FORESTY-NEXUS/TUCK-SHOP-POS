"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";

export default function UdhaarToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ udhaarEnabled: next }),
      });
      if (res.ok) {
        setEnabled(next);
        toast.success(next ? "Udhaar turned on" : "Udhaar turned off");
      } else {
        toast.error("Could not save");
      }
    } catch {
      toast.error("Cannot reach the server");
    }
    setSaving(false);
  }

  return (
    <section className="card overflow-hidden mb-6">
      <div className="px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center"><HandCoins className="w-4 h-4" /></div>
          <div>
            <h2 className="font-semibold text-stone-900">Udhaar (customer credit)</h2>
            <p className="text-xs text-stone-500 mt-0.5">When off, hides credit sales and the Udhaar page.</p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${enabled ? "bg-brand-600 text-white" : "bg-stone-200 text-stone-700"}`}
        >
          {enabled ? "On" : "Off"}
        </button>
      </div>
    </section>
  );
}
