import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User, USER_ROLES } from "@/models/User";
import { verifySession, isAdmin, isManagerOrAdmin, SESSION_COOKIE } from "@/lib/auth";
import { isWeakPin, pinInUse } from "@/lib/bootstrap";
import { defaultPermissionsFor, sanitizePermissions } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function sessionFrom(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifySession(token) : null;
}

// GET /api/users — list staff accounts (manager/admin)
export async function GET(req: NextRequest) {
  await connectDB();
  const session = await sessionFrom(req);
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: "Only a manager or admin can view staff" }, { status: 403 });
  }
  const users = await User.find().select("-pinHash").sort({ createdAt: 1 }).lean();
  return NextResponse.json(users);
}

// POST /api/users — create a staff account (manager/admin; only admin can
// create admins). New accounts must choose their own PIN on first login.
export async function POST(req: NextRequest) {
  await connectDB();
  const session = await sessionFrom(req);
  if (!isManagerOrAdmin(session)) {
    return NextResponse.json({ error: "Only a manager or admin can add staff" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const role = body.role ?? "cashier";
  const pin = body.pin;

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!(USER_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (role === "admin" && !isAdmin(session)) {
    return NextResponse.json({ error: "Only an admin can create an admin account" }, { status: 403 });
  }
  if (typeof pin !== "string" || !/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: "Starting PIN must be 4-6 digits" }, { status: 400 });
  }
  if (isWeakPin(pin)) {
    return NextResponse.json({ error: "That starting PIN is too easy to guess" }, { status: 400 });
  }
  if (await pinInUse(pin)) {
    return NextResponse.json({ error: "Another account already uses that PIN" }, { status: 409 });
  }

  const permissions =
    body.permissions !== undefined ? sanitizePermissions(body.permissions) : defaultPermissionsFor(role);

  const user = await User.create({
    name,
    role,
    pinHash: await bcrypt.hash(pin, 10),
    isActive: true,
    mustChangePin: true,
    permissions,
  });
  return NextResponse.json(
    {
      _id: user._id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      mustChangePin: user.mustChangePin,
      permissions: user.permissions,
    },
    { status: 201 }
  );
}
