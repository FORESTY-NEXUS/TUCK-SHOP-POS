import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/User";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { Settings } from "@/models/Settings";
import { Customer } from "@/models/Customer";
import { Counter } from "@/models/Counter";
import { Sale } from "@/models/Sale";
import { Shift } from "@/models/Shift";
import { CustomerCredit } from "@/models/CustomerCredit";
import { StockMovement } from "@/models/StockMovement";
import { verifySession, isAdmin, SESSION_COOKIE } from "@/lib/auth";

// Full DB backup for a single-machine POS.
// Export: GET /api/settings/backup  -> JSON snapshot of every collection.
// Import: POST /api/settings/backup (multipart "file") -> FULL REPLACE.
//
// Why full replace and not merge: this app runs on one machine with one
// database; a backup is a point-in-time snapshot of that machine. Merging
// order/counter/settings state is how duplicates, gap-numbered orders and
// contradictory settings creep in. Replace is unambiguous: after restore
// the DB IS the backup.

const COLLECTIONS: { name: string; model: any }[] = [
  { name: "users", model: User },
  { name: "categories", model: Category },
  { name: "products", model: Product },
  { name: "settings", model: Settings },
  { name: "customers", model: Customer },
  { name: "counters", model: Counter },
  { name: "sales", model: Sale },
  { name: "customer_credits", model: CustomerCredit },
  { name: "stock_movements", model: StockMovement },
  { name: "shifts", model: Shift },
];

export async function GET(req: NextRequest) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Only an admin can export a full backup" }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  for (const { name, model } of COLLECTIONS) {
    data[name] = await model.find({}).lean();
  }
  return NextResponse.json({
    app: "sevesto-pos",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    collections: data,
  });
}

export async function POST(req: NextRequest) {
  await connectDB();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Only an admin can restore a backup" }, { status: 403 });
  }

  let payload: any;
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing backup file" }, { status: 400 });
    }
    payload = JSON.parse(await file.text());
  } catch (e: any) {
    return NextResponse.json({ error: "Invalid backup file: " + (e?.message || "unparseable") }, { status: 400 });
  }

  // Validate the snapshot
  if (payload?.app !== "sevesto-pos" || payload?.formatVersion !== 1 || !payload?.collections || typeof payload.collections !== "object") {
    return NextResponse.json({ error: "Not a valid Sevesto POS backup file" }, { status: 400 });
  }
  const missing = COLLECTIONS.filter(({ name }) => name in payload.collections === false).map(({ name }) => name);
  if (missing.length > 0) {
    return NextResponse.json({ error: `Backup is missing collections: ${missing.join(", ")}` }, { status: 400 });
  }

  // Full replace: drop each collection, then re-insert the backup's documents.
  const counts: Record<string, number> = {};
  for (const { name, model } of COLLECTIONS) {
    const docs = Array.isArray(payload.collections[name]) ? payload.collections[name] : [];
    await model.deleteMany({});
    if (docs.length > 0) {
      await model.insertMany(docs, { ordered: false, limit: undefined });
    }
    counts[name] = docs.length;
  }

  return NextResponse.json({
    success: true,
    restoredAt: new Date().toISOString(),
    collections: counts,
  });
}
