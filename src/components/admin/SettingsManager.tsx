"use client";

import { useRef, useState } from "react";
import {
  Store,
  Star,
  Printer,
  Bike,
  Zap,
  ShieldCheck,
  Database,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

type Settings = {
  _id: string;
  rupeesPerPoint: number;
  printerName?: string;
  printerType?: string;
  paperWidth?: number;
  autoCut?: boolean;
  speedDial?: Record<string, string>;
  autoFillDeliveryAddress?: boolean;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  posDisplayLogo?: string;
  receiptLogo?: string;
};

type Product = { _id: string; name: string };

// Defined at module scope (NOT inside SettingsManager) so its identity stays
// stable across renders. Defining it inside the component previously caused
// React to treat it as a brand-new component type on every re-render, which
// unmounted/remounted every Section (and all inputs/buttons inside them) on
// every state update -- losing focus and resetting scroll to the top.
function Section({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center"><Icon className="w-4 h-4" /></div>
          <div>
            <h2 className="font-semibold text-stone-900">{title}</h2>
            <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </section>
  );
}

export default function SettingsManager({
  initialSettings,
  initialProducts,
}: {
  initialSettings: Settings;
  initialProducts: Product[];
}) {
  const [rupeesPerPoint, setRupeesPerPoint] = useState(String(initialSettings.rupeesPerPoint ?? 100));
  const [printerName, setPrinterName] = useState(initialSettings.printerName || "");
  const [printerType, setPrinterType] = useState(initialSettings.printerType || "EPSON");
  const [paperWidth, setPaperWidth] = useState(String(initialSettings.paperWidth || 48));
  const [autoCut, setAutoCut] = useState(initialSettings.autoCut ?? true);
  const [speedDial, setSpeedDial] = useState<Record<string, string>>(initialSettings.speedDial || {});
  const [autoFillDeliveryAddress, setAutoFillDeliveryAddress] = useState(initialSettings.autoFillDeliveryAddress ?? true);
  const [storeName, setStoreName] = useState(initialSettings.storeName || "");
  const [storeAddress, setStoreAddress] = useState(initialSettings.storeAddress || "");
  const [storePhone, setStorePhone] = useState(initialSettings.storePhone || "");
  const [posDisplayLogo, setPosDisplayLogo] = useState(initialSettings.posDisplayLogo || "");
  const [receiptLogo, setReceiptLogo] = useState(initialSettings.receiptLogo || "");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Change PIN
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinSubmitting, setPinSubmitting] = useState(false);

  // Backup / Restore
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const printerTypes = ["EPSON", "STAR", "TANCA", "DARUMA", "BROTHER", "CUSTOM"];

  async function saveAll() {
    if (submitting) return;

    const rppValue = Number(rupeesPerPoint);
    const pwValue = Number(paperWidth);
    if (!Number.isInteger(rppValue) || rppValue < 1) {
      setMessage({ type: "error", text: "Rupees per point must be a positive integer" });
      return;
    }
    if (!Number.isInteger(pwValue) || pwValue < 1) {
      setMessage({ type: "error", text: "Paper width must be a positive integer" });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rupeesPerPoint: rppValue,
          printerName,
          printerType,
          paperWidth: pwValue,
          autoCut,
          speedDial,
          autoFillDeliveryAddress,
          storeName,
          storeAddress,
          storePhone,
          posDisplayLogo,
          receiptLogo,
        }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "All settings saved" });
        toast.success("Settings saved");
        setTimeout(() => setMessage(null), 3000);
      } else {
        const d = await res.json().catch(() => ({}));
        setMessage({ type: "error", text: d.error || "Save failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Cannot reach the server" });
    } finally {
      setSubmitting(false);
    }
  }

  async function changePin() {
    if (pinSubmitting) return;
    if (!/^\d{4,6}$/.test(currentPin) || !/^\d{4,6}$/.test(newPin)) {
      setMessage({ type: "error", text: "PINs must be 4-6 digits" });
      toast.error("PINs must be 4-6 digits");
      return;
    }
    if (newPin !== confirmPin) {
      setMessage({ type: "error", text: "New PIN and confirmation do not match" });
      toast.error("New PIN and confirmation do not match");
      return;
    }
    setPinSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "success", text: "PIN changed — use it at the next login" });
        toast.success("PIN changed");
        setCurrentPin(""); setNewPin(""); setConfirmPin("");
      } else {
        setMessage({ type: "error", text: d.error || "Could not change PIN" });
        toast.error(d.error || "Could not change PIN");
      }
    } catch {
      setMessage({ type: "error", text: "Cannot reach the server" });
      toast.error("Cannot reach the server");
    } finally {
      setPinSubmitting(false);
    }
  }

  async function exportBackup() {
    if (exporting) return;
    setExporting(true);
    try {
      const res = await fetch("/api/settings/backup");
      if (!res.ok) throw new Error("export failed");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sevesto-pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function importBackup(file: File) {
    if (!confirm("Restore REPLACES all current data (orders, products, settings, accounts...) with the backup contents. Continue?")) return;
    setImporting(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/settings/backup", { method: "POST", body: fd });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage({ type: "success", text: "Backup restored — data replaced with the snapshot" });
        toast.success("Backup restored");
      } else {
        setMessage({ type: "error", text: d.error || "Import failed" });
      }
    } catch {
      setMessage({ type: "error", text: "Import failed" });
    } finally {
      setImporting(false);
      if (importFileRef.current) importFileRef.current.value = "";
    }
  }

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>, type: "pos" | "receipt") {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      if (type === "pos") setPosDisplayLogo(base64);
      else setReceiptLogo(base64);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="space-y-6">
      <div className="h-[52px] overflow-hidden">
      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 ${
          message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
        }`}>
          {message.type === "success" ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {message.text}
        </div>
        )}
      </div>

      <Section icon={Store} title="Store Branding" subtitle="Store name, phone, address and logos — these flow onto printed receipts and the POS screen">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Store Name</label>
            <input type="text" value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g., Sevesto Cafe" className="input" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Store Phone</label>
            <input type="text" value={storePhone} onChange={(e) => setStorePhone(e.target.value)} placeholder="e.g., 0300-1234567" className="input" />
            <p className="text-xs text-stone-500 mt-1">Also printed as a WhatsApp contact line on receipts.</p>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-stone-700 block mb-1">Store Address</label>
          <input type="text" value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="e.g., 123 Main Street, Lahore" className="input" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">POS Display Logo</label>
            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, "pos")} className="w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer" />
            {posDisplayLogo && <div className="mt-2 p-2 bg-stone-50 rounded-lg border border-stone-200"><img src={posDisplayLogo} alt="POS Logo" className="h-10 mx-auto object-contain" /></div>}
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Receipt Logo</label>
            <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, "receipt")} className="w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer" />
            {receiptLogo && <div className="mt-2 p-2 bg-stone-50 rounded-lg border border-stone-200"><img src={receiptLogo} alt="Receipt Logo" className="h-10 mx-auto object-contain" /></div>}
          </div>
        </div>
      </Section>

      <Section icon={Star} title="Loyalty Points" subtitle="Earn points on qualifying orders">
        <div>
          <label className="text-xs font-medium text-stone-700 block mb-1">Rupees per point</label>
          <input type="number" min={1} value={rupeesPerPoint} onChange={(e) => setRupeesPerPoint(e.target.value)} className="input max-w-xs" />
          <p className="text-xs text-stone-500 mt-1.5">
            Customer earns 1 loyalty point for every Rs. <strong className="text-stone-700">{rupeesPerPoint || 100}</strong> spent. Walk-in Guest never earns points.
          </p>
        </div>
      </Section>

      <Section icon={Printer} title="Thermal Printer" subtitle="Kitchen tickets and customer receipts">
        <div>
          <label className="text-xs font-medium text-stone-700 block mb-1">Windows Printer Name</label>
          <input type="text" value={printerName} onChange={(e) => setPrinterName(e.target.value)} placeholder="e.g., EPSON TM-T20II Receipt" className="input max-w-md" />
          <p className="text-xs text-stone-500 mt-1.5">
            Exact queue name from Windows "Printers & Scanners". Leave blank to disable printing — orders still save.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Printer Type</label>
            <select value={printerType} onChange={(e) => setPrinterType(e.target.value)} className="input">
              {printerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Paper Width (cols)</label>
            <input type="number" min={1} value={paperWidth} onChange={(e) => setPaperWidth(e.target.value)} className="input" />
            <p className="text-xs text-stone-500 mt-1">32/48 = 58mm · 48/64 = 80mm</p>
          </div>
        </div>
        <div className="flex items-center gap-2 max-w-md">
          <input type="checkbox" id="autoCut" checked={autoCut} onChange={(e) => setAutoCut(e.target.checked)} className="w-4 h-4 text-brand-600 border-stone-300 rounded focus:ring-brand-500" />
          <label htmlFor="autoCut" className="text-sm text-stone-700">Auto-cut paper after printing</label>
        </div>
      </Section>

      <Section icon={Bike} title="Delivery Settings" subtitle="Auto-fill behavior for delivery orders">
        <div className="flex items-center gap-3 max-w-md">
          <input type="checkbox" id="autoFillDeliveryAddress" checked={autoFillDeliveryAddress} onChange={(e) => setAutoFillDeliveryAddress(e.target.checked)} className="w-5 h-5 text-brand-600 border-stone-300 rounded focus:ring-brand-500" />
          <div>
            <label htmlFor="autoFillDeliveryAddress" className="text-sm font-medium text-stone-900 cursor-pointer">Auto-fill delivery address from customer&apos;s last address</label>
            <p className="text-xs text-stone-500 mt-0.5">The address saved from the customer&apos;s last delivery pre-fills next time.</p>
          </div>
        </div>
      </Section>

      <Section icon={Zap} title="Speed Dial (0–9)" subtitle="Map number keys to products for fast add-to-cart in the POS">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <div key={num}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-6 h-6 rounded-md bg-stone-100 text-stone-600 text-xs font-mono font-bold flex items-center justify-center">{num}</span>
              </div>
              <select
                value={speedDial[String(num)] || ""}
                onChange={(e) => {
                  const next = { ...speedDial };
                  if (e.target.value) next[String(num)] = e.target.value;
                  else delete next[String(num)];
                  setSpeedDial(next);
                }}
                className="input text-xs"
              >
                <option value="">— None —</option>
                {initialProducts
                  .filter((p) => p.name)
                  .map((p) => (
                    <option key={p._id} value={p._id}>{p.name.length > 16 ? p.name.slice(0, 16) + "…" : p.name}</option>
                  ))}
              </select>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={ShieldCheck} title="Security — Change PIN" subtitle="Requires your current PIN; staff log in with the new PIN from the next login onward">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Current PIN</label>
            <input type="password" inputMode="numeric" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} className="input" placeholder="••••" autoComplete="off" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">New PIN (4-6 digits)</label>
            <input type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} className="input" placeholder="••••" autoComplete="off" />
          </div>
          <div>
            <label className="text-xs font-medium text-stone-700 block mb-1">Confirm new PIN</label>
            <input type="password" inputMode="numeric" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className="input" placeholder="••••" autoComplete="off" />
          </div>
        </div>
        <button
          type="button"
          onClick={changePin}
          disabled={pinSubmitting || !currentPin || !newPin || !confirmPin}
          className="btn-secondary text-sm mt-3"
        >
          {pinSubmitting ? "Changing…" : "Change PIN"}
        </button>
      </Section>

      <Section icon={Database} title="Backup & Restore" subtitle="Full database snapshot — export to a file, or restore from one. Restore REPLACES all current data.">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportBackup} disabled={exporting} className="btn-primary text-sm">
            {exporting ? "Exporting…" : "Export Backup"}
          </button>
          <div className="flex items-center gap-2">
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importBackup(f);
              }}
              className="w-full text-xs text-stone-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
            />
            {importing && <span className="text-xs text-stone-400">Restoring…</span>}
          </div>
        </div>
        <p className="text-xs text-stone-500 mt-2">
          The backup file contains every collection (products, orders, shifts, settings, accounts…). Restoring wipes the current database and replaces it with the file&apos;s contents.
        </p>
      </Section>

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-stone-400">Changes are saved together when you click Save Settings</p>
        <button type="button" onClick={saveAll} disabled={submitting} className="btn-primary">
          {submitting ? "Saving…" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
