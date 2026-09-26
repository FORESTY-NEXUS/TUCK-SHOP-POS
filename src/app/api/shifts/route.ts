import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Shift } from "@/models/Shift";
// Required even though not referenced directly: Shift.cashier populates
// against the "User" model by ref name, and Mongoose only knows how to
// resolve that ref if the User schema has been registered first. Without
// this import, whichever route runs first in a fresh server process
// determines whether "User" happens to already be registered elsewhere —
// hence the intermittent "Schema hasn't been registered for model 'User'"
// crash on a cold start.
import "@/models/User";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/shifts — list all shifts (for shift history / reports)
export async function GET(req: NextRequest) {
  await connectDB();

  const PAGE_SIZE = 20;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") || "1", 10));
  // current=1 → return only the open shift; current=0 → return all (history)
  const currentParam = req.nextUrl.searchParams.get("current");
  const filter = currentParam === "1" ? { isOpen: true } : {};

  const [shifts, totalCount] = await Promise.all([
    Shift.find(filter)
      .populate("cashier", "name")
      .sort({ openedAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Shift.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return NextResponse.json({
    shifts: shifts.map(s => ({
      _id: s._id,
      cashier: s.cashier,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingBalance: s.openingBalance,
      closingBalance: s.closingBalance,
      expectedCash: s.expectedCash,
      difference: s.difference,
      isOpen: s.isOpen,
      // Breakdown is stored in the close response; we can serialize it here
      byMethod: (s as any).byMethod || null,
      orderCount: (s as any).orderCount || 0,
    })),
    totalCount,
    page,
    totalPages,
    pageSize: PAGE_SIZE,
  });
}

// POST /api/shifts — start a new shift
export async function POST(req: NextRequest) {
  await connectDB();

  // The cashier is whoever is logged in — derive it from the session cookie.
  // (The old code read `cashierId` out of the request body, but the UI never
  // sends one, so the field was `undefined` and Mongoose's required:true
  // validation rejected the shift with a 500 — no shift could ever start.)
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { openingBalance = 0 } = body;

  // Check if there's already an open shift
  const existingOpen = await Shift.findOne({ isOpen: true });
  if (existingOpen) {
    return NextResponse.json(
      { error: "A shift is already open. Close it first." },
      { status: 409 }
    );
  }

  try {
    const shift = await Shift.create({
      cashier: session.userId,
      openingBalance,
      isOpen: true,
    });
    return NextResponse.json(shift, { status: 201 });
  } catch (err: any) {
    if (err?.code === 11000) {
      // Someone else's request opened a shift in the gap between our
      // findOne check above and this create.
      return NextResponse.json(
        { error: "A shift is already open. Close it first." },
        { status: 409 }
      );
    }
    throw err;
  }
}
