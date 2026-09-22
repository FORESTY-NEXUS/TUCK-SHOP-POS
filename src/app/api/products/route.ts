import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import { Types } from "mongoose";

export const dynamic = "force-dynamic";
export const revalidate = 60;

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

  if (!body.name || body.sellingPrice == null || !body.category) {
    return NextResponse.json(
      { error: "name, sellingPrice, and category are required" },
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
    const existing = await Product.findOne({ barcode, isActive: true });
    if (existing) {
      return NextResponse.json(
        { error: `Barcode "${barcode}" is already assigned to "${existing.name}"` },
        { status: 409 }
      );
    }
  }

  const product = await Product.create({
    name: body.name.trim(),
    barcode: barcode || undefined, // omit empty so sparse index allows multiple nulls
    sku: body.sku?.trim() || undefined,
    category: categoryId,
    purchasePrice: Number(body.purchasePrice) || 0,
    sellingPrice: Number(body.sellingPrice),
    stock: Number(body.stock) || 0,
    minStock: body.minStock != null ? Number(body.minStock) : 5,
    unit: body.unit?.trim() || "piece",
    brand: body.brand?.trim() || undefined,
    supplier: body.supplier || undefined,
  });

  const populated = await Product.findById(product._id)
    .populate("category", "name sortOrder")
    .lean();
  return NextResponse.json(populated, { status: 201 });
}
