import ShiftRows from "./ShiftRows";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";
import { getShifts } from "@/lib/queries";

export default async function ShiftHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { shifts, totalPages, totalCount } = await getShifts(page);

  return (
    <AppLayout>
      <div className="px-6 py-8 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 font-brand">Shift History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track cashier shifts, cash-in-hand, and order counts</p>
        </div>
        <ShiftRows
          initialShifts={shifts as any}
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
        />
      </div>
    </AppLayout>
  );
}
