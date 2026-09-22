// Round 4 deterministic patches (fixed ordering: write to disk BEFORE any
// helper that re-reads the file). Each step asserts its anchor; exits non-zero on mismatch.
import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };
const repl = (path, anchor, next, label) => {
  const s = fs.readFileSync(path, "utf8");
  if (!s.includes(anchor)) throw new Error(`${label}: anchor missing`);
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};

// ---------- A) CockpitBoard: unconditional Receipt, Dashboard nav, import ----------
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
cb = cb.split(`                  const isCompleted = order.status === "completed" || order.isPaid;\n`).join("");
// add LayoutGrid to the lucide import
const imp = `import {
  UtensilsCrossed,`;
if (!cb.includes(imp)) throw new Error("cockpit: import anchor missing");
cb = cb.split(imp).join(`import {
  LayoutGrid,
  UtensilsCrossed,`);
// Dashboard nav button next to fullscreen
const fsBtn = `          <button
            onClick={toggleFullscreen}`;
if (count(cb, fsBtn) !== 1) throw new Error("cockpit: fullscreen anchor count " + count(cb, fsBtn));
cb = cb.split(fsBtn).join(`          <button
            onClick={() => router.push("/dashboard")}
            title="Dashboard"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-stone-100 text-stone-600 text-sm font-medium hover:bg-stone-200 transition-colors"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>

          <button
            onClick={toggleFullscreen}`);
fs.writeFileSync(cbPath, cb);
if (cb.includes(condBlock)) throw new Error("cockpit: conditional receipt STILL present after write");
console.log("OK cockpit: unconditional Receipt (all rows) + Dashboard nav + import");
