const BASE = "http://127.0.0.1:3000";
let cookie = "";
let passes = 0, failures = 0;
function ok(name, cond, extra = "") {
  if (cond) { passes++; console.log("  PASS | " + name + (extra ? " | " + extra : "")); }
  else { failures++; console.log("  FAIL | " + name + (extra ? " | " + extra : "")); }
}
async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.cookie = cookie;
  if (opts.json !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(BASE + path, { method: opts.method || "GET", headers, body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined, redirect: "manual" });
  const setc = res.headers.get("set-cookie");
  if (setc) cookie = setc.split(";")[0];
  let body = null;
  try { body = await res.json(); } catch {}
  return { status: res.status, body };
}
async function main() {
  console.log("== 1. Auth & middleware ==");
  let r = await req("/api/orders");
  ok("API returns 401 without session", r.status === 401);
  r = await req("/");
  ok("Unauthenticated page redirects to /login", r.status === 307 || r.status === 302);
  r = await req("/api/auth/login", { method: "POST", json: { pin: "9999" } });
  ok("Wrong PIN rejected (401)", r.status === 401);
  r = await req("/api/auth/login", { method: "POST", json: { pin: "1234" } });
  ok("Admin login with PIN 1234", r.status === 200 && cookie.includes("sevesto_session"));
  r = await req("/api/auth/session");
  ok("Session returns admin user", r.body?.user?.role === "admin");

  console.log("== 2. Shift lifecycle ==");
  // pre-round5: close leftover open shifts so a stale one from a previous
  // run doesn't turn "Open shift" into a 409 (real POST works; the assertion
  // was breaking on a dirty DB).
  {
    const openList = await req("/api/shifts?current=1");
    for (const s of (openList.body?.shifts || [])) {
      await req(`/api/shifts/${s._id}/close`, { method: "POST", json: { actualCash: s.openingBalance || 0 } });
    }
  }
  r = await req("/api/shifts", { method: "POST", json: { openingBalance: 5000 } });
  ok("Open shift with Rs.5000 float", r.status === 201 && r.body?.isOpen === true);
  const shiftId = r.body?._id;
  r = await req("/api/shifts", { method: "POST", json: { openingBalance: 0 } });
  ok("Second open shift rejected (409)", r.status === 409);
  r = await req("/api/shifts?current=1");
  ok("Open-shift lookup works", r.status === 200 && r.body?.shifts?.length === 1);

  console.log("== 3. Menu ==");
  r = await req("/api/products");
  ok("Products list non-empty", Array.isArray(r.body) && r.body.length > 0);
  const P = r.body[0];
  const catId = typeof P.category === "object" ? P.category._id : P.category;

  console.log("== 4. Server-side customer enforcement ==");
  r = await req("/api/orders", { method: "POST", json: { type: "dine_in", items: [{ productId: P._id, qty: 1 }], guests: 2, table: "T1" } });
  ok("Dine-in WITHOUT customer rejected (400)", r.status === 400 && JSON.stringify(r.body).includes("customerId"));
  r = await req("/api/orders", { method: "POST", json: { type: "delivery", items: [{ productId: P._id, qty: 1 }] } });
  ok("Delivery WITHOUT customer rejected (400)", r.status === 400);
  r = await req("/api/orders", { method: "POST", json: { type: "takeaway", items: [{ productId: P._id, qty: 1 }] } });
  ok("Takeaway WITHOUT customer rejected (400)", r.status === 400);

  console.log("== 5. Customers (auto-create, Guest dedup) ==");
  r = await req("/api/customers", { method: "POST", json: { phone: "0000000000" } });
  const guest = r.body;
  ok("Guest record created via POST", r.status === 201 && !!guest?._id);
  r = await req("/api/customers", { method: "POST", json: { phone: "0000000000" } });
  ok("Guest record deduplicated (same _id)", r.body?._id === guest?._id);
  r = await req("/api/customers", { method: "POST", json: { phone: "03001234567", name: "Test Person" } });
  const cust = r.body;
  ok("Real customer auto-created from phone", r.status === 201 && !!cust?._id);

  console.log("== 6. Orders & money flow ==");
  const Pa = P.price;
  r = await req("/api/orders", { method: "POST", json: { type: "dine_in", customerId: guest._id, guests: 2, table: "T1", items: [{ productId: P._id, qty: 1 }] } });
  const order1 = r.body;
  ok("Dine-in guest order placed (201)", r.status === 201 && !!order1?.orderNumber, order1?.orderNumber);
  ok("Kitchen print failure is graceful (order still saved)", r.body?.printResult && r.body.printResult.success === false);
  ok("Server-computed total correct", Math.abs(order1.total - Pa) < 0.01, `item=${Pa} total=${order1.total}`);
  const order1Id = order1._id;
  ok("ObjectId serialized as plain string", typeof order1Id === "string" && /^[0-9a-f]{24}$/.test(order1Id));
  r = await req(`/api/orders/${order1Id}`, { method: "PATCH", json: { pay: { method: "cash", amount: order1.total } } });
  ok("Guest order paid in cash", r.status === 200 && r.body?.isPaid === true);
  r = await req("/api/customers?query=0000000000");
  ok("Guest earned NO loyalty points", r.body?.[0]?.loyaltyPoints === 0, `pts=${r.body?.[0]?.loyaltyPoints}`);

  r = await req("/api/orders", { method: "POST", json: { type: "takeaway", customerId: cust._id, items: [{ productId: P._id, qty: 2 }] } });
  const order2 = r.body;
  const T2 = order2.total;
  ok("Takeaway order total = 2x price", Math.abs(T2 - 2 * Pa) < 0.01, `T2=${T2}`);
  r = await req(`/api/orders/${order2._id}`, { method: "PATCH", json: { pay: { method: "easypaisa", amount: T2 } } });
  ok("Takeaway paid via EasyPaisa (non-cash)", r.status === 200 && r.body?.isPaid === true);
  r = await req("/api/customers?query=03001234567");
  const pts2 = Math.floor(T2 / 100);
  ok("Loyalty awarded on non-cash payment", r.body?.[0]?.loyaltyPoints === pts2, `pts=${r.body?.[0]?.loyaltyPoints} exp=${pts2}`);

  r = await req("/api/orders", { method: "POST", json: { type: "delivery", customerId: cust._id, deliveryAddress: "Flat 7, Block B", deliveryCharges: 150, items: [{ productId: P._id, qty: 1 }] } });
  const order3 = r.body;
  ok("Delivery order with Rs.150 charges", r.status === 201 && order3.deliveryCharges === 150);
  r = await req(`/api/orders/${order3._id}`, { method: "PATCH", json: { pay: { method: "cash", amount: order3.total } } });
  ok("Delivery paid in cash", r.status === 200 && r.body?.isPaid === true);
  r = await req("/api/customers?query=03001234567");
  ok("Delivery address saved to customer (auto-fill source)", r.body?.[0]?.lastAddress === "Flat 7, Block B", r.body?.[0]?.lastAddress);
  const ptsAfterDel = r.body?.[0]?.loyaltyPoints;
  r = await req(`/api/orders/${order3._id}`, { method: "PATCH", json: { refund: { isFullRefund: true, reason: "Test refund" } } });
  if (!(r.status === 200 && r.body?.order?.refundedAmount === order3.total)) {
    console.log("  REFUND_DIAG status=" + r.status + " body=" + JSON.stringify(r.body));
  }
  ok("Full cash refund processed", r.status === 200 && r.body?.order?.refundedAmount === order3.total);
  r = await req("/api/customers?query=03001234567");
  ok("Refund reversed loyalty proportionally", r.body?.[0]?.loyaltyPoints === pts2, `pts=${r.body?.[0]?.loyaltyPoints} exp=${pts2} (afterDel=${ptsAfterDel})`);
  r = await req(`/api/orders/${order3._id}`, { method: "PATCH", json: { refund: { isFullRefund: true, reason: "again" } } });
  ok("Double full-refund rejected (409)", r.status === 409);

  console.log("== 7. Variants (server-side pricing) ==");
  r = await req("/api/products", { method: "POST", json: { name: "Test Pizza", price: 0, category: catId, hasVariants: true, variants: [{ name: "Small", price: 400 }, { name: "Large", price: 800 }] } });
  const vp = r.body;
  ok("Variant product created", r.status === 201 && vp.hasVariants && vp.variants?.length === 2);
  r = await req("/api/products?all=1");
  const back = (r.body || []).find((p) => p._id === vp._id);
  ok("Variants persisted to DB", back?.variants?.length === 2 && back.variants[0].name === "Small");
  r = await req("/api/orders", { method: "POST", json: { type: "takeaway", customerId: guest._id, items: [{ productId: vp._id, qty: 1, variantIndex: 1 }] } });
  ok("Order placed with variant index 1", r.status === 201 && r.body?.items?.[0]?.name.includes("(Large)"), r.body?.items?.[0]?.name);
  ok("Variant price resolved server-side (Rs.800)", Math.abs(r.body?.total - 800) < 0.01, `total=${r.body?.total}`);
  r = await req("/api/orders", { method: "POST", json: { type: "takeaway", customerId: guest._id, items: [{ productId: vp._id, qty: 1, variantIndex: 9 }] } });
  ok("Invalid variant index rejected (400)", r.status === 400);

  console.log("== 8. Shift close — cash reconciliation ==");
  const cashPaid = order1.total + order3.total;
  const cashRefunded = order3.total;
  const expected = 5000 + cashPaid - cashRefunded;
  r = await req(`/api/shifts/${shiftId}/close`, { method: "POST", json: { actualCash: expected } });
  ok("Shift closed", r.status === 200 && r.body?.shift?.isOpen === false);
  ok("expectedCash = float + cash - cash refunds", Math.abs(r.body?.summary?.expectedCash - expected) < 0.01, `server=${r.body?.summary?.expectedCash} calc=${expected}`);
  ok("Non-cash payment excluded from drawer math", Math.abs(r.body?.summary?.cashCollected - (order1.total + order3.total)) < 0.01);
  ok("Difference 0 when drawers match", r.body?.summary?.difference === 0);

  console.log("== 9. Reports & history ==");
  r = await req("/api/reports/sales?range=today");
  const gross = order1.total + T2 + order3.total;
  const refunds = order3.total;
  ok("Today report net revenue correct", Math.abs(r.body?.summary?.netRevenue - (gross - refunds)) < 0.01, `net=${r.body?.summary?.netRevenue} calc=${gross - refunds}`);
  ok("Report includes daily series", Array.isArray(r.body?.summary?.dailySeries) && r.body.summary.dailySeries.length >= 1);
  r = await req("/api/orders/history?range=all&page=1");
  ok("Order history lists all orders", (r.body?.orders || []).length >= 4, `count=${r.body?.orders?.length}`);
  const serializedOk = (r.body?.orders || []).every((o) => typeof o._id === "string");
  ok("No ObjectId leaks in history payload", serializedOk);

  console.log("== 10. Print endpoint resilience ==");
  r = await req(`/api/orders/${order2._id}/print`, { method: "POST", json: { type: "receipt" } });
  ok("Print failure returns JSON error (no crash)", r.status === 500 && r.body?.success === false);
  r = await req(`/api/orders/${order2._id}`);
  ok("Order unaffected by print failure", r.status === 200 && r.body?.orderNumber);

  console.log(`\nRESULT: ${passes} passed, ${failures} failed`);
  process.exit(failures === 0 ? 0 : 1);
}
main().catch((e) => { console.error("SUITE ERROR", e); process.exit(2); });
