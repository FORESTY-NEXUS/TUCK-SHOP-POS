import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";
import { verifySession, signSession, SESSION_COOKIE } from "@/lib/auth";
import { isWeakPin, pinInUse } from "@/lib/bootstrap";
import { effectivePermissions } from "@/lib/permissions";

// Change your OWN PIN. Requires the current PIN. Any logged-in user can do
// this (a cashier forced to change a reset PIN must be able to finish).
export async function POST(req: NextRequest) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { currentPin, newPin } = body;

  if (typeof currentPin !== "string" || currentPin.length === 0) {
    return NextResponse.json({ error: "Current PIN is required" }, { status: 400 });
  }
  if (typeof newPin !== "string" || !/^\d{4,6}$/.test(newPin)) {
    return NextResponse.json({ error: "New PIN must be 4-6 digits" }, { status: 400 });
  }
  if (isWeakPin(newPin)) {
    return NextResponse.json({ error: "That PIN is too easy to guess. Choose another." }, { status: 400 });
  }

  const user = await User.findById(session.userId).select("+pinHash");
  if (!user) {
    return NextResponse.json({ error: "Your account couldn't be found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPin, user.pinHash);
  if (!valid) {
    return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  if (await pinInUse(newPin, String(user._id))) {
    return NextResponse.json({ error: "Another account already uses that PIN" }, { status: 409 });
  }

  await User.updateOne(
    { _id: user._id },
    { $set: { pinHash: await bcrypt.hash(newPin, 10), mustChangePin: false } }
  );

  // Re-issue the session so the "must change PIN" flag is cleared.
  const role = user.role as "cashier" | "manager" | "admin";
  const newToken = await signSession({
    userId: String(user._id),
    name: user.name,
    role,
    mustChangePin: false,
    permissions: effectivePermissions(role, user.permissions as any),
  });
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, newToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
