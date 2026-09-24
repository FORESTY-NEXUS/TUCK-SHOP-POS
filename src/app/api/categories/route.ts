import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/Category";

export const dynamic = "force-dynamic";

export async function GET() {
  await connectDB();
  const categories = await Category.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Check if category already exists
  const existing = await Category.findOne({ name: body.name });
  if (existing) {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }

  // Get next sortOrder
  const lastCat = await Category.findOne().sort({ sortOrder: -1 }).lean();
  const nextSortOrder = (lastCat?.sortOrder ?? -1) + 1;

  const category = await Category.create({
    name: body.name,
    sortOrder: nextSortOrder,
  });

  return NextResponse.json(category, { status: 201 });
}