import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, USER_ROLES } from "@/models/User";
import { verifySession, isAdmin, isManagerOrAdmin, SESSION_COOKIE } from "@/lib/auth";
import { isWeakPin, pinInUse } from "@/lib/bootstrap";
import { sanitizePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// PATCH /api/users/[id] — rename, change role, activate/deactivate, or reset
// a PIN (sets mustChangePin so the person picks their own on next login).
// Accounts are deactivated, never deleted, so sales and shift history keep
// their cashier name.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: "Only a manager or admin can edit staff" }, { status: 403 });
  }

  const { id } = await params;
  const target = await User.findById(id).select("+pinHash");
  if (!target) return NextResponse.json({ error: "Staff account not found" }, { status: 404 });

  // Managers can't touch admin accounts at all.
  if (target.role === "admin" && !isAdmin(session)) {
    return NextResponse.json({ error: "Only an admin can change an admin account" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    update.name = body.name.trim();
  }

  if (body.role !== undefined) {
    if (!(USER_ROLES as readonly string[]).includes(body.role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (body.role === "admin" && !isAdmin(session)) {
      return NextResponse.json({ error: "Only an admin can grant the admin role" }, { status: 403 });
    }
    update.role = body.role;
  }

  if (body.permissions !== undefined) {
    update.permissions = sanitizePermissions(body.permissions);
  }

  if (typeof body.isActive === "boolean") {
    if (!body.isActive && String(target._id) === session.userId) {
      return NextResponse.json({ error: "You can't deactivate your own account" }, { status: 400 });
    }
    update.isActive = body.isActive;
  }

  if (typeof body.resetPin === "string") {
    const pin = body.resetPin;
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: "Reset PIN must be 4-6 digits" }, { status: 400 });
    }
    if (isWeakPin(pin)) {
      return NextResponse.json({ error: "That PIN is too easy to guess" }, { status: 400 });
    }
    if (await pinInUse(pin, String(target._id))) {
      return NextResponse.json({ error: "Another account already uses that PIN" }, { status: 409 });
    }
    update.pinHash = await bcrypt.hash(pin, 10);
    update.mustChangePin = true;
  }

  // Never leave the shop without an active admin.
  const willBeAdmin = (update.role ?? target.role) === "admin";
  const willBeActive = update.isActive ?? target.isActive;
  if (target.role === "admin" && target.isActive && (!willBeAdmin || !willBeActive)) {
    const otherAdmins = await User.countDocuments({
      role: "admin",
      isActive: true,
      _id: { $ne: target._id },
    });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "At least one active admin must remain" }, { status: 400 });
    }
  }

  if (Object.keys(update).length > 0) {
    await User.updateOne({ _id: target._id }, { $set: update });
  }

  const updated = await User.findById(id).select("-pinHash").lean();
  return NextResponse.json(updated);
}
