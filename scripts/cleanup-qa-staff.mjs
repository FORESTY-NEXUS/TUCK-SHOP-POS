#!/usr/bin/env node
// ---------------------------------------------------------------------------
// cleanup-qa-staff.mjs — removes dummy "QA Tester #####" staff records that
// e2e-round4.mjs creates during its Staff section test. Normally the script
// deletes its own dummy record when it finishes, but if the run crashes
// partway through (e.g. on an earlier assertion), the dummy record is left
// behind. Safe to run any time — only touches names starting with "QA Tester ".
// Usage:  node scripts/cleanup-qa-staff.mjs
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

async function main() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const toRemove = await db.collection("staff").find({ name: { $regex: /^QA Tester \d+$/ } }).toArray();
  if (toRemove.length === 0) {
    console.log("No leftover QA Tester staff found — nothing to do.");
  } else {
    console.log(`Removing ${toRemove.length} leftover QA Tester record(s):`);
    for (const s of toRemove) console.log(`  - ${s.name} (${s._id})`);
    await db.collection("staff").deleteMany({ _id: { $in: toRemove.map((s) => s._id) } });
    console.log("Done.");
  }

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("cleanup failed:", e.message);
  await mongoose.disconnect();
  process.exit(1);
});
