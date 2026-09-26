import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { signSession, SESSION_COOKIE } from "@/lib/auth";
import { ensureDefaultAdmin } from "@/lib/bootstrap";
import { effectivePermissions } from "@/lib/permissions";

// Lockout: after MAX_FAILURES wrong PINs inside WINDOW_MS, login is paused
// for LOCK_MS. A PIN doesn't identify a user, so this throttle is global.
const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000;
const LOCK_MS = 60 * 1000;
let failures: number[] = [];
let lockedUntil = 0;

export async function POST(req: NextRequest) {
  await connectDB();
  await ensureDefaultAdmin();

  const now = Date.now();
  if (now < lockedUntil) {
    const secs = Math.ceil((lockedUntil - now) / 1000);
    return NextResponse.json(
      { error: `Too many wrong PINs. Try again in ${secs}s.` },
      { status: 429 }
    );
  }

  const { pin } = await req.json().catch(() => ({}));
  if (!pin || typeof pin !== "string") {
    return NextResponse.json({ error: "PIN is required" }, { status: 400 });
  }

  const users = await User.find({ isActive: true }).select("+pinHash").lean();
  let validUser = null;
  for (const user of users) {
    if (await bcrypt.compare(pin, user.pinHash)) {
      validUser = user;
      break;
    }
  }

  if (validUser) {
    failures = [];
    const role = validUser.role as "cashier" | "manager" | "admin";
    const permissions = effectivePermissions(role, validUser.permissions as any);
    const token = await signSession({
      userId: String(validUser._id),
      name: validUser.name,
      role,
      mustChangePin: !!validUser.mustChangePin,
      permissions,
    });
    const res = NextResponse.json({
      name: validUser.name,
      role: validUser.role,
      mustChangePin: !!validUser.mustChangePin,
      permissions,
    });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    return res;
  }

  failures = failures.filter((t) => now - t < WINDOW_MS);
  failures.push(now);
  if (failures.length >= MAX_FAILURES) {
    lockedUntil = now + LOCK_MS;
    failures = [];
  }
  return NextResponse.json({ error: "Incorrect PIN" }, { status: 401 });
}
