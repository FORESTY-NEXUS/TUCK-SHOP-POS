import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";

export async function GET(req: NextRequest) {
  await connectDB();
  const query = req.nextUrl.searchParams.get("query")?.trim();

  // With a query: search-by-phone/name for the order intake search box.
  // Without one: full directory (customers page, loyalty page, admin).
  const filter = query
    ? {
        $or: [
          { phone: { $regex: query, $options: "i" } },
          { name: { $regex: query, $options: "i" } },
        ],
      }
    : {};

  const customers = await Customer.find(filter)
    .sort({ createdAt: -1 })
    .limit(query ? 8 : 2000)
    .lean();

  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json();
  if (!body.phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }
  // One flat $set — impossible for two operators to conflict on 'name'. The
  // filter carries the phone, so upsert creates the doc with it; a subsequent
  // POST for the same phone becomes an idempotent update.
  const set: Record<string, unknown> = { phone: body.phone };
  if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
  if (typeof body.lastAddress === "string" && body.lastAddress.trim()) set.lastAddress = body.lastAddress.trim();
  const customer = await Customer.findOneAndUpdate(
    { phone: body.phone },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return NextResponse.json(customer, { status: 201 });
}
