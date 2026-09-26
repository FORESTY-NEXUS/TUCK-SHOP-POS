import SettingsManager from "@/components/admin/SettingsManager";
import UdhaarToggle from "@/components/admin/UdhaarToggle";
export const dynamic = "force-dynamic";
import { getSettings, getProducts } from "@/lib/queries";

export default async function AdminSettingsPage() {
  const [settings, products] = await Promise.all([getSettings(), getProducts()]);
  return (
    <div className="h-full w-full">
      <div className="px-6 py-8 w-full">
        <h1 className="text-2xl font-bold text-stone-900 font-brand">Settings</h1>
        <p className="text-sm text-stone-500 mt-0.5 mb-6">Loyalty, printer, speed dial config</p>
        <UdhaarToggle initialEnabled={(settings as any)?.udhaarEnabled !== false} />
        <SettingsManager initialSettings={settings as any} initialProducts={products as any} />
      </div>
    </div>
  );
}
