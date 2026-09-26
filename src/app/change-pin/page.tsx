"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ChangePinPage() {
  const router = useRouter();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        router.replace("/");
        router.refresh();
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
    <div className="min-h-screen bg-stone-100 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm card p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 font-brand">Set your PIN</h1>
          <p className="text-sm text-stone-500 mt-1">
            You must choose a new PIN before you can use the POS.
          </p>
        </div>
        <div>
          <label className="block text-xs text-stone-500 mb-1">Current PIN</label>
          <input type="password" inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} className="input" autoComplete="off" />
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
        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? "Saving..." : "Save new PIN"}
        </button>
      </form>
    </div>
  );
}
