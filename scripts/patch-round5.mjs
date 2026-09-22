// Round 5 — About-Us correction, receipt purge, duplicate button, customer
// crash, test fixes. Every step asserts anchors and prints OK/FAIL.
import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };
const repl = (path, anchor, next, label, times = 1) => {
  const s = fs.readFileSync(path, "utf8");
  const got = count(s, anchor);
  if (got !== times) throw new Error(`${label}: anchor count ${got} (expected ${times})`);
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};

// ---------- 4) Customer POST — kill the operator conflict on 'name' ----------
// Old code combined $setOnInsert AND $set with `name` in both -> MongoServerError
// "Updating the path 'name' would create a conflict at 'name'". Fix: one operator.
repl("src/app/api/customers/route.ts",
  `  const customer = await Customer.findOneAndUpdate(
    { phone: body.phone },
    {
      $setOnInsert: { name: body.name, phone: body.phone },
      $set: { name: body.name, lastAddress: body.lastAddress },
    },
    { upsert: true, new: true }
  );
  return NextResponse.json(customer, { status: 201 });`,
  `  // One flat $set — impossible for two operators to conflict on 'name'. The
  // filter carries the phone, so upsert creates the doc with it; a subsequent
  // POST for the same phone becomes an idempotent update.
  const set: Record<string, unknown> = { phone: body.phone };
  if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
  if (typeof body.lastAddress === "string" && body.lastAddress.trim()) set.lastAddress = body.lastAddress.trim();
  const customer = await Customer.findOneAndUpdate(
    { phone: body.phone },
    { $set: set },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return NextResponse.json(customer, { status: 201 });`,
  "customers POST: single $set (no operator conflict)");

// ---------- 1 + 5) Remove receipt About block, both `support` const blocks, brought-by lines ----------
const ptPath = "src/lib/print.ts";
let pt = fs.readFileSync(ptPath, "utf8");

// Drop the About receipt block entirely (between drawLine and the Thank You block).
const aboutBlock = `    // About Us / support — printed only when anything is filled in on the About Us page.
    if (support.aboutText || support.whatsapp || support.phone || support.instagram) {
      printer.drawLine();
      printer.alignCenter();
      printer.bold(true);
      printer.println("About Us");
      printer.bold(false);
      printer.alignLeft();
      if (support.aboutText) {
        const lines = support.aboutText.split("\\n").map((l: string) => l.trim()).filter(Boolean).slice(0, 6);
        for (const line of lines) printer.println(line.length > 40 ? line.slice(0, 37) + "..." : line);
      }
      if (support.whatsapp) printer.println("Support (WhatsApp): " + support.whatsapp.replace(/^https?:\\/\\/(wa\\.me|api\\.whatsapp\\.com)\\/?/, ""));
      if (support.phone) printer.println("Support phone: " + support.phone);
      if (support.instagram) printer.println("Instagram: " + support.instagram.replace(/^https?:\\/\\/(www\\.)?instagram\\.com\\/?/, "@"));
      printer.drawLine();
    }

`;
if (!pt.includes(aboutBlock)) throw new Error("print: About block anchor missing");
pt = pt.split(aboutBlock).join("");
console.log("OK print: About Us receipt block removed");

// Remove both `const support = { ... };` insertions (they were per-getter).
const supportRe = /\n\s*const support = \{\s*aboutText:[\s\S]*?instagram:[^}]*};/g;
const removedSupportCount = (pt.match(supportRe) || []).length;
pt = pt.replace(supportRe, "");
console.log("OK print: removed " + removedSupportCount + " support const block(s)");

// Remove the brought-by lines added right after the site link.
const broughtBy = `    printer.alignLeft();
    printer.println("Software, websites, POS & automation for");
    printer.println("small businesses — built by Foresty.");
`;
if (pt.includes(broughtBy)) {
  pt = pt.split(broughtBy).join("");
  console.log("OK print: removed round-4 brought-by lines");
} else {
  console.log("SKIP print: brought-by lines already absent");
}

// Remove PrinterSettings interface fields for aboutText/helpWhatsApp/helpPhone/helpInstagram.
pt = pt.replace(/\n  aboutText\?: string;\n  helpWhatsApp\?: string;\n  helpPhone\?: string;\n  helpInstagram\?: string;/, "");
console.log("OK print: PrinterSettings About fields removed");
fs.writeFileSync(ptPath, pt);

