import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };

// 1) OrderBuilder — waiter select in the dine-in guest step + guest validation hint
const obPath = "src/components/pos/OrderBuilder.tsx";
let ob = fs.readFileSync(obPath, "utf8");
const anchor = `placeholder="Table number (optional)"\n              className="input w-48 text-center"\n            />`;
if (!ob.includes(anchor)) { console.error("OB_ANCHOR_MISSING"); process.exit(1); }
const waiterBlock = anchor + `

            {waiters.length > 0 && (
              <select
                value={waiterId}
                onChange={(e) => setWaiterId(e.target.value)}
                className="input w-48"
              >
                <option value="">Set Waiter (optional)</option>
                {waiters.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            )}`;
ob = ob.split(anchor).join(waiterBlock);
const btn = "              Continue\n            </button>";
if (count(ob, btn) !== 1) { console.error("OB_BTN_COUNT", count(ob, btn)); process.exit(1); }
ob = ob.split(btn).join(btn + `
            {guests === "" && (
              <p className="text-sm font-medium text-amber-700">Guests must be at least 1</p>
            )}`);
fs.writeFileSync(obPath, ob);
console.log("OrderBuilder patched");

// 2) globals.css — the @layer wrap consumed the `.btn {` selector; restore it
const cssPath = "src/app/globals.css";
let css = fs.readFileSync(cssPath, "utf8");
const broken = "@layer components {\n  display: inline-flex;";
if (!css.includes(broken)) { console.error("CSS_ANCHOR_MISSING"); process.exit(1); }
css = css.split(broken).join("@layer components {\n.btn {\n  display: inline-flex;");
fs.writeFileSync(cssPath, css);
console.log("globals.css patched (.btn restored)");

// 3) print.ts — PrinterSettings needs the logo fields; printImage takes Buffer via cast
const ptPath = "src/lib/print.ts";
let pt = fs.readFileSync(ptPath, "utf8");
if (!pt.includes("receiptLogo?: string;")) {
  const iAnchor = "storePhone?: string;";
  if (!pt.includes(iAnchor)) { console.error("PRINT_IFACE_ANCHOR_MISSING"); process.exit(1); }
  pt = pt.split(iAnchor).join(iAnchor + "\n  receiptLogo?: string;\n  posDisplayLogo?: string;");
}
pt = pt.split("printer.printImage(logoPng);").join("(printer as any).printImage(logoPng);");
fs.writeFileSync(ptPath, pt);
console.log("print.ts patched");

// 4) SettingsManager — DatabaseBackup icon (missing export in some lucide versions) -> Database
const smPath = "src/components/admin/SettingsManager.tsx";
let sm = fs.readFileSync(smPath, "utf8");
sm = sm.split("DatabaseBackup").join("Database");
fs.writeFileSync(smPath, sm);
console.log("SettingsManager icon patched");

console.log("ALL_PATCHES_APPLIED");
