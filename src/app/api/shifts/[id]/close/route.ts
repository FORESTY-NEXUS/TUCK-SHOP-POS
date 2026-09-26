import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Shift } from "@/models/Shift";
import { Sale } from "@/models/Sale";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json(); // { actualCash: number }

  const shift = await Shift.findById(id);
  if (!shift) return NextResponse.json({ error: "Shift not found" }, { status: 404 });
  if (!shift.isOpen) return NextResponse.json({ error: "Shift already closed" }, { status: 409 });

  // Only the cashier who opened this shift, or someone with permission to
  // close others' shifts, can close it.
  const isOwnShift = String(shift.cashier) === session.userId;
  if (!isOwnShift && !hasPermission(session.role, session.permissions, "shiftsCloseOthers")) {
    return NextResponse.json({ error: "Only the cashier on this shift, or a manager, can close it" }, { status: 403 });
  }

  const cashSales = await Sale.find({ shift: shift._id, paymentMethod: "cash", status: { $ne: "voided" } }).lean();
  
  // Real cash taken from customers (total sale - returned amount)
  const cashCollected = cashSales.reduce((sum, s) => sum + ((s.total || 0) - (s.returnedAmount || 0)), 0);
  const cashRefunded = cashSales.reduce((sum, s) => sum + (s.returnedAmount || 0), 0);

  const expectedCash = shift.openingBalance + cashCollected;

  const allSales = await Sale.find({ shift: shift._id, status: { $ne: "voided" } }).lean();

  // By method breakdown: NET amounts (payments - refunds)
  const byMethod: Record<string, { gross: number; refunded: number; net: number }> = {};

  for (const s of allSales) {
    if (s.paymentMethod) {
      if (!byMethod[s.paymentMethod]) {
        byMethod[s.paymentMethod] = { gross: 0, refunded: 0, net: 0 };
      }
      byMethod[s.paymentMethod].gross += s.total ?? 0;
      byMethod[s.paymentMethod].refunded += s.returnedAmount ?? 0;
    }
  }

  for (const method of Object.keys(byMethod)) {
    byMethod[method].net = byMethod[method].gross - byMethod[method].refunded;
  }

  shift.closedAt = new Date();
  shift.closingBalance = body.actualCash;
  shift.expectedCash = expectedCash;
  shift.difference = body.actualCash - expectedCash;
  shift.isOpen = false;
  shift.byMethod = byMethod;
  shift.orderCount = allSales.length;
  shift.refundCount = allSales.filter((s) => (s.returnedAmount || 0) > 0).length;
  await shift.save();

  return NextResponse.json({
    shift,
    summary: {
      cashCollected,
      cashRefunded,
      expectedCash,
      actualCash: body.actualCash,
      difference: shift.difference,
      byMethod,
      orderCount: allSales.length,
      refundCount: shift.refundCount,
    },
  });
}
