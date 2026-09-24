import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// A barcode must be unique across the whole store — whether it lives on a
// plain product's top-level `barcode` or inside another product's
// `variants[].barcode`. The two fields have separate DB indexes, so this
// app-level check is what catches a collision *between* the two.
export async function findProductByAnyBarcode(barcode: string, excludeId?: string) {
  const filter: Record<string, unknown> = {
    isActive: true,
    $or: [{ barcode }, { "variants.barcode": barcode }],
  };
  if (excludeId) filter._id = { $ne: excludeId };
  return Product.findOne(filter);
}

export async function GET(req: NextRequest) {
  await connectDB();
  const includeAll = req.nextUrl.searchParams.get("all") === "1";
  const filter = includeAll ? {} : { isActive: true };
  const products = await Product.find(filter)
    .populate("category", "name sortOrder")
    .sort({ name: 1 })
    .lean();
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();

  if (!body.name || !body.category) {
    return NextResponse.json(
      { error: "name and category are required" },
      { status: 400 }
    );
  }

  // sellingPrice is only required when the product has no variants — a
  // variants-only product (e.g. plain "Pepsi" sold as Can/1L/1.5L) is
  // allowed to skip its own base price as long as every size below has one.
  const hasVariantsInput = Array.isArray(body.variants) && body.variants.length > 0;
  if (body.sellingPrice == null && !hasVariantsInput) {
    return NextResponse.json(
      { error: "Set a selling price, or add at least one size/pack with its own price" },
      { status: 400 }
    );
  }

  let categoryId = body.category;

  // If category is a string name (not ObjectId), find or create the Category document
  if (typeof categoryId === "string" && !Types.ObjectId.isValid(categoryId)) {
    let cat = await Category.findOne({ name: categoryId });
    if (!cat) {
      const lastCat = await Category.findOne().sort({ sortOrder: -1 }).lean();
      const nextSortOrder = (lastCat?.sortOrder ?? -1) + 1;
      cat = await Category.create({ name: categoryId, sortOrder: nextSortOrder });
    }
    categoryId = cat._id;
  }

  // Barcode uniqueness: if barcode is provided but already in use, reject.
  const barcode = body.barcode?.trim() || "";
  if (barcode) {
    const existing = await findProductByAnyBarcode(barcode);
    if (existing) {
      return NextResponse.json(
        { error: `Barcode "${barcode}" is already assigned to "${existing.name}"` },
        { status: 409 }
      );
    }
  }

  // Variants (optional): validate + de-dupe barcodes against everything
  // else in the store (other products' top-level barcodes AND their
  // variants), plus against each other within this same submission.
  const variantsInput = Array.isArray(body.variants) ? body.variants : [];
  const seenInThisRequest = new Set<string>(barcode ? [barcode] : []);
  const variants = [];
  for (const v of variantsInput) {
    if (!v?.name?.trim() || v.sellingPrice == null) {
      return NextResponse.json(
        { error: "Each variant needs a name and a selling price" },
        { status: 400 }
      );
    }
    const vBarcode = v.barcode?.trim() || "";
    if (vBarcode) {
      if (seenInThisRequest.has(vBarcode)) {
        return NextResponse.json(
          { error: `Barcode "${vBarcode}" is used more than once on this product` },
          { status: 409 }
        );
      }
      const existing = await findProductByAnyBarcode(vBarcode);
      if (existing) {
        return NextResponse.json(
          { error: `Barcode "${vBarcode}" is already assigned to "${existing.name}"` },
          { status: 409 }
        );
      }
      seenInThisRequest.add(vBarcode);
    }
    variants.push({
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

  const product = await Product.create({
    name: body.name.trim(),
    barcode: barcode || undefined, // omit empty so sparse index allows multiple nulls
    sku: body.sku?.trim() || undefined,
    category: categoryId,
    purchasePrice: Number(body.purchasePrice) || 0,
    sellingPrice: body.sellingPrice != null ? Number(body.sellingPrice) : undefined,
    stock: Number(body.stock) || 0,
    minStock: body.minStock != null ? Number(body.minStock) : 5,
    unit: body.unit?.trim() || "piece",
    brand: body.brand?.trim() || undefined,
    supplier: body.supplier || undefined,
    variants,
  });

  const populated = await Product.findById(product._id)
    .populate("category", "name sortOrder")
    .lean();
  return NextResponse.json(populated, { status: 201 });
}
