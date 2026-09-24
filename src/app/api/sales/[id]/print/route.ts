import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { printReceipt } from "@/lib/print";

export const dynamic = "force-dynamic";

/**
 * POST /api/sales/[id]/print
 *
 * (Re)prints the customer receipt for an existing sale on the configured
 * thermal printer. Used both as a manual "reprint" action and as the
 * fallback the POS UI calls if the automatic print-on-checkout fails.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const sale = await Sale.findById(id).populate("customer", "name phone").lean();
  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }

  const result = await printReceipt(sale);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error || "Print failed" }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
