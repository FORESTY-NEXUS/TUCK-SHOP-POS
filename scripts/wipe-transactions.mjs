#!/usr/bin/env node
// ---------------------------------------------------------------------------
// wipe-transactions.mjs — reset the DB to a clean slate before client handover.
//   Deletes ONLY transactional data: orders, refunds, shifts (+ resets the
//   order-number counter and customers' loyalty points, which derive from
//   orders). Everything the cafe configures is preserved:
//   products, categories (incl. variants), staff, settings, customers.
// Usage:  node scripts/wipe-transactions.mjs
// ---------------------------------------------------------------------------
import mongoose from "mongoose";
import fs from "fs";

// Load MONGODB_URI from .env.local without depending on the dotenv package.
function envUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    const m = env.match(/^MONGODB_URI=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  return null;
}

const uri = envUri() || "mongodb://127.0.0.1:27017/sevesto";

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const before = {
    orders: await db.collection("orders").countDocuments(),
    refunds: await db.collection("refunds").countDocuments(),
    shifts: await db.collection("shifts").countDocuments(),
    products: await db.collection("products").countDocuments(),
    categories: await db.collection("categories").countDocuments(),
    staff: await db.collection("staff").countDocuments(),
  };

  await db.collection("orders").deleteMany({});
  await db.collection("refunds").deleteMany({});
  await db.collection("shifts").deleteMany({});

  // Reset the order-number counter so numbering starts fresh (safe: orders
  // are gone, so no collisions with historical numbers).
  await db.collection("counters").deleteMany({ _id: "orderNumber" });

  // Loyalty points live on customers but accrue from orders — reset them.
  const resCustomers = await db.collection("customers").updateMany({}, { $set: { loyaltyPoints: 0 } });

  const after = {
    orders: await db.collection("orders").countDocuments(),
    refunds: await db.collection("refunds").countDocuments(),
    shifts: await db.collection("shifts").countDocuments(),
    products: await db.collection("products").countDocuments(),
    categories: await db.collection("categories").countDocuments(),
    staff: await db.collection("staff").countDocuments(),
  };

  console.log("WIPE COMPLETE");
  console.log(`  orders   ${before.orders} -> ${after.orders}`);
  console.log(`  refunds  ${before.refunds} -> ${after.refunds}`);
  console.log(`  shifts   ${before.shifts} -> ${after.shifts}`);
  console.log(`  counters orderNumber reset`);
  console.log(`  customers loyaltyPoints reset on ${resCustomers.modifiedCount} records`);
  console.log("PRESERVED");
  console.log(`  products=${after.products} categories=${after.categories} staff=${after.staff} settings=kept`);
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("wipe failed:", e.message);
  await mongoose.disconnect();
  process.exit(1);
});
