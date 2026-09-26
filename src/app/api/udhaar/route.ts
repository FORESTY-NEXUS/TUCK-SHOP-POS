import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { CustomerCredit } from "@/models/CustomerCredit";
import { Settings } from "@/models/Settings";
import { getDateRange } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * GET /api/udhaar
 *
 * Returns the Udhaar dashboard data:
 *   - Stats computed from the CustomerCredit ledger (source of truth)
 *   - Customer list with outstanding balances from ledger aggregation
 *
 * Query params:
 *   filter: "outstanding" (default) | "all_credit" | "recently_active"
 *   search: name/phone search string
 *   period: "today" | "this_week" | "this_month" | "last_month" | "all"
 */
export async function GET(req: NextRequest) {
  await connectDB();

  const settings = await Settings.findOne().lean();
  if (settings && (settings as any).udhaarEnabled === false) {
    return NextResponse.json({ error: "Udhaar is turned off in settings" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const filter = params.get("filter") || "outstanding";
  const search = params.get("search")?.trim() || "";
  const period = params.get("period") || "this_month";

  // ── Period range for time-scoped stats ──────────────────────────────────
  const { start: periodStart, end: periodEnd } = getDateRange(period);

  // ── Stats from ledger (source of truth) ─────────────────────────────────
  const [totalOutstandingAgg, periodStatsAgg, allCustomerBalancesAgg] = await Promise.all([
    // Total outstanding across all customers from ledger
    CustomerCredit.aggregate([
      {
        $group: {
          _id: null,
          totalCredit: {
            $sum: {
              $cond: [{ $in: ["$type", ["credit", "adjustment"]] }, "$amount", 0],
            },
          },
          totalPayments: {
            $sum: {
              $cond: [{ $in: ["$type", ["payment", "return"]] }, "$amount", 0],
            },
          },
        },
      },
    ]),

    // Period-scoped stats (collected / given this period)
    CustomerCredit.aggregate([
      {
        $match: {
          createdAt: { $gte: periodStart, $lte: periodEnd },
        },
      },
      {
        $group: {
          _id: null,
          collected: {
            $sum: {
              $cond: [{ $in: ["$type", ["payment", "return"]] }, "$amount", 0],
            },
          },
          creditGiven: {
            $sum: {
              $cond: [{ $eq: ["$type", "credit"] }, "$amount", 0],
            },
          },
        },
      },
    ]),

    // Per-customer outstanding balances from ledger
    CustomerCredit.aggregate([
      {
        $group: {
          _id: "$customer",
          ledgerCredit: {
            $sum: {
              $cond: [{ $in: ["$type", ["credit", "adjustment"]] }, "$amount", 0],
            },
          },
          ledgerPayments: {
            $sum: {
              $cond: [{ $in: ["$type", ["payment", "return"]] }, "$amount", 0],
            },
          },
          lastActivity: { $max: "$createdAt" },
        },
      },
      {
        $addFields: {
          outstanding: { $subtract: ["$ledgerCredit", "$ledgerPayments"] },
        },
      },
      { $sort: { outstanding: -1 } },
    ]),
  ]);

  // Parse global stats
  const globalStats = totalOutstandingAgg[0] || { totalCredit: 0, totalPayments: 0 };
  const totalUdhaar = Math.max(0, globalStats.totalCredit - globalStats.totalPayments);

  const periodStats = periodStatsAgg[0] || { collected: 0, creditGiven: 0 };
  const collectedThisMonth = periodStats.collected;
  const creditGivenThisMonth = periodStats.creditGiven;
  const netCreditChange = creditGivenThisMonth - collectedThisMonth;

  // Build customer ID → ledger balance map
  const customerBalanceMap = new Map<string, { outstanding: number; lastActivity: Date }>();
  for (const entry of allCustomerBalancesAgg) {
    customerBalanceMap.set(String(entry._id), {
      outstanding: Math.max(0, entry.outstanding),
      lastActivity: entry.lastActivity,
    });
  }

  // Count customers with outstanding > 0
  const customersWithCredit = allCustomerBalancesAgg.filter(
    (e: any) => e.outstanding > 0
  ).length;

  // ── Customer list ───────────────────────────────────────────────────────
  // Get all customer IDs that have ever had a ledger entry
  const customerIdsWithLedger = allCustomerBalancesAgg.map((e: any) => e._id);

  // Build customer query based on filter
  let customerFilter: Record<string, unknown> = {};

  if (filter === "outstanding") {
    // Only customers with outstanding > 0 from ledger
    const outstandingIds = allCustomerBalancesAgg
      .filter((e: any) => e.outstanding > 0)
      .map((e: any) => e._id);
    customerFilter._id = { $in: outstandingIds };
  } else if (filter === "all_credit") {
    // All customers who have ever had a credit transaction
    customerFilter._id = { $in: customerIdsWithLedger };
  } else if (filter === "recently_active") {
    // Customers with recent ledger activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentIds = allCustomerBalancesAgg
      .filter((e: any) => e.lastActivity && new Date(e.lastActivity) >= sevenDaysAgo)
      .map((e: any) => e._id);
    customerFilter._id = { $in: recentIds };
  }

  // Add search filter
  if (search) {
    const searchFilter = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ],
    };
    customerFilter = { ...customerFilter, ...searchFilter };
  }

  const customers = await Customer.find(customerFilter)
    .select("name phone creditBalance")
    .sort({ creditBalance: -1 })
    .limit(200)
    .lean();

  // Merge with ledger data and check for inconsistencies
  const customerList = customers.map((c: any) => {
    const ledgerData = customerBalanceMap.get(String(c._id));
    const ledgerOutstanding = ledgerData?.outstanding ?? 0;
    const cachedBalance = c.creditBalance ?? 0;

    // Log reconciliation warning if cached balance diverges from ledger
    if (Math.abs(cachedBalance - ledgerOutstanding) > 0.01) {
      console.warn(
        `[Udhaar] Balance mismatch for customer ${c.name || c.phone} (${c._id}): ` +
        `cached=${cachedBalance}, ledger=${ledgerOutstanding}`
      );
    }

    return {
      _id: c._id,
      name: c.name,
      phone: c.phone,
      outstanding: ledgerOutstanding, // ledger is source of truth
      cachedBalance,
      lastActivity: ledgerData?.lastActivity || null,
    };
  });

  // Sort by outstanding descending (ledger value)
  customerList.sort((a: any, b: any) => b.outstanding - a.outstanding);

  // ── Recent activity (last 10 transactions across all customers) ─────────
  const recentActivity = await CustomerCredit.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate("customer", "name phone")
    .lean();

  const recentActivityFormatted = recentActivity.map((entry: any) => ({
    _id: entry._id,
    customerName: entry.customer?.name || entry.customer?.phone || "Unknown",
    customerId: entry.customer?._id,
    type: entry.type,
    amount: entry.amount,
    notes: entry.notes,
    createdAt: entry.createdAt,
  }));

  // ── Top debtors ─────────────────────────────────────────────────────────
  const topDebtors = customerList.slice(0, 5).filter((c: any) => c.outstanding > 0);

  return NextResponse.json({
    stats: {
      totalUdhaar,
      customersWithCredit,
      collectedThisMonth,
      creditGivenThisMonth,
      netCreditChange,
      period,
    },
    customers: customerList,
    recentActivity: recentActivityFormatted,
    topDebtors,
    totalCustomersWithLedger: customerIdsWithLedger.length,
  });
}
