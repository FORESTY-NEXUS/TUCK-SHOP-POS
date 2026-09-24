import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { findProductByAnyBarcode } from "../route";
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

  const existingProduct = await Product.findById(id).lean();
  if (!existingProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Build a clean update object with only allowed retail fields
  const update: Record<string, unknown> = {};
  const unset: Record<string, ""> = {};

  if (body.name != null) update.name = body.name.trim();
  if (body.category != null) update.category = body.category;
  // sellingPrice: an empty string/null explicitly clears the base price
  // (allowed once the product has variants covering it) rather than being
  // saved as a literal 0.
  if (body.sellingPrice !== undefined) {
    if (body.sellingPrice === null || body.sellingPrice === "") {
      unset.sellingPrice = "";
    } else {
      update.sellingPrice = Number(body.sellingPrice);
    }
  }
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
      const existing = await findProductByAnyBarcode(barcode, id);
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

  // Variants: optional, opt-in. Only touched if the client sends the field
  // at all, so requests from parts of the UI that don't know about
  // variants (yet) leave existing variants untouched.
  if (body.variants !== undefined) {
    const variantsInput = Array.isArray(body.variants) ? body.variants : [];
    const seenInThisRequest = new Set<string>(
      update.barcode ? [update.barcode as string] : []
    );
    const variants = [];
    for (const v of variantsInput) {
      if (!v?.name?.trim() || v.sellingPrice == null) {
        return NextResponse.json(
          { error: "Each variant needs a name and a selling price" },
          { status: 400 }
        );
      }
      const vBarcode = (v.barcode || "").trim();
      if (vBarcode) {
        if (seenInThisRequest.has(vBarcode)) {
          return NextResponse.json(
            { error: `Barcode "${vBarcode}" is used more than once on this product` },
            { status: 409 }
          );
        }
        const existing = await findProductByAnyBarcode(vBarcode, id);
        if (existing) {
          return NextResponse.json(
            { error: `Barcode "${vBarcode}" is already assigned to "${existing.name}"` },
            { status: 409 }
          );
        }
        seenInThisRequest.add(vBarcode);
      }
      variants.push({
        // Keep the existing _id when editing a variant so cart/sale
        // history referencing it by id stays valid; new variants get a
        // fresh one from Mongoose.
        _id: v._id || undefined,
        name: v.name.trim(),
        barcode: vBarcode || undefined,
        sku: v.sku?.trim() || undefined,
        sellingPrice: Number(v.sellingPrice),
        purchasePrice: Number(v.purchasePrice) || 0,
        stock: Number(v.stock) || 0,
        minStock: v.minStock != null ? Number(v.minStock) : 5,
        isActive: v.isActive !== false,
      });
    }
    update.variants = variants;
  }

  // Final-state check: after this update lands, the product needs a price
  // from somewhere — its own base price, or at least one variant (each
  // variant is already guaranteed to have its own price, above).
  const finalHasOwnPrice = unset.sellingPrice
    ? false
    : update.sellingPrice != null
      ? true
      : existingProduct.sellingPrice != null;
  const finalVariants = update.variants !== undefined ? (update.variants as unknown[]) : existingProduct.variants;
  if (!finalHasOwnPrice && (!finalVariants || finalVariants.length === 0)) {
    return NextResponse.json(
      { error: "Set a selling price, or add at least one size/pack with its own price" },
      { status: 400 }
    );
  }

  const updateOps: Record<string, unknown> = { ...update };
  if (Object.keys(unset).length > 0) updateOps.$unset = unset;

  const product = await Product.findByIdAndUpdate(id, updateOps, { new: true });
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
