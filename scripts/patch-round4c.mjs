// Round-4 remaining patches (C, D/E, F, G, H) as a file script — no shell quoting hazards.
import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };
const repl = (path, anchor, next, label, times = 1) => {
  const s = fs.readFileSync(path, "utf8");
  const got = count(s, anchor);
  if (got !== times) throw new Error(`${label}: anchor count ${got} (expected ${times})`);
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};
const logged = (path, anchor, next, label) => {
  const s = fs.readFileSync(path, "utf8");
  const got = count(s, anchor);
  if (got !== 1) { console.log(`SKIP ${label} (anchor count ${got})`); return; }
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};

// C) SettingsManager — reserve banner height so toggling it never jumps the layout
repl("src/components/admin/SettingsManager.tsx", "      {message && (",
  "      <div className=\"min-h-[52px]\">\n      {message && (", "settings: banner reserve open");
repl("src/components/admin/SettingsManager.tsx", "          {message.text}\n        </div>\n      )}",
  "          {message.text}\n        </div>\n        )}\n      </div>", "settings: banner reserve close");

// D/E) Branding — "Made by foresty" + zap on the print footer
for (const f of ["src/app/page.tsx", "src/components/Layout/Sidebar.tsx", "src/components/admin/LoginForm.tsx", "src/lib/print.ts"]) {
  let s = fs.readFileSync(f, "utf8");
  s = s.split("made by foresty").join("Made by foresty");
  fs.writeFileSync(f, s);
}
repl("src/app/layout.tsx", "Sevesto POS made by foresty", "Sevesto POS Made by foresty", "layout metadata");
repl("src/lib/print.ts", 'printer.println("Made by foresty");', 'printer.println("Made by foresty ⚡");', "print footer zap");

// F) Staff — includeInactive, PATCH activate/deactivate/rename, hard DELETE
repl("src/app/api/staff/route.ts",
  `  const role = req.nextUrl.searchParams.get("role");
  const filter: Record<string, unknown> = { isActive: true };
  if (role) filter.role = role;`,
  `  const role = req.nextUrl.searchParams.get("role");
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
  if (role) filter.role = role;`, "staff GET includeInactive");
repl("src/app/api/staff/[id]/route.ts",
  `// Soft-delete (deactivate) so past orders that reference the staff member
// keep their populated name.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const staff = await Staff.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}`,
  `// Activate / deactivate / rename — orders that reference the member keep
// their populated name either way.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") update.isActive = body.isActive;
  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if (typeof body.phone === "string") update.phone = body.phone || undefined;
  if (body.role === "waiter" || body.role === "rider") update.role = body.role;
  const staff = await Staff.findByIdAndUpdate(id, { $set: update }, { new: true });
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json(staff);
}

// PERMANENT delete — only use when the member will never be needed again.
// Past orders referencing them will show a blank name in history views.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const { id } = await params;
  const staff = await Staff.findByIdAndDelete(id);
  if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}`, "staff [id] PATCH + hard DELETE");
repl("src/lib/queries.ts",
  `export async function getStaff(role?: "waiter" | "rider") {
  await connectDB();
  const filter: Record<string, unknown> = { isActive: true };
  if (role) filter.role = role;
  const staff = await Staff.find(filter).sort({ name: 1 }).lean();
  return sanitizeForClient(staff);
}`,
  `export async function getStaff(role?: "waiter" | "rider", includeInactive = false) {
  await connectDB();
  const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
  if (role) filter.role = role;
  const staff = await Staff.find(filter).sort({ name: 1 }).lean();
  return sanitizeForClient(staff);
}`, "queries getStaff includeInactive");
repl("src/app/admin/staff/page.tsx", "const staff = await getStaff();",
  "const staff = await getStaff(undefined, true);", "admin staff page all");

// G) ProductManager — auto-create a typed "Or new..." category on Add Item
repl("src/components/admin/ProductManager.tsx",
  `  async function addProduct() {
    if (!name.trim() || (!hasVariants && !price) || !categoryId) return;`,
  `  async function addProduct() {
    if (!name.trim() || (!hasVariants && !price)) return;
    let cid = categoryId;
    if (!cid && newCategoryName.trim()) {
      const catRes = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!catRes.ok) {
        const d = await catRes.json().catch(() => ({}));
        toast.error(d.error || "Could not create category");
        return;
      }
      const cat = await catRes.json();
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat._id);
      setNewCategoryName("");
      cid = cat._id;
    }
    if (!cid) return;`, "pm: auto-create category");
