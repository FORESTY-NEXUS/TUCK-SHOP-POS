// Round 4 live browser verification — REAL clicks against a running dev
// server. Requires: mongod up, DB seeded with orders on two days, app on :3000.
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://127.0.0.1:3000";
let passes = 0, failures = 0;
const ok = (n, c, x = "") => { if (c) { passes++; console.log("  PASS | " + n + (x ? " | " + x : "")); } else { failures++; console.log("  FAIL | " + n + (x ? " | " + x : "")); } };
const shots = "/home/user/workspace/shots-r4";
fs.mkdirSync(shots, { recursive: true });

async function apiAuth(page, path, opts = {}) {
  return page.evaluate(async ({ path, opts }) => {
    const res = await fetch(path, {
      method: opts.method || "GET",
      headers: { "content-type": "application/json" },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let b = null; try { b = await res.json(); } catch {}
    return { status: res.status, body: b };
  }, { path, opts });
}

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => console.log("  PAGEERROR | " + e.message));

  console.log("== 1. Login ==");
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  for (const d of "1234") await page.click(`text=${d}`);
  await page.waitForURL((u) => u.pathname === "/", { timeout: 12000 }).catch(() => {});
  ok("login -> home", !page.url().includes("/login"), page.url());

  console.log("== 2. Create one order of each type (via API, with session) ==");
  const cats = await apiAuth(page, "/api/categories");
  const prods = await apiAuth(page, "/api/products");
  const P = prods.body?.[0];
  const catId = P?.category?._id || P?.category;
  const guestRes = await apiAuth(page, "/api/customers", { method: "POST", body: { phone: "0000000000" } });
  const guest = guestRes.body;
  if (!guest || !guest._id) console.log("  GUEST CREATE ERROR", guestRes.status, JSON.stringify(guestRes.body));
  const created = [];
  for (const [type, extra] of [["dine_in", { table: "T4", guests: 2 }], ["takeaway", {}], ["delivery", { deliveryAddress: "QA Street 9", deliveryCharges: 150 }]]) {
    const r = await apiAuth(page, "/api/orders", {
      method: "POST",
      body: { type, customerId: guest._id, items: [{ productId: P._id, qty: 1 }], ...extra },
    });
    created.push(r.body);
  }
  ok("3 orders created (dine_in/takeaway/delivery)", created.length === 3 && created.every((o) => o?._id), created.map((o) => o?.orderNumber).join(","));

  console.log("== 3. REGRESSION #1: Receipt button on EVERY row, all 3 tabs ==");
  await page.goto(BASE + "/pos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  for (const [tab, label] of [["dine_in", "Dine In"], ["takeaway", "Take Away"], ["delivery", "Delivery"]]) {
    await page.click(`[data-testid="cockpit-tab-${tab}"]`);
    await page.waitForTimeout(600);
    const rows = await page.locator("tbody tr:not(:has(td[colspan]))").count();
    const hasKitchen = (await page.locator(`tbody tr:not(:has(td[colspan]))`).getByRole("button", { name: "Kitchen" }).count()) > 0;
    const hasReceipt = (await page.locator(`tbody tr:not(:has(td[colspan]))`).getByRole("button", { name: "Receipt" }).count()) > 0;
    await page.screenshot({ path: `${shots}/cockpit-${tab}.png` });
    ok(`Receipt + Kitchen buttons on ${tab} rows`, rows > 0 && hasKitchen && hasReceipt, `rows=${rows} kitchen=${hasKitchen} receipt=${hasReceipt}`);
  }

  console.log("== 4. REGRESSION #2: Reports chart Today->Yesterday->Today + empty range ==");
  await page.goto(BASE + "/reports", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const bars = async () => await page.locator("svg .recharts-bar-rectangle").count();
  const t0 = await bars();
  ok("chart renders on Today (seeded data)", t0 > 0, `bars=${t0}`);
  await page.click('button:has-text("Yesterday")');
  await page.waitForTimeout(900);
  const t1 = await bars();
  await page.screenshot({ path: `${shots}/reports-yesterday.png` });
  await page.click('button:has-text("Today")');
  await page.waitForTimeout(900);
  const t2 = await bars();
  const netToday = await page.locator("text=Net Revenue").locator("..").innerText().then((t) => t.replace(/[^\d,]/g, "")).catch(() => "");
  await page.screenshot({ path: `${shots}/reports-back-to-today.png` });
  ok("chart still renders after Today->Yesterday->Today", t2 > 0, `today=${t0} yesterday=${t1} back=${t2}`);
  ok("yesterday had its own (also non-empty) chart", t1 > 0, `bars=${t1}`);
  // custom range far in the past = clean empty state
  await page.click('button:has-text("Custom")');
  await page.locator("input[type=date]").nth(0).fill("2015-01-01");
  await page.locator("input[type=date]").nth(1).fill("2015-01-07");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForTimeout(900);
  const emptyState = await page.locator("text=No paid orders in this range").count();
  ok("empty range shows clean empty-state", emptyState > 0);
  await page.click('button:has-text("Today")');
  await page.waitForTimeout(900);
  ok("Today recovers cleanly after empty range", (await bars()) > 0);

  console.log("== 5. Dine-in guests: no pre-emptive msg, real block, works with guests ==");
  await page.goto(BASE + "/pos/order/new?type=dine_in", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.click('button:has-text("Walk-in Guest")');
  await page.waitForTimeout(500);
  const before = await page.locator("text=Guests must be at least 1").count();
  ok("no message before any attempt", before === 0, `count=${before}`);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(400);
  const after = await page.locator("text=Guests must be at least 1").count();
  const stillOnGuestsStep = await page.locator("text=Guests").count() > 0 && await page.locator("input[placeholder*='Search items']").count() === 0;
  ok("message appears exactly once AFTER attempt", after === 1, `count=${after}`);
  ok("Continue did NOT advance past guests=0 (hard block)", stillOnGuestsStep);
  await page.locator("button:has-text('2')").first().click();
  await page.waitForTimeout(200);
  await page.click('button:has-text("Continue")');
  await page.waitForTimeout(700);
  const advanced = (await page.locator("input[placeholder*='Search items']").count()) > 0;
  ok("Continue advances once guests >= 1", advanced);
  await page.screenshot({ path: `${shots}/dinein-guests.png` });

  console.log("== 6. Change PIN: layout stable while typing ==");
  await page.goto(BASE + "/admin/settings", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const pinInput = page.locator("input[placeholder='••••']").first();
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
  ok("PIN typing does not change page height", s0.scrollHeight === s1.scrollHeight, `${s0.scrollHeight}->${s1.scrollHeight}`);
  ok("window does not scroll while typing", s0.scrollY === s1.scrollY, `${s0.scrollY}->${s1.scrollY}`);
  ok("PIN field position stable while typing", Math.abs((boxBefore?.y ?? 0) - (boxAfter?.y ?? 0)) < 2, `y=${boxBefore?.y}->${boxAfter?.y}`);
  const changed = s0.sections.filter((a, i) => a.h !== s1.sections[i]?.h).map((a) => a.cls);
  console.log("  LAYOUT_SNAPSHOT changed sections:", JSON.stringify(changed), "| all:", JSON.stringify(s0.sections));
  ok("no settings section changes height while typing", changed.length === 0);
  await page.screenshot({ path: `${shots}/settings-pin.png` });

  console.log("== 7. Cockpit -> Dashboard one-tap nav ==");
  await page.goto(BASE + "/pos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const dashBtn = page.locator("button[title='Dashboard']");
  ok("Dashboard nav button present on cockpit", (await dashBtn.count()) === 1);
  await dashBtn.click();
  await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 8000 }).catch(() => {});
  ok("click navigates to /dashboard", page.url().includes("/dashboard"));

  console.log("== 8. Branding: capital M + Manrope wordmark ==");
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  const fontLoaded = await page.evaluate(() => document.fonts.check('16px Manrope'));
  const logoFont = await page.locator("h1:has-text('Sevesto POS')").evaluate((el) => getComputedStyle(el).fontFamily).catch(() => "");
  const madeBy = await page.locator("text=Made by foresty").count();
  ok("Manrope loaded in browser", fontLoaded);
  ok("Login wordmark uses Manrope", logoFont.toLowerCase().includes("manrope"), logoFont);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const sidebarFont = await page.locator(".sidebar-brand, aside .font-brand").evaluate((el) => getComputedStyle(el[0] || el).fontFamily).catch(() => "");
  const asideMadeBy = await page.locator("aside", { hasText: "Made by foresty" }).count();
  ok("Sidebar shows 'Made by foresty'", asideMadeBy > 0);
  ok("Sidebar wordmark font-family includes Manrope or font-brand", (sidebarFont.toLowerCase().includes("manrope")) || sidebarFont.includes("var(--font-brand)"), sidebarFont);

  console.log("== 9. Staff: add -> deactivate -> activate -> delete ==");
  await page.goto(BASE + "/admin/staff", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const addName = "QA Tester " + Date.now().toString().slice(-5);
  await page.locator("input[placeholder='Full name']").fill(addName);
  await page.getByRole("button", { name: "Add" }).click();
  await page.waitForTimeout(700);
  ok("staff added", (await page.locator(`text=${addName}`).count()) > 0);

  // Look up this specific staff member's DB id right away so every later
  // step can target their exact row via data-testid, regardless of how
  // many other (e.g. leftover, from a previous crashed run) staff rows
  // are also on the page.
  const staffList1 = await apiAuth(page, "/api/staff?includeInactive=1");
  const qa1 = staffList1.body.find((s) => s.name === addName);
  const qaRow = () => page.locator(`[data-testid="staff-card-${qa1?._id}"]`);

  try {
    if (!qa1) throw new Error("could not find newly created staff via API");
    await qaRow().getByRole("button", { name: "Deactivate" }).click();
    await page.locator("h2", { hasText: "Deactivated" }).waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    await qaRow().getByRole("button", { name: "Activate" }).waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const inDeactivated = await page.locator("[data-testid='deactivated-section']").locator(`[data-testid="staff-card-${qa1._id}"]`).count();
    ok("deactivated staff moves to Deactivated section", inDeactivated > 0, `inDeactivated=${inDeactivated}`);
    await qaRow().getByRole("button", { name: "Activate" }).click();
    await qaRow().getByRole("button", { name: "Deactivate" }).waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    ok("staff reactivated back into active list", (await qaRow().count()) > 0);
  } finally {
    // Always clean up, even if an assertion above failed/threw, so a
    // broken run never leaves a dummy staff member behind for the next run.
    const staffList2 = await apiAuth(page, "/api/staff?includeInactive=1");
    const qa2 = staffList2.body.find((s) => s.name === addName);
    if (qa2) {
      const del = await apiAuth(page, `/api/staff/${qa2._id}`, { method: "DELETE" });
      ok("hard delete works", del.status === 200);
    } else {
      ok("hard delete works", false, "qa staff not found");
    }
  }

  console.log("== 10. Category auto-create on Add Item ==");
  const autoCat = "QA Auto Cat " + Date.now().toString().slice(-5);
  await page.goto(BASE + "/admin/products", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  await page.locator("input[placeholder*='Chicken Tikka']").fill("QA AutoCat Product");
  await page.locator("input[placeholder='0.00']").fill("250");
  await page.locator("input[placeholder='Or new…']").fill(autoCat);
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.waitForTimeout(1300);
  ok("product created with auto-created category", (await page.locator("text=QA AutoCat Product").count()) > 0);
  const all = await apiAuth(page, "/api/products?all=1");
  // Pick the NEWEST matching product — earlier runs of this same script
  // leave behind their own "QA AutoCat Product" if not cleaned up, so
  // matching by name alone can grab a stale one from days ago.
  const matches = all.body.filter((p) => p.name === "QA AutoCat Product");
  const prod = matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const catDetail = prod?.category && typeof prod.category === "object" ? prod.category.name : null;
  ok("category persisted on the product", catDetail === autoCat, catDetail || String(prod?.category));
  const selText = await page.locator(".card select").first().evaluate((el) => el.options[el.selectedIndex]?.text).catch(() => "");
  ok("category select now shows the auto-created category", selText === autoCat, selText);
  await page.screenshot({ path: `${shots}/products-autocat.png` });

  // Clean up this run's dummy product + category so they don't pile up
  // and confuse the "newest match" logic above on some future run.
  if (prod?._id) {
    const delProd = await apiAuth(page, `/api/products/${prod._id}`, { method: "DELETE" });
    ok("QA product cleanup", delProd.status === 200 || delProd.status === 204, `status=${delProd.status}`);
  }
  const cats = await apiAuth(page, "/api/categories");
  const qaCat = cats.body?.find((c) => c.name === autoCat);
  if (qaCat?._id) {
    await apiAuth(page, `/api/categories/${qaCat._id}`, { method: "DELETE" });
  }

  await browser.close();
  console.log(`\nROUND4_E2E_RESULT: ${passes} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error("E2E ERROR:", e); process.exit(2); });
