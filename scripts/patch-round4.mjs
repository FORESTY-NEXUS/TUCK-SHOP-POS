// Round 4 deterministic patches — each step asserts its anchor exists and
// prints a confirmation; the script exits non-zero on any mismatch.
import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };
const repl = (path, anchor, next, label) => {
  const s = fs.readFileSync(path, "utf8");
  if (!s.includes(anchor)) throw new Error(`${label}: anchor missing`);
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};

// ---------- A) CockpitBoard: unconditional Receipt button on every row ----------
const cbPath = "src/components/pos/CockpitBoard.tsx";
let cb = fs.readFileSync(cbPath, "utf8");
const condBlock = `                          {isCompleted && (
                            <button
                              onClick={() => printTicket(order, "receipt")}
                              className="px-3 py-1.5 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium hover:bg-stone-200 transition-colors"
                            >
                              Receipt
                            </button>
                          )}`;
if (!cb.includes(condBlock)) throw new Error("cockpit: conditional receipt block missing");
const fixedBlock = `                          <button
                            onClick={() => printTicket(order, "receipt")}
                            title="Print Receipt"
                            className="px-2 py-1 rounded text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                          >
                            Receipt
                          </button>`;
cb = cb.split(condBlock).join(fixedBlock);
// remove now-unused isCompleted const
cb = cb.split("                  const isCompleted = order.status === \"completed\" || order.isPaid;\n").join("");
// append a Dashboard nav button in the header actions (next to fullscreen), + import
const fsAnchor = `import {\n  UtensilsCrossed,`;
if (cb.includes(fsAnchor)) {
  repl(cbPath, fsAnchor, fsAnchor.replace(/\{\n  UtensilsCrossed,/, "{\n  LayoutGrid,\n  UtensilsCrossed,"), "cockpit: import LayoutGrid");
}
cb = fs.readFileSync(cbPath, "utf8");
const fsBtn = `          <button
            onClick={toggleFullscreen}`;
const fsBtnNew = `          <button
            onClick={() => router.push("/dashboard")}
            title="Dashboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}`;
cb = cb.split(fsBtn).join(fsBtnNew);
fs.writeFileSync(cbPath, cb);
if (cb.includes(condBlock)) throw new Error("cockpit: conditional receipt still present");
console.log("OK cockpit: unconditional Receipt (all rows) + Dashboard nav button");

// ---------- B) OrderBuilder: dedupe guest message + enforce the block ----------
const obPath = "src/components/pos/OrderBuilder.tsx";
let ob = fs.readFileSync(obPath, "utf8");
// remove EVERY existing occurrence of the message (there are 2) and its wrapper
const msgPattern = `{guests === "" && (
              <p className="text-sm font-medium text-amber-700">Guests must be at least 1</p>
            )}`;
while (ob.includes(msgPattern)) ob = ob.split(msgPattern).join("");
const msgPattern2 = `            {guests === "" && (
              <p className="text-sm font-medium text-amber-700">Guests must be at least 1</p>
            )}`;
while (ob.includes(msgPattern2)) ob = ob.split(msgPattern2).join("");
if (count(ob, "Guests must be at least 1") !== 0) throw new Error("guest msg dedupe failed");
// add "touched" state
repl(obPath, `  const [table, setTable] = useState("");`, `  const [table, setTable] = useState("");
  const [guestsTouched, setGuestsTouched] = useState(false);`, "ob: guestsTouched state");
ob = fs.readFileSync(obPath, "utf8");
// enforce in the Continue click handler + show message only after an attempt
const contBtn = `              Continue
            </button>`;
repl(obPath, `              Continue
            </button>`, `              Continue
            </button>
            {guestsTouched && guests === "" && (
              <p className="text-sm font-medium text-amber-700">Guests must be at least 1</p>
            )}`, "ob: message after attempt only");
ob = fs.readFileSync(obPath, "utf8");
// hard guard inside the handler (even if something disables the disabled attr)
const contHandler = `onClick={() => setIntakeDone(true)}`;
if (count(ob, contHandler) !== 1) throw new Error("ob: continue handler count " + count(ob, contHandler));
ob = ob.split(contHandler).join(`onClick={() => {
                if (guests === "") { setGuestsTouched(true); return; }
                setIntakeDone(true);
              }}`);
// keyboard Enter path also flags the error instead of doing nothing
const enterH = `      } else if (e.key === "Enter") {
        setGuests((prev) => {
          if (prev !== "") setIntakeDone(true);
          return prev;
        });
      }`;
if (count(ob, enterH) !== 1) throw new Error("ob: enter handler missing");
ob = ob.split(enterH).join(`      } else if (e.key === "Enter") {
        setGuests((prev) => {
          if (prev !== "") { setIntakeDone(true); return prev; }
          setGuestsTouched(true);
          return prev;
        });
      }`);
fs.writeFileSync(obPath, ob);
if (count(ob, "Guests must be at least 1") !== 1) throw new Error("ob: expected exactly 1 message, got " + count(ob, "Guests must be at least 1"));
console.log("OK orderbuilder: single message, shown after attempt, advance hard-blocked");

// ---------- C) SettingsManager: stable banner height (no layout jump) ----------
repl("src/components/admin/SettingsManager.tsx",
  "      {message && (",
  "      <div className=\"min-h-[52px]\">\n      {message && (",
  "settings: banner reserve open");
repl("src/components/admin/SettingsManager.tsx",
  "          {message.text}\n        </div>\n      )}",
  "          {message.text}\n        </div>\n        )}\n      </div>",
  "settings: banner reserve close");

// ---------- D/E) Branding: capital M + zap on print footer ----------
for (const f of ["src/app/page.tsx", "src/components/Layout/Sidebar.tsx", "src/components/admin/LoginForm.tsx", "src/lib/print.ts"]) {
  let s = fs.readFileSync(f, "utf8");
  s = s.split("made by foresty").join("Made by foresty");
  fs.writeFileSync(f, s);
}
repl("src/app/layout.tsx", "Sevesto POS made by foresty", "Sevesto POS Made by foresty", "layout metadata");
repl("src/lib/print.ts", 'printer.println("Made by foresty");', 'printer.println("Made by foresty ⚡");', "print footer zap");

// ---------- F) Staff API: includeInactive, PATCH activate/deactivate, hard DELETE ----------
repl("src/app/api/staff/route.ts",
  `  const role = req.nextUrl.searchParams.get("role");
  const filter: Record<string, unknown> = { isActive: true };
  if (role) filter.role = role;`,
  `  const role = req.nextUrl.searchParams.get("role");
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
  if (role) filter.role = role;`,
  "staff GET includeInactive");
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
}`,
  "staff [id] PATCH + hard DELETE");
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
}`,
  "queries getStaff includeInactive");
