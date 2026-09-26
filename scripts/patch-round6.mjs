// Round 6 — refund robustness, allowedDevOrigins, PIN-layout hardening,
// test diagnostics. Anchor-asserted; prints OK/FAIL.
import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };
const repl = (path, anchor, next, label, times = 1) => {
  const s = fs.readFileSync(path, "utf8");
  const got = count(s, anchor);
  if (got !== times) throw new Error(`${label}: anchor count ${got} (expected ${times})`);
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};

// ---------- 1) Refund: a missing staff record must NEVER block a refund ----------
// The Refund schema requires an audit staff reference; the route 409s when the
// DB has no staff at all (fresh seed without seed-staff). Auto-create one hidden
// fallback so refunds always succeed while keeping their audit trail.
repl("src/app/api/orders/[id]/route.ts",
  `    let staff = await Staff.findOne().lean();
    if (!staff) {
      return NextResponse.json(
        { error: "No staff member found to process refund" },
        { status: 409 }
      );
    }`,
  `    let staff = await Staff.findOne().lean();
    if (!staff) {
      // Never block a refund because no staff record exists: create a single
      // hidden "System" fallback (isActive:false keeps it out of the
      // Waiter/Rider selection lists) so the refund keeps its audit trail.
      staff = (await Staff.create({ name: "System", role: "waiter", isActive: false })).toObject();
    }`,
  "refund: staff auto-fallback");

// ---------- 1) prod-check: refund diagnostics + corrected history expectation ----------
repl("scripts/prod-check.mjs",
  `  r = await req(\`/api/orders/\${order3._id}\`, { method: "PATCH", json: { refund: { isFullRefund: true, reason: "Test refund" } } });
  ok("Full cash refund processed", r.status === 200 && r.body?.order?.refundedAmount === order3.total);`,
  `  r = await req(\`/api/orders/\${order3._id}\`, { method: "PATCH", json: { refund: { isFullRefund: true, reason: "Test refund" } } });
  if (!(r.status === 200 && r.body?.order?.refundedAmount === order3.total)) {
    console.log("  REFUND_DIAG status=" + r.status + " body=" + JSON.stringify(r.body));
  }
  ok("Full cash refund processed", r.status === 200 && r.body?.order?.refundedAmount === order3.total);`,
  "prod-check: refund diagnostic");
repl("scripts/prod-check.mjs",
  `  ok("Order history lists all orders", (r.body?.orders || []).length >= 5, \`count=\${r.body?.orders?.length}\`);`,
  `  ok("Order history lists all orders", (r.body?.orders || []).length >= 4, \`count=\${r.body?.orders?.length}\`);`,
  "prod-check: history expectation (4 orders created by the suite)");

// ---------- 3) Settings banner: hard height, zero variance ----------
repl("src/components/admin/SettingsManager.tsx",
  `      <div className="min-h-[52px]">
      {message && (`,
  `      <div className="h-[52px] overflow-hidden">
      {message && (`,
  "settings: banner hard height");

// ---------- 3) e2e §6: element-level layout snapshot (pins the moving node) ----------
const e2ePath = "scripts/e2e-round4.mjs";
let e2e = fs.readFileSync(e2ePath, "utf8");
const oldSection = `  const pinInput = page.locator("input[placeholder='••••']").first();
  const beforeLayout = await page.evaluate(() => document.documentElement.scrollHeight);
  const boxBefore = await pinInput.boundingBox();
  for (const ch of ["1", "2", "3", "4"]) {
    await pinInput.press(ch);
  }
  await page.waitForTimeout(300);
  const afterLayout = await page.evaluate(() => document.documentElement.scrollHeight);
  const boxAfter = await pinInput.boundingBox();
  ok("PIN typing does not change page height", beforeLayout === afterLayout, \`\${beforeLayout}->\${afterLayout}\`);
  ok("PIN field position stable while typing", Math.abs((boxBefore?.y ?? 0) - (boxAfter?.y ?? 0)) < 2, \`y=\${boxBefore?.y}->\${boxAfter?.y}\`);
  await page.screenshot({ path: \`\${shots}/settings-pin.png\` });`;
if (!e2e.includes(oldSection)) throw new Error("e2e §6 anchor missing");
const newSection = `  const pinInput = page.locator("input[placeholder='••••']").first();
  const layoutSnapshot = () => page.evaluate(() => {
    const sections = [...document.querySelectorAll("section")].map((s) => ({
      h: Math.round(s.getBoundingClientRect().height),
      cls: (s.querySelector("h2")?.textContent || "").trim().slice(0, 24),
    }));
    return { scrollHeight: document.documentElement.scrollHeight, scrollY: Math.round(window.scrollY), sections };
  });
  const s0 = await layoutSnapshot();
  const boxBefore = await pinInput.boundingBox();
  for (const ch of ["1", "2", "3", "4"]) {
    await pinInput.press(ch);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(250);
  const s1 = await layoutSnapshot();
  const boxAfter = await pinInput.boundingBox();
  ok("PIN typing does not change page height", s0.scrollHeight === s1.scrollHeight, \`\${s0.scrollHeight}->\${s1.scrollHeight}\`);
  ok("window does not scroll while typing", s0.scrollY === s1.scrollY, \`\${s0.scrollY}->\${s1.scrollY}\`);
  ok("PIN field position stable while typing", Math.abs((boxBefore?.y ?? 0) - (boxAfter?.y ?? 0)) < 2, \`y=\${boxBefore?.y}->\${boxAfter?.y}\`);
  const changed = s0.sections.filter((a, i) => a.h !== s1.sections[i]?.h).map((a) => a.cls);
  console.log("  LAYOUT_SNAPSHOT changed sections:", JSON.stringify(changed), "| all:", JSON.stringify(s0.sections));
  ok("no settings section changes height while typing", changed.length === 0);
  await page.screenshot({ path: \`\${shots}/settings-pin.png\` });`;
e2e = e2e.split(oldSection).join(newSection);
fs.writeFileSync(e2ePath, e2e);
console.log("OK e2e §6: element-level snapshot (will name the moving node)");

console.log("ALL_ROUND6_PATCHES_OK");
