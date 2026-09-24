import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { CustomerCredit } from "@/models/CustomerCredit";
import { Sale } from "@/models/Sale";

export const dynamic = "force-dynamic";

/**
 * GET /api/udhaar/[customerId]
 *
 * Returns customer credit detail:
 *   - Customer info (name, phone)
 *   - Outstanding balance computed from ledger (source of truth)
 *   - Full credit ledger with running balances and sale references
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  await connectDB();
  const { customerId } = await params;

  // Fetch customer
  const customer = await Customer.findById(customerId)
    .select("name phone creditBalance address")
    .lean();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  // Fetch all ledger entries for this customer, oldest first (for running balance)
  const ledgerEntries = await CustomerCredit.find({ customer: customerId })
    .sort({ createdAt: 1 })
    .lean();

  // Collect all sale reference IDs to resolve sale numbers
  const saleRefIds = ledgerEntries
    .filter((e: any) => e.referenceModel === "Sale" && e.reference)
    .map((e: any) => e.reference);

  const saleMap = new Map<string, string>();
  if (saleRefIds.length > 0) {
    const sales = await Sale.find({ _id: { $in: saleRefIds } })
      .select("saleNumber")
      .lean();
    for (const s of sales) {
      saleMap.set(String(s._id), (s as any).saleNumber);
    }
  }

  // Compute running balance and format entries
  let runningBalance = 0;
  const ledger = ledgerEntries.map((entry: any) => {
    // Credit and positive adjustments increase balance
    // Payments and returns decrease balance
    if (entry.type === "credit" || entry.type === "adjustment") {
      runningBalance += entry.amount;
    } else if (entry.type === "payment" || entry.type === "return") {
      runningBalance -= entry.amount;
    }

    const saleNumber = entry.reference ? saleMap.get(String(entry.reference)) : null;

    return {
      _id: entry._id,
      type: entry.type,
      amount: entry.amount,
      runningBalance: Math.max(0, runningBalance),
      notes: entry.notes,
      saleNumber, // e.g. "S-00142"
      createdAt: entry.createdAt,
    };
  });

  // Outstanding from ledger (source of truth)
  const outstanding = Math.max(0, runningBalance);
  const cachedBalance = (customer as any).creditBalance ?? 0;

  // Reconciliation check
  if (Math.abs(cachedBalance - outstanding) > 0.01) {
    console.warn(
      `[Udhaar] Balance mismatch for ${(customer as any).name || (customer as any).phone}: ` +
      `cached=${cachedBalance}, ledger=${outstanding}`
    );
  }

  return NextResponse.json({
    customer: {
      _id: (customer as any)._id,
      name: (customer as any).name,
      phone: (customer as any).phone,
      address: (customer as any).address,
    },
    outstanding,
    cachedBalance,
    ledger: ledger.reverse(), // newest first for display
  });
}
