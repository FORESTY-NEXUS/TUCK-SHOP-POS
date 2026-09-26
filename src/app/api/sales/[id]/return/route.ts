import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { StockMovement } from "@/models/StockMovement";
import { Customer } from "@/models/Customer";
import { CustomerCredit } from "@/models/CustomerCredit";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/**
 * POST /api/sales/[id]/return
 *
 * Handles the two things a tuck-shop owner actually needs:
 *  - "Return item(s)": a customer brings something back (wrong item, didn't
 *    want it, etc). Restocks just those units and refunds just that amount.
 *  - "Void sale": the whole sale was a mistake — restocks everything and
 *    refunds the full amount.
 *
 * Body: { action: "return" | "void", items?: [{ itemId, qty }], reason?: string }
 * `items` is required for "return" and ignored for "void" (void returns the
 * full remaining quantity of every line automatically).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const action: "return" | "void" = body.action === "void" ? "void" : "return";

  const requiredPerm = action === "void" ? "salesVoid" : "salesReturn";
  if (!hasPermission(session.role, session.permissions, requiredPerm)) {
    return NextResponse.json(
      { error: action === "void" ? "You're not allowed to void sales" : "You're not allowed to process returns" },
      { status: 403 }
    );
  }
  const reason: string | undefined = body.reason?.trim() || undefined;

  const sale = await Sale.findById(id);
  if (!sale) {
    return NextResponse.json({ error: "Sale not found" }, { status: 404 });
  }
  if (sale.status === "voided" || sale.status === "returned") {
    return NextResponse.json({ error: `This sale is already ${sale.status}` }, { status: 400 });
  }

  // Work out how many units of each line are still eligible to come back.
  const remaining = (item: any) => item.qty - (item.qtyReturned || 0);

  let requested: { itemId: string; qty: number }[];
  if (action === "void") {
    requested = sale.items
      .filter((it: any) => remaining(it) > 0)
      .map((it: any) => ({ itemId: String(it._id), qty: remaining(it) }));
  } else {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "items is required for a return" }, { status: 400 });
    }
    requested = body.items
      .map((r: any) => ({ itemId: String(r.itemId), qty: Number(r.qty) }))
      .filter((r: any) => r.qty > 0);
    if (requested.length === 0) {
      return NextResponse.json({ error: "Pick a quantity to return for at least one item" }, { status: 400 });
    }
  }

  // Validate every requested line against what's actually left to return.
  let refundAmount = 0;
  const stockRestores: { item: any; qty: number }[] = [];
  for (const r of requested) {
    const item = sale.items.id(r.itemId);
    if (!item) {
      return NextResponse.json({ error: "One of those items isn't on this sale" }, { status: 400 });
    }
    const left = remaining(item);
    if (r.qty > left) {
      return NextResponse.json(
        { error: `Can't return ${r.qty} of "${item.name}" — only ${left} left to return` },
        { status: 400 }
      );
    }
    // What one unit of this line actually contributed to the sale's total:
    // gross price, minus this line's own flat discount, minus this line's
    // proportional share of the whole-order discount.
    const lineGross = item.sellingPrice * item.qty;
    const lineNet = lineGross - (item.lineDiscount || 0);
    const orderDiscountShare = sale.subtotal > 0 ? (lineGross / sale.subtotal) * (sale.discountAmount || 0) : 0;
    const perUnitFinal = (lineNet - orderDiscountShare) / item.qty;
    refundAmount += Math.max(0, perUnitFinal) * r.qty;

    item.qtyReturned = (item.qtyReturned || 0) + r.qty;
    stockRestores.push({ item, qty: r.qty });
  }
  refundAmount = Math.round(refundAmount * 100) / 100;

  // Restock every returned unit and log it, exactly mirroring how a sale
  // decrements stock in POST /api/sales.
  for (const { item, qty } of stockRestores) {
    let stockAfter: number;
    if (item.variantId) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": qty } },
        { new: true }
      );
      const variant = product?.variants?.find((v: any) => String(v._id) === String(item.variantId));
      stockAfter = variant?.stock ?? 0;
    } else {
      const product = await Product.findByIdAndUpdate(item.product, { $inc: { stock: qty } }, { new: true });
      stockAfter = product?.stock ?? 0;
    }

    await StockMovement.create({
      product: item.product,
      qty,
      type: "return",
      reason: reason || (action === "void" ? `Voided sale ${sale.saleNumber}` : `Return from sale ${sale.saleNumber}`),
      user: session.userId,
      reference: sale._id,
      referenceModel: "Sale",
      costPrice: item.purchasePrice,
      stockAfter,
    });
  }

  // Reverse the money. Cash/card/etc were already collected — that refund
  // just happens at the counter, so we only need to touch anything for
  // credit sales (reduce what the customer still owes).
  if (sale.paymentMethod === "credit" && sale.customer) {
    const customer = await Customer.findById(sale.customer);
    if (customer) {
      customer.creditBalance = Math.max(0, (customer.creditBalance || 0) - refundAmount);
      await customer.save();
    }
    await CustomerCredit.create({
      customer: sale.customer,
      amount: refundAmount,
      type: "return",
      reference: sale._id,
      referenceModel: "Sale",
      notes: reason || (action === "void" ? `Voided sale ${sale.saleNumber}` : `Return from sale ${sale.saleNumber}`),
      user: session.userId,
    });
  }

  sale.returnedAmount = (sale.returnedAmount || 0) + refundAmount;
  const fullyReturned = sale.items.every((it: any) => remaining(it) <= 0);
  sale.status = action === "void" && fullyReturned ? "voided" : fullyReturned ? "returned" : "partially_returned";
  if (reason) {
    sale.note = sale.note ? `${sale.note}\n${reason}` : reason;
  }
  await sale.save();

  return NextResponse.json({ success: true, refundAmount, status: sale.status });
}
