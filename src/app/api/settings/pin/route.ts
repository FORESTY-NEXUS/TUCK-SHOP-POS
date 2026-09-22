import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import bcrypt from "bcryptjs";

// Change PIN: requires the CURRENT pin to be verified before the new one is
// set, so the default 1234 can be replaced on the client's live install.
export async function POST(req: NextRequest) {
  await connectDB();
  const body = await req.json().catch(() => ({}));
  const { currentPin, newPin } = body;

  if (typeof currentPin !== "string" || currentPin.length === 0) {
    return NextResponse.json({ error: "Current PIN is required" }, { status: 400 });
  }
  if (typeof newPin !== "string" || !/^\d{4,6}$/.test(newPin)) {
    return NextResponse.json({ error: "New PIN must be 4-6 digits" }, { status: 400 });
  }

  const user = await User.findOne({}).select("+pinHash");
  if (!user) {
    return NextResponse.json({ error: "No staff user found" }, { status: 404 });
  }

  const valid = await bcrypt.compare(currentPin, user.pinHash);
  if (!valid) {
    return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
  }

  const hash = await bcrypt.hash(newPin, 10);
  await User.updateOne({ _id: user._id }, { pinHash: hash });

  return NextResponse.json({ success: true });
}