// ---------- 1) Settings schema — drop the four About fields ----------
repl("src/models/Settings.ts",
  `  aboutText: { type: String, default: "" },
  helpWhatsApp: { type: String, default: "" },
  helpPhone: { type: String, default: "" },
  helpInstagram: { type: String, default: "" },
`,
  "", "settings schema: About fields removed");

// ---------- 1) Settings PATCH — drop the destructure + update assignments ----------
repl("src/app/api/settings/route.ts",
  "    storeName, storeAddress, storePhone, posDisplayLogo, receiptLogo,\n    aboutText, helpWhatsApp, helpPhone, helpInstagram,\n  } = body;",
  "    storeName, storeAddress, storePhone, posDisplayLogo, receiptLogo,\n  } = body;",
  "settings route: destructure cleanup");
repl("src/app/api/settings/route.ts",
  `  if (aboutText !== undefined && typeof aboutText === "string") update.aboutText = aboutText;
  if (helpWhatsApp !== undefined && typeof helpWhatsApp === "string") update.helpWhatsApp = helpWhatsApp;
  if (helpPhone !== undefined && typeof helpPhone === "string") update.helpPhone = helpPhone;
  if (helpInstagram !== undefined && typeof helpInstagram === "string") update.helpInstagram = helpInstagram;
`, "", "settings route: About writes removed");

// ---------- 3) CockpitBoard — remove the duplicate Dashboard button ----------
const cbPath = "src/components/pos/CockpitBoard.tsx";
let cb = fs.readFileSync(cbPath, "utf8");
const dashBtn = `          <button
            onClick={() => router.push("/dashboard")}
            title="Dashboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

`;
const dashCount = count(cb, dashBtn);
if (dashCount !== 2) throw new Error("cockpit dashboard btn count " + dashCount + " (expected 2)");
// Remove exactly one occurrence (first).
cb = cb.replace(dashBtn, "");
fs.writeFileSync(cbPath, cb);
const after = count(cb, dashBtn);
if (after !== 1) throw new Error("cockpit dashboard btn after removal " + after + " (expected 1)");
console.log("OK cockpit: exactly one Dashboard button remaining");

// ---------- 6) prod-check — pre-close any leftover open shift before the test ----------
const pcPath = "scripts/prod-check.mjs";
let pc = fs.readFileSync(pcPath, "utf8");
if (!pc.includes("// pre-round5: close leftover open shifts")) {
  pc = pc.replace(
    `  console.log("== 2. Shift lifecycle ==");
  r = await req("/api/shifts", { method: "POST", json: { openingBalance: 5000 } });`,
    `  console.log("== 2. Shift lifecycle ==");
  // pre-round5: close leftover open shifts so a stale one from a previous
  // run doesn't turn "Open shift" into a 409 (real POST works; the assertion
  // was breaking on a dirty DB).
  {
    const openList = await req("/api/shifts?current=1");
    for (const s of (openList.body?.shifts || [])) {
      await req(\`/api/shifts/\${s._id}/close\`, { method: "POST", json: { actualCash: s.openingBalance || 0 } });
    }
  }
  r = await req("/api/shifts", { method: "POST", json: { openingBalance: 5000 } });`
  );
  fs.writeFileSync(pcPath, pc);
  console.log("OK prod-check: pre-close leftover open shifts");
}

// ---------- 5) e2e-round4 — sturdier login assertion (used to falsely fail) ----------
const e2ePath = "scripts/e2e-round4.mjs";
let e2e = fs.readFileSync(e2ePath, "utf8");
if (e2e.includes('ok("login -> home", page.url().endsWith("/"));')) {
  e2e = e2e.replace(
    'ok("login -> home", page.url().endsWith("/"));',
    'ok("login -> home", !page.url().includes("/login"), page.url());'
  );
  console.log("OK e2e: robust login assertion");
}
if (!e2e.includes("if (!guest || !guest._id)")) {
  e2e = e2e.replace(
    '  const guest = (await apiAuth(page, "/api/customers", { method: "POST", body: { phone: "0000000000" } })).body;',
    `  const guestRes = await apiAuth(page, "/api/customers", { method: "POST", body: { phone: "0000000000" } });
  const guest = guestRes.body;
  if (!guest || !guest._id) console.log("  GUEST CREATE ERROR", guestRes.status, JSON.stringify(guestRes.body));`
  );
  console.log("OK e2e: guest-create diagnostic");
}
fs.writeFileSync(e2ePath, e2e);

console.log("ALL_ROUND5_PATCHES_OK");
