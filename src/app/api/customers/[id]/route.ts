import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Customer } from "@/models/Customer";
import { z } from "zod";

const UpdateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(200).optional().or(z.literal("").transform(() => undefined)),
  phone: z.string().trim().min(10).max(20).optional(),
  lastAddress: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const customer = await Customer.findById(id).lean();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json(customer);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;

  const customer = await Customer.findById(id).lean();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = UpdateCustomerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, phone, lastAddress } = parsed.data;
  const update: Record<string, unknown> = {};
  if (name !== undefined) update.name = name;
  if (phone !== undefined) update.phone = phone;
  if (lastAddress !== undefined) update.lastAddress = lastAddress;

  const updated = await Customer.findByIdAndUpdate(id, update, { new: true, runValidators: true }).lean();
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await connectDB();
  const { id } = await params;
  const customer = await Customer.findById(id).lean();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  
  await Customer.findByIdAndDelete(id);
  return NextResponse.json({ success: true });
}