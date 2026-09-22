import RetailPOS from "@/components/pos/RetailPOS";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";

export default async function PosCockpitPage() {
  return (
    <AppLayout>
      <main className="h-full w-full flex flex-col bg-stone-100">
        <RetailPOS />
      </main>
    </AppLayout>
  );
}
