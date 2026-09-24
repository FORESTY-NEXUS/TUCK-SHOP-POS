import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Staff } from "@/models/Staff";

export async function GET(req: NextRequest) {
  await connectDB();
  const role = req.nextUrl.searchParams.get("role");
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
  if (role) filter.role = role;
  const staff = await Staff.find(filter).lean();
  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  if (!body.name || !body.role) {
    return NextResponse.json({ error: "name and role are required" }, { status: 400 });
  }
  const staff = await Staff.create({ name: body.name, role: body.role, phone: body.phone });
  return NextResponse.json(staff, { status: 201 });
}
