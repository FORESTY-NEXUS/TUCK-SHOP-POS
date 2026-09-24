import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Product } from "@/models/Product";
import { Shift } from "@/models/Shift";
import { StockMovement } from "@/models/StockMovement";
import { Customer } from "@/models/Customer";
import { CustomerCredit } from "@/models/CustomerCredit";
import { Counter, nextSequence } from "@/models/Counter";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { printReceipt } from "@/lib/print";

export const dynamic = "force-dynamic";

/**
 * POST /api/sales
 *
 * Body:
 *   items: [{ productId, quantity }]
 *   paymentMethod: "cash" | "credit" | "card" | "easypaisa" | "jazzcash" | "bank_transfer" | ...
 *   amountReceived?: number (for cash — calculates change; for credit — partial payment)
 *   discountPercent?: number
 *   customer?: string (ObjectId — required for credit sales)
 *   note?: string
 */
export async function POST(req: NextRequest) {
  await connectDB();

  // ── Auth ────────────────────────────────────────────────────────────────
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // ── Active shift ────────────────────────────────────────────────────────
  const shift = await Shift.findOne({ isOpen: true });
  if (!shift) {
    return NextResponse.json(
      { error: "No active shift. Start a shift before processing sales." },
      { status: 400 }
    );
  }

  // ── Parse body ──────────────────────────────────────────────────────────
  const body = await req.json();
  const {
    items,
    paymentMethod,
    amountReceived = 0,
    discountPercent = 0,
    customer: customerId,
    note,
  } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }
  if (!paymentMethod) {
    return NextResponse.json({ error: "Payment method is required" }, { status: 400 });
  }

  // Credit requires a customer
  if (paymentMethod === "credit" && !customerId) {
    return NextResponse.json(
      { error: "Credit sales require a customer. Select a customer first." },
      { status: 400 }
    );
  }

  // ── Load & validate products + stock ────────────────────────────────────
  const productIds = items.map((i: any) => i.productId);
  const products = await Product.find({ _id: { $in: productIds }, isActive: true });
  const productMap = new Map(products.map((p) => [String(p._id), p]));

  const saleItems: Array<{
    product: string;
    variantId?: string;
    name: string;
    sellingPrice: number;
    purchasePrice: number;
    qty: number;
  }> = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return NextResponse.json(
        { error: `Product not found: ${item.productId}` },
        { status: 400 }
      );
    }
    const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));

    // A variantId means this line is a specific size/pack (e.g. Pepsi
    // "1.5L") rather than the flat product — price and stock come from
    // the variant, not the parent.
    if (item.variantId) {
      const variant = (product.variants || []).find(
        (v: any) => String(v._id) === String(item.variantId) && v.isActive
      );
      if (!variant) {
        return NextResponse.json(
          { error: `Variant not found for "${product.name}"` },
          { status: 400 }
        );
      }
      if (variant.stock != null && variant.stock < qty) {
        return NextResponse.json(
          {
            error: `Insufficient stock for "${product.name} — ${variant.name}". Available: ${variant.stock}, Requested: ${qty}`,
          },
          { status: 400 }
        );
      }
      saleItems.push({
        product: String(product._id),
        variantId: String(variant._id),
        name: `${product.name} — ${variant.name}`,
        sellingPrice: variant.sellingPrice,
        purchasePrice: variant.purchasePrice || 0,
        qty,
      });
      continue;
    }

    // A variants-only parent (no price of its own) can't be sold as a flat
    // line — the client should have sent a variantId instead.
    if (product.sellingPrice == null) {
      return NextResponse.json(
        { error: `"${product.name}" has no price of its own — pick a size/pack instead` },
        { status: 400 }
      );
    }

    if (product.stock != null && product.stock < qty) {
      return NextResponse.json(
        {
          error: `Insufficient stock for "${product.name}". Available: ${product.stock}, Requested: ${qty}`,
        },
        { status: 400 }
      );
    }
    saleItems.push({
      product: String(product._id),
      name: product.name,
      sellingPrice: product.sellingPrice,
      purchasePrice: product.purchasePrice || 0,
      qty,
    });
  }

  // ── Calculate totals ───────────────────────────────────────────────────
  const subtotal = saleItems.reduce((sum, i) => sum + i.sellingPrice * i.qty, 0);
  const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
  const total = Math.round((subtotal - discountAmount) * 100) / 100;
  const received = Number(amountReceived) || 0;
  const change = paymentMethod === "cash" ? Math.max(0, received - total) : 0;

  // ── Generate sale number ───────────────────────────────────────────────
  const seq = await nextSequence("sale");
  const saleNumber = `S-${String(seq).padStart(5, "0")}`;

  // ── Create sale ────────────────────────────────────────────────────────
  const isPaid = paymentMethod !== "credit" || received >= total;
  const sale = await Sale.create({
    saleNumber,
    items: saleItems,
    subtotal,
    discountPercent,
    discountAmount,
    total,
    paymentMethod,
    amountReceived: received,
    change,
    customer: customerId || undefined,
    cashier: session.userId,
    shift: shift._id,
    isPaid,
    paidAt: isPaid ? new Date() : undefined,
    note: note?.trim() || undefined,
    status: "completed",
  });

  // ── Decrement stock & create movements ─────────────────────────────────
  for (const item of saleItems) {
    const product = productMap.get(item.product)!;

    let newStock: number;
    if (item.variantId) {
      const variant = (product.variants || []).find(
        (v: any) => String(v._id) === item.variantId
      );
      newStock = (variant?.stock || 0) - item.qty;
      await Product.updateOne(
        { _id: item.product, "variants._id": item.variantId },
        { $inc: { "variants.$.stock": -item.qty } }
      );
    } else {
      newStock = (product.stock || 0) - item.qty;
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -item.qty },
      });
    }

    await StockMovement.create({
      product: item.product,
      qty: -item.qty,
      type: "sale",
      reason: `Sale ${saleNumber}`,
      user: session.userId,
      reference: sale._id,
      referenceModel: "Sale",
      costPrice: item.purchasePrice,
      stockAfter: newStock,
    });
  }

  // ── Credit ledger entry (if credit sale) ───────────────────────────────
  if (paymentMethod === "credit" && customerId) {
    const creditAmount = total - received; // what the customer owes

    if (creditAmount > 0) {
      // Update the customer's running balance
      await Customer.findByIdAndUpdate(customerId, {
        $inc: { creditBalance: creditAmount },
      });

      // Create a credit ledger entry
      await CustomerCredit.create({
        customer: customerId,
        amount: creditAmount,
        type: "credit",
        reference: sale._id,
        referenceModel: "Sale",
        notes: `Credit sale ${saleNumber}`,
        user: session.userId,
      });
    }
  }

  // ── Silent receipt print ────────────────────────────────────────────────
  // Fires the ESC/POS job straight at the configured Windows printer (no
  // browser print dialog). A printer that isn't configured/reachable must
  // never block or fail the sale itself — the UI can always trigger a
  // manual reprint via POST /api/sales/[id]/print afterwards.
  let printed = false;
  let printError: string | undefined;
  let printSkipped = false;
  try {
    await sale.populate("customer", "name phone");
    const result = await printReceipt(sale);
    printed = result.success;
    printError = result.error;
    printSkipped = !!result.skipped;
  } catch (err: any) {
    printError = err?.message || "Print failed";
  }

  return NextResponse.json(
    {
      _id: sale._id,
      saleNumber: sale.saleNumber,
      total: sale.total,
      change: sale.change,
      isPaid: sale.isPaid,
      paymentMethod: sale.paymentMethod,
      items: saleItems.map((i) => ({ name: i.name, qty: i.qty, sellingPrice: i.sellingPrice })),
      printed,
      printError,
      printSkipped,
    },
    { status: 201 }
  );
}
