// Move the best/worst computation after itemMap is declared (TS2448 fix).
import fs from "fs";

const f = "src/lib/queries.ts";
let s = fs.readFileSync(f, "utf8");

const block = `
  // Best / worst sellers by quantity.
  const rankedItems = Array.from(itemMap.values()).filter((i) => i.qty > 0).sort((a, b) => b.qty - a.qty);
  const bestItems = rankedItems.slice(0, 5);
  const worstItems = rankedItems.slice(-5).reverse();`;

const got = (s.match(/const rankedItems = Array\.from\(itemMap\.values\(\)\)/g) || []).length;
if (got !== 1) { console.error("BLOCK_COUNT=" + got); process.exit(1); }
s = s.split(block).join("");
const topAnchor = "  const topItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 20);";
if (!s.includes(topAnchor)) { console.error("TOP_ANCHOR_MISSING"); process.exit(1); }
s = s.split(topAnchor).join(block + "\n" + topAnchor);
if (!s.includes("const bestItems")) { console.error("MOVE_FAILED"); process.exit(1); }
fs.writeFileSync(f, s);
console.log("QUERIES_FIXED");
