import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { CustomerCredit } from "@/models/CustomerCredit";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/udhaar/[customerId]/payment
 *
 * Records a payment atomically using a MongoDB transaction.
 * 
 * Body: { amount: number, paymentMethod?: string, notes?: string }
 *
 * Invariant: Every payment creates exactly one immutable ledger transaction,
 * and the customer's outstanding balance remains consistent.
 *
 * Validation:
 *   - amount > 0
 *   - amount <= outstanding (computed from ledger)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  await connectDB();
  const { customerId } = await params;

  // ── Auth ────────────────────────────────────────────────────────────────
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  const body = await req.json();
  const { amount, paymentMethod = "cash", notes } = body;

  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than 0" },
      { status: 400 }
    );
  }

  // ── Compute outstanding from ledger (source of truth) ───────────────────
  const [balanceAgg] = await CustomerCredit.aggregate([
    { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
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
  ]);

  const outstanding = balanceAgg
    ? Math.max(0, balanceAgg.totalCredit - balanceAgg.totalPayments)
    : 0;

  if (amount > outstanding + 0.01) {
    return NextResponse.json(
      {
        error: `Payment of Rs. ${amount.toLocaleString()} exceeds outstanding balance of Rs. ${outstanding.toLocaleString()}`,
      },
      { status: 400 }
    );
  }

  // ── Atomic payment via MongoDB transaction ──────────────────────────────
  const dbSession = await mongoose.startSession();

  try {
    let ledgerEntry: any;
    let newBalance: number;

    await dbSession.withTransaction(async () => {
      // Conditional atomic update: only succeeds if creditBalance >= amount
      const updated = await Customer.findOneAndUpdate(
        {
          _id: customerId,
          creditBalance: { $gte: amount - 0.01 }, // small tolerance for floating point
        },
        { $inc: { creditBalance: -amount } },
        { new: true, session: dbSession }
      );

      if (!updated) {
        throw new Error("Insufficient balance or customer not found");
      }

      newBalance = Math.max(0, updated.creditBalance);

      // Create immutable ledger entry
      [ledgerEntry] = await CustomerCredit.create(
        [
          {
            customer: customerId,
            amount,
            type: "payment",
            notes: notes?.trim() || `Payment received (${paymentMethod})`,
            user: session.userId,
          },
        ],
        { session: dbSession }
      );
    });

    return NextResponse.json({
      previousBalance: outstanding,
      paymentAmount: amount,
      newBalance: newBalance!,
      ledgerEntry: {
        _id: ledgerEntry._id,
        type: ledgerEntry.type,
        amount: ledgerEntry.amount,
        createdAt: ledgerEntry.createdAt,
        notes: ledgerEntry.notes,
      },
    });
  } catch (err: any) {
    console.error("[Udhaar Payment] Transaction failed:", err.message);
    return NextResponse.json(
      { error: err.message || "Payment failed. Please try again." },
      { status: 400 }
    );
  } finally {
    await dbSession.endSession();
  }
}