let pm = fs.readFileSync("src/components/admin/ProductManager.tsx", "utf8");
if (count(pm, "        category: categoryId,") === 1) {
  pm = pm.split("        category: categoryId,").join("        category: cid,");
  fs.writeFileSync("src/components/admin/ProductManager.tsx", pm);
}
repl("src/components/admin/ProductManager.tsx",
  "disabled={!name || (!hasVariants && !price) || !categoryId}",
  "disabled={!name || (!hasVariants && !price) || (!categoryId && !newCategoryName.trim())}",
  "pm: add button enabled with typed category");
pm = fs.readFileSync("src/components/admin/ProductManager.tsx", "utf8");
if (count(pm, "(!categoryId && !newCategoryName.trim())") < 1) throw new Error("pm: disabled anchor missing");
console.log("OK pm: auto-create wired");

// H) queries analytics — regex-based (tolerant: reports skipped clearly if missing)
const qPath = "src/lib/queries.ts";
let q = fs.readFileSync(qPath, "utf8");
const a1 = `  const refunds = await Refund.find({ createdAt: { $gte: start, $lte: end } }).lean();`;
const analytics = a1 + `

  // Previous-period comparison: the same-length window right before this one.
  const rangeMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - rangeMs + 1);
  const prevPeriodOrders = await Order.find({
    createdAt: { $gte: prevStart, $lte: prevEnd },
    isPaid: true,
    status: { $nin: ["cancelled"] },
  }).lean();
  const prevPeriodNet = prevPeriodOrders.reduce((s, o) => s + (o.paidAmount ?? 0), 0);

  // Hourly sales pattern — averaged per day so multi-day ranges read cleanly.
  const dayCount = Math.max(1, Math.round(rangeMs / (24 * 60 * 60 * 1000)));
  const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));
  for (const o of orders) {
    const h = new Date(o.createdAt as any).getHours();
    hourlyBuckets[h].revenue += o.paidAmount ?? 0;
    hourlyBuckets[h].orders += 1;
  }
  const hourlyPattern = hourlyBuckets.map((b) => ({
    hour: b.hour,
    revenue: Math.round((b.revenue / dayCount) * 100) / 100,
    orders: b.orders,
  }));

  // Best / worst sellers by quantity.
  const rankedItems = Array.from(itemMap.values()).filter((i) => i.qty > 0).sort((a, b) => b.qty - a.qty);
  const bestItems = rankedItems.slice(0, 5);
  const worstItems = rankedItems.slice(-5).reverse();`;
if (count(q, a1) === 1) {
  q = q.split(a1).join(analytics);
  console.log("OK queries analytics: prev/hourly/best-worst");
} else {
  console.log("SKIP queries analytics insert (refunds anchor count " + count(q, a1) + ")");
}
const a2 = `  return sanitizeForClient({
    range: { start: start.toISOString(), end: end.toISOString(), label: range },`;
if (count(q, a2) === 1) {
  q = q.split(a2).join(`  const aovSeries = Array.isArray(dailySeries)
    ? dailySeries.map((d) => ({ ...d, aov: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0 }))
    : [];
` + a2);
  console.log("OK queries analytics: aovSeries");
} else {
  console.log("SKIP queries analytics aovSeries (anchor count " + count(q, a2) + ")");
}
const a3 = "      refundCount: refunds.length, refundAmount: totalRefunded,";
if (count(q, a3) === 1) {
  q = q.split(a3).join(a3 + `
      prevPeriod: {
        netRevenue: prevPeriodNet,
        orders: prevPeriodOrders.length,
        revenueChangePct: prevPeriodNet > 0 ? Math.round((((grossRevenue - totalRefunded - prevPeriodNet) / prevPeriodNet) * 100) * 10) / 10 : null,
      },
      hourlyPattern,
      bestItems,
      worstItems,
      aovSeries,`);
  console.log("OK queries analytics: summary fields");
} else {
  console.log("SKIP queries analytics summary (anchor count " + count(q, a3) + ")");
}
fs.writeFileSync(qPath, q);

console.log("ROUND4C_DONE");
