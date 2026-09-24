import ReportsClient from "./ReportsClient";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";
import { getSalesReport } from "@/lib/queries";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const range = params.range || "today";
  const data = await getSalesReport(range, params.start, params.end);

  return (
    <AppLayout>
      <div className="px-6 py-8 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-stone-900 font-brand">Sales Reports</h1>
          <p className="text-sm text-stone-500 mt-0.5">Revenue, top items, payment breakdown</p>
        </div>
        <ReportsClient initialData={data as any} />
      </div>
    </AppLayout>
  );
}