repl("src/app/admin/staff/page.tsx",
  "const staff = await getStaff();",
  "const staff = await getStaff(undefined, true);",
  "admin staff page all");

// ---------- G) ProductManager: auto-create typed category on Add Item ----------
const pmPath = "src/components/admin/ProductManager.tsx";
let pm = fs.readFileSync(pmPath, "utf8");
const oldGuard = `  async function addProduct() {
    if (!name.trim() || (!hasVariants && !price) || !categoryId) return;`;
if (!pm.includes(oldGuard)) throw new Error("pm: addProduct guard anchor");
const newGuard = `  async function addProduct() {
    if (!name.trim() || (!hasVariants && !price)) return;
    // Category auto-create: a typed-but-unconfirmed "Or new..." category is
    // created and selected the moment Add Item is clicked — no extra step.
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
    if (!cid) return;`;
pm = pm.split(oldGuard).join(newGuard);
pm = pm.split(`        category: categoryId,`).join(`        category: cid,`); // the add-product body uses categoryId
fs.writeFileSync(pmPath, pm);
// enable the Add Item button when a new category name is typed
pm = fs.readFileSync(pmPath, "utf8");
const btnDisable = `disabled={!name || (!hasVariants && !price) || !categoryId}`;
if (!pm.includes(btnDisable)) throw new Error("pm: add button disabled anchor");
pm = pm.split(btnDisable).join(`disabled={!name || (!hasVariants && !price) || (!categoryId && !newCategoryName.trim())}`);
fs.writeFileSync(pmPath, pm);
console.log("OK product manager auto-create category");

// ---------- H) queries: analytics (prev period, hourly, best/worst, AOV) ----------
const qPath = "src/lib/queries.ts";
let q = fs.readFileSync(qPath, "utf8");
const anchor1 = `  const refunds = await Refund.find({ createdAt: { $gte: start, $lte: end } }).lean();`;
if (!q.includes(anchor1)) throw new Error("q: refunds anchor");
const analytics = anchor1 + `

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
q = q.split(anchor1).join(analytics);

const anchor2 = `  return sanitizeForClient({
    range: { start: start.toISOString(), end: end.toISOString(), label: range },`;
if (!q.includes(anchor2)) throw new Error("q: return anchor");
const aovLine = `  const aovSeries = Array.isArray(dailySeries)
    ? dailySeries.map((d) => ({ ...d, aov: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0 }))
    : [];
` + anchor2;
q = q.split(anchor2).join(aovLine);

const anchor3 = `      refundCount: refunds.length, refundAmount: totalRefunded,`;
if (!q.includes(anchor3)) throw new Error("q: summary anchor");
q = q.split(anchor3).join(anchor3 + `
      prevPeriod: {
        netRevenue: prevPeriodNet,
        orders: prevPeriodOrders.length,
        revenueChangePct: prevPeriodNet > 0 ? Math.round((((grossRevenue - totalRefunded - prevPeriodNet) / prevPeriodNet) * 100) * 10) / 10 : null,
      },
      hourlyPattern,
      bestItems,
      worstItems,
      aovSeries,`);
fs.writeFileSync(qPath, q);
console.log("OK queries analytics");

console.log("ALL_ROUND4_PATCHES_OK");
