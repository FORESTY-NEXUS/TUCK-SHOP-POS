#!/usr/bin/env node
// ---------------------------------------------------------------------------
// seed-staff.mjs — idempotently adds starter waiters + a rider so the Dine-In
// flow has a "Set Waiter" selection out of the box.
// Usage: node scripts/seed-staff.mjs   (run after seed.mjs on a fresh install)
// ---------------------------------------------------------------------------
import mongoose from "mongoose";
import fs from "fs";

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

const START_STAFF = [
  { name: "Ahmed (Waiter)", role: "waiter", phone: "03001112222" },
  { name: "Usman (Waiter)", role: "waiter", phone: "03003334444" },
  { name: "Bilal (Rider)", role: "rider", phone: "03005556666" },
];

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const count = await db.collection("staff").countDocuments();
  if (count > 0) {
    console.log(`Staff already present (${count}) — nothing to do.`);
  } else {
    await db.collection("staff").insertMany(START_STAFF.map((s) => ({ ...s, isActive: true, createdAt: new Date(), updatedAt: new Date() })));
    console.log(`Seeded ${START_STAFF.length} starter staff: ${START_STAFF.map((s) => s.name).join(", ")}`);
  }
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("seed-staff failed:", e.message);
  await mongoose.disconnect();
  process.exit(1);
});
