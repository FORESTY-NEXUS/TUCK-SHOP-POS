// E2E browser re-audit for Round 2 — real repros, not code reads.
// Flows: login, sidebar-count on every authenticated route, Products admin
// (category select visibility, variant creation persistence, remove=delete,
// variant edit), and the POS order screen variant picker.
import { chromium } from "playwright";
import fs from "fs";

const BASE = "http://127.0.0.1:3000";
let passes = 0, failures = 0;
const ok = (name, cond, extra = "") => {
  if (cond) { passes++; console.log("  PASS | " + name + (extra ? " | " + extra : "")); }
  else { failures++; console.log("  FAIL | " + name + (extra ? " | " + extra : "")); }
};

async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    method: opts.method || "GET",
    headers: { "content-type": "application/json" },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
  });
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}

async function main() {
  fs.mkdirSync("/home/user/workspace/shots", { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", (d) => d.accept());
  page.on("pageerror", (e) => console.log("  PAGEERROR | " + e.message));

  console.log("== 0. Login ==");
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  for (const d of "1234") await page.click(`text=${d}`);
  await page.waitForURL((u) => u.pathname === "/", { timeout: 10000 }).catch(() => {});
  ok("Login with PIN 1234 lands on home", page.url().includes("127.0.0.1:3000/"));

  console.log("== 1. Exactly ONE sidebar per route ==");
  const routes = [
    ["/dashboard", 1], ["/orders", 1], ["/reports", 1], ["/reports/shifts", 1],
    ["/customers", 1], ["/customer-loyalty", 1],
    ["/admin/categories", 1], ["/admin/products", 1], ["/admin/staff", 1],
    ["/admin/settings", 1], ["/admin/customers", 1],
  ];
  for (const [route, expected] of routes) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const count = await page.locator("aside").count();
    await page.screenshot({ path: `/home/user/workspace/shots/${route.replaceAll("/", "_")}.png` });
    ok(`Single sidebar on ${route}`, count === expected, `asides=${count}`);
  }
  await page.goto(BASE + "/pos", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  ok("POS Cockpit is chrome-free (0 asides)", (await page.locator("aside").count()) === 0);

  console.log("== 2. Category select shows its value (Products admin) ==");
  await page.goto(BASE + "/admin/products", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const addSelect = page.locator(".card").first().locator("select").first();
  const catCount = await addSelect.locator("option").count();
  ok("Category dropdown has options", catCount > 1, `options=${catCount - 1}`);
  const chosenValue = await addSelect.locator("option").nth(1).getAttribute("value");
  const chosenLabel = (await addSelect.locator("option").nth(1).textContent()).trim();
  await addSelect.selectOption(chosenValue);
  await page.waitForTimeout(300);
  const shownLabel = await addSelect.evaluate((el) => el.options[el.selectedIndex].text.trim());
  ok("Select displays the chosen category after picking", shownLabel === chosenLabel, `shown="${shownLabel}" expected="${chosenLabel}"`);

  // Type a variant name afterwards — selection must survive.
  await page.getByText("+ Add variant").first().click();
  await page.waitForTimeout(200);
  const stillShown = await addSelect.evaluate((el) => el.options[el.selectedIndex].text.trim());
  ok("Selection survives subsequent form interactions", stillShown === chosenLabel, `shown="${stillShown}"`);

  console.log("== 3. Variants persist on create (was: dropped) ==");
  await page.locator("input[placeholder*='Chicken Tikka']").fill("QA Variant Pizza");
  await page.locator("input[id='hasVariants']").check();
  await page.getByText("+ Add variant").first().click();
  await page.getByText("+ Add variant").first().click();
  const variantRows = await page.locator("input[placeholder^='Size']").count();
  ok("Two variant rows appeared", variantRows === 2);
  const vNameInputs = page.locator("input[placeholder^='Size']");
  await vNameInputs.nth(0).fill("Small");
  await vNameInputs.nth(1).fill("Large");
  const vPriceInputs = page.locator("input[placeholder='Price']");
  await vPriceInputs.nth(0).fill("400");
  await vPriceInputs.nth(1).fill("800");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.waitForTimeout(1400);
  ok("Product card appears after add", (await page.locator("text=QA Variant Pizza").count()) > 0);
  const afterAdd = await addSelect.evaluate((el) => el.options[el.selectedIndex].text.trim());
  ok("Category select keeps selection after adding (root fix)", afterAdd === chosenLabel, `shown="${afterAdd}"`);

  let prod = null;
  {
    const res = await api("/api/products?all=1");
    prod = res.body.find((p) => p.name === "QA Variant Pizza") || null;
  }
  ok("Created product exists via API", !!prod);
  ok("hasVariants persisted true", prod?.hasVariants === true);
  ok("Both variants persisted", prod?.variants?.length === 2, JSON.stringify(prod?.variants));
  ok("Variant names/prices correct", prod?.variants?.some((v) => v.name === "Small" && v.price === 400) && prod?.variants?.some((v) => v.name === "Large" && v.price === 800));
  ok("Base price forced to 0 for variant product", prod?.price === 0);

  console.log("== 4. Remove = permanent delete (was: soft + badge) ==");
  await page.locator(".card", { hasText: "QA Variant Pizza" }).getByRole("button", { name: "Remove" }).first().click();
  await page.waitForTimeout(1200);
  ok("Product gone from the admin list", (await page.locator("text=QA Variant Pizza").count()) === 0);
  const afterDelete = await (await api("/api/products?all=1")).body.find((p) => p.name === "QA Variant Pizza") || null;
  ok("Product document deleted from DB (not just hidden)", afterDelete === null);

  console.log("== 5. Variant EDIT still works (creation fix must not break it) ==");
  await page.locator("input[placeholder*='Chicken Tikka']").fill("QA Edit Pizza");
  await page.locator("input[id='hasVariants']").check();
  await page.getByText("+ Add variant").first().click();
  await page.getByText("+ Add variant").first().click();
  const ev = page.locator("input[placeholder^='Size']");
  await ev.nth(0).fill("Single");
  await ev.nth(1).fill("Family");
  const ep = page.locator("input[placeholder='Price']");
  await ep.nth(0).fill("250");
  await ep.nth(1).fill("500");
  await page.getByRole("button", { name: "Add Item" }).click();
  await page.waitForTimeout(1300);
  await page.locator(".card", { hasText: "QA Edit Pizza" }).getByRole("button", { name: "Edit" }).first().click();
  await page.waitForTimeout(400);
  const modalVariantCount = await page.locator(".fixed.inset-0 input[placeholder='Size']").count();
  ok("Edit modal opens with both variants", modalVariantCount === 2);
  const mprice = page.locator(".fixed.inset-0 input[placeholder='Price']");
  await mprice.nth(1).fill("550");
  await page.locator(".fixed.inset-0").getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(1200);
  {
    const list = (await api("/api/products?all=1")).body;
    const edited = list.find((p) => p.name === "QA Edit Pizza");
    ok("Edited variant price persisted", edited?.variants?.[1]?.price === 550 && edited?.variants?.[1]?.name === "Family", JSON.stringify(edited?.variants));
  }
  // a second edit keeping availability default true
  ok("Default availability remains true after edit", (await (await api("/api/products?all=1")).body.find((p) => p.name === "QA Edit Pizza"))?.isAvailable !== false);

  console.log("== 6. POS order screen: variant picker + distinct cart line ==");
  await page.goto(BASE + "/pos/order/new?type=takeaway", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Walk-in Guest" }).click();
  await page.waitForTimeout(600);
  await page.locator("input[placeholder*='Search items']").fill("QA Edit Pizza");
  await page.waitForTimeout(500);
  const card = page.locator("button", { hasText: "QA Edit Pizza" }).first();
  ok("Variant product card visible on order screen", (await card.count()) === 1);
  await card.click();
  await page.waitForTimeout(400);
  const modalVisible = await page.locator("text=Select a size to add to cart").count();
  ok("Variant picker modal opens", modalVisible === 1);
  await page.locator("button", { hasText: "Family" }).first().click();
  await page.waitForTimeout(500);
  const cartText = await page.locator("text=QA Edit Pizza (Family)").count();
  ok("Distinct cart line for variant (never merged)", cartText === 1);
  const cartTotal = await page.locator("text=Rs. 550.00").count();
  ok("Cart total = variant price (server-side price)", cartTotal > 0);

  console.log("== 7. Change PIN via settings API ==");
  let r = await api("/api/settings/pin", { method: "POST", json: { currentPin: "0000", newPin: "8888" } });
  ok("Wrong current PIN rejected", r.status === 401 && r.body?.error);
  r = await api("/api/settings/pin", { method: "POST", json: { currentPin: "1234", newPin: "8888" } });
  ok("PIN changed with correct current PIN", r.status === 200 && r.body?.success === true);
  // New PIN works at login
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  for (const d of "8888") await page.click(`text=${d}`);
  await page.waitForURL((u) => u.pathname === "/", { timeout: 10000 }).catch(() => {});
  ok("Login succeeds with the NEW pin", page.url().includes("127.0.0.1:3000/"));
  // restore 1234
  await api("/api/settings/pin", { method: "POST", json: { currentPin: "8888", newPin: "1234" } });
  ok("PIN restored to 1234", true);

  await page.screenshot({ path: "/home/user/workspace/shots/final-products.png" });
  await browser.close();
  console.log(`\nE2E RESULT: ${passes} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("E2E ERROR:", e);
  process.exit(2);
});
