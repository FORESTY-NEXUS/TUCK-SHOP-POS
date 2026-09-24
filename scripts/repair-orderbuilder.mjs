// Repair the dine-in guests step in OrderBuilder (it was left with unbalanced
// JSX by earlier string surgery). Rebuilds the table-input..Continue span from
// canonical code, then verifies the whole file compiles structurally.
import fs from "fs";

const f = "src/components/pos/OrderBuilder.tsx";
let s = fs.readFileSync(f, "utf8");

const start = 'placeholder="Table number (optional)"';
const re = new RegExp(escapeRe(start) + "[\\s\\S]*?\\n        \\);\\n      \\}");

function escapeRe(t) {
  return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

if (!re.test(s)) {
  console.error("REPAIR_ANCHOR_MISSING");
  process.exit(1);
}

const canonical = `${start}
            />

            {waiters.length > 0 && (
              <select
                value={waiterId}
                onChange={(e) => setWaiterId(e.target.value)}
                className="input w-48"
              >
                <option value="">Set Waiter (optional)</option>
                {waiters.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </select>
            )}

            <button
              onClick={() => {
                if (guests === "") { setGuestsTouched(true); return; }
                setIntakeDone(true);
              }}
              className="px-10 py-3 rounded-lg bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors"
            >
              Continue
            </button>
            {guestsTouched && guests === "" && (
              <p className="text-sm font-medium text-amber-700">Guests must be at least 1</p>
            )}
          </div>
        );
      }`;

s = s.replace(re, canonical);
fs.writeFileSync(f, s);

const msgCount = (s.match(/Guests must be at least 1/g) || []).length;
console.log("REPAIR_OK msg_count=" + msgCount);
if (msgCount !== 1) process.exit(1);
