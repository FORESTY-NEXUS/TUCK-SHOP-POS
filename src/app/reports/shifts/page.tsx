import ShiftRows from "./ShiftRows";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";

// ---------- Pakistani demo shift data ----------
const DEMO_SHIFTS = [
  {
    _id: "s1", cashier: { name: "Tariq Mehmood" }, openedAt: "2026-08-28T09:00:00Z", closedAt: "2026-08-28T21:00:00Z",
    openingBalance: 5000, closingBalance: 48200, expectedCash: 47800, difference: 400,
    isOpen: false, orderCount: 73, refundCount: 1,
    byMethod: { cash: { gross: 42000, refunded: 500, net: 41500 }, easypaisa: { gross: 3800, refunded: 0, net: 3800 }, card: { gross: 2700, refunded: 0, net: 2700 } },
  },
  {
    _id: "s2", cashier: { name: "Adnan Bashir" }, openedAt: "2026-08-27T09:00:00Z", closedAt: "2026-08-27T21:30:00Z",
    openingBalance: 5000, closingBalance: 52000, expectedCash: 52500, difference: -500,
    isOpen: false, orderCount: 81, refundCount: 2,
    byMethod: { cash: { gross: 46000, refunded: 800, net: 45200 }, jazzcash: { gross: 4200, refunded: 0, net: 4200 }, card: { gross: 3100, refunded: 0, net: 3100 } },
  },
  {
    _id: "s3", cashier: { name: "Zubair Khan" }, openedAt: "2026-08-26T08:30:00Z", closedAt: "2026-08-26T20:45:00Z",
    openingBalance: 5000, closingBalance: 38700, expectedCash: 38700, difference: 0,
    isOpen: false, orderCount: 58, refundCount: 0,
    byMethod: { cash: { gross: 33000, refunded: 0, net: 33000 }, easypaisa: { gross: 3200, refunded: 0, net: 3200 }, bank: { gross: 2500, refunded: 0, net: 2500 } },
  },
  {
    _id: "s4", cashier: { name: "Tariq Mehmood" }, openedAt: "2026-08-25T09:00:00Z", closedAt: "2026-08-25T21:00:00Z",
    openingBalance: 5000, closingBalance: 61000, expectedCash: 60200, difference: 800,
    isOpen: false, orderCount: 95, refundCount: 3,
    byMethod: { cash: { gross: 54000, refunded: 1200, net: 52800 }, jazzcash: { gross: 5100, refunded: 0, net: 5100 }, easypaisa: { gross: 2100, refunded: 0, net: 2100 } },
  },
  {
    _id: "s5", cashier: { name: "Adnan Bashir" }, openedAt: "2026-08-24T09:15:00Z", closedAt: "2026-08-24T20:30:00Z",
    openingBalance: 5000, closingBalance: 44500, expectedCash: 44800, difference: -300,
    isOpen: false, orderCount: 67, refundCount: 1,
    byMethod: { cash: { gross: 39200, refunded: 600, net: 38600 }, card: { gross: 3800, refunded: 0, net: 3800 }, easypaisa: { gross: 2100, refunded: 0, net: 2100 } },
  },
  {
    _id: "s6", cashier: { name: "Tariq Mehmood" }, openedAt: "2026-08-29T09:00:00Z", closedAt: undefined,
    openingBalance: 5000, closingBalance: undefined, expectedCash: undefined, difference: undefined,
    isOpen: true, orderCount: 12, refundCount: 0, byMethod: null,
  },
];

export default function ShiftHistoryPage() {
  return (
    <AppLayout>
      <div className="px-6 py-8 w-full">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 font-brand">Shift History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track cashier shifts, cash-in-hand, and order counts</p>
        </div>
        <ShiftRows
          initialShifts={DEMO_SHIFTS as any}
          page={1}
          totalPages={1}
          totalCount={DEMO_SHIFTS.length}
        />
      </div>
    </AppLayout>
  );
}
