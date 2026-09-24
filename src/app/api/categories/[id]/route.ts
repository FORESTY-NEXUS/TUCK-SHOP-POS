import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const body = await req.json();

  const category = await Category.findByIdAndUpdate(
    id,
    { $set: body },
    { new: true, runValidators: true }
  );
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  return NextResponse.json(category);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;

  // Check if any products use this category
  const productCount = await Product.countDocuments({ category: id });
  if (productCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete category: ${productCount} product(s) still use it` },
      { status: 409 }
    );
  }

  const category = await Category.findByIdAndDelete(id);
  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}