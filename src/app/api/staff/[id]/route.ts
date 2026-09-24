import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Staff } from "@/models/Staff";

// Activate / deactivate / rename — orders that reference the member keep
// their populated name either way.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.phone === "string") update.phone = body.phone || undefined;
  if (body.role === "waiter" || body.role === "rider") update.role = body.role;
  const staff = await Staff.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
}

// PERMANENT delete — only use when the member will never be needed again.
// Past orders referencing them will show a blank name in history views.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const staff = await Staff.findByIdAndDelete(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
