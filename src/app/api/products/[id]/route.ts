import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import "@/models/Category";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const product = await Product.findById(id)
    .populate("category", "name sortOrder")
    .lean();
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const body = await req.json();

  // Build a clean update object with only allowed retail fields
  const update: Record<string, unknown> = {};

  if (body.name != null) update.name = body.name.trim();
  if (body.category != null) update.category = body.category;
  if (body.sellingPrice != null) update.sellingPrice = Number(body.sellingPrice);
  if (body.purchasePrice != null) update.purchasePrice = Number(body.purchasePrice);
  if (body.stock != null) update.stock = Number(body.stock);
  if (body.minStock != null) update.minStock = Number(body.minStock);
  if (body.unit != null) update.unit = body.unit.trim();
  if (body.brand != null) update.brand = body.brand.trim();
  if (body.sku != null) update.sku = body.sku.trim();
  if (body.isActive != null) update.isActive = body.isActive;
  if (body.supplier != null) update.supplier = body.supplier || undefined;

  // Barcode: allow setting, clearing, or changing
  if (body.barcode !== undefined) {
    const barcode = (body.barcode || "").trim();
    if (barcode) {
      // Check uniqueness among other products
      const existing = await Product.findOne({
        barcode,
        isActive: true,
        _id: { $ne: id },
      });
      if (existing) {
        return NextResponse.json(
          { error: `Barcode "${barcode}" is already assigned to "${existing.name}"` },
          { status: 409 }
        );
      }
      update.barcode = barcode;
    } else {
      // Clearing barcode — set to undefined so sparse index ignores it
      update.barcode = undefined;
    }
  }

  const product = await Product.findByIdAndUpdate(id, update, { new: true });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const populated = await Product.findById(product._id)
    .populate("category", "name sortOrder")
    .lean();
  return NextResponse.json(populated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const product = await Product.findByIdAndDelete(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
