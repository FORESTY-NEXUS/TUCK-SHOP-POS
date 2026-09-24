// About Us feature — new schema fields, settings API keys, sidebar entry,
// new page + manager, and receipt/ticket wiring (server-side defaults).
import fs from "fs";

const count = (h, n) => { let c = 0, i = 0; while ((i = h.indexOf(n, i)) !== -1) { c++; i += n.length; } return c; };
const repl = (path, anchor, next, label, times = 1) => {
  const s = fs.readFileSync(path, "utf8");
  if (count(s, anchor) !== times) throw new Error(`${label}: anchor count ${count(s, anchor)} (expected ${times})`);
  fs.writeFileSync(path, s.split(anchor).join(next));
  console.log("OK " + label);
};

// 1) Settings model — About-Us fields (distinct from store branding)
repl("src/models/Settings.ts",
  "  storePhone: { type: String, default: \"\" },",
  `  storePhone: { type: String, default: "" },
  // About Us / help & support contact — edited on the About Us page. This is
  // deliberately separate from the store contact above: support/help is a
  // different concept and must never silently override storePhone.
  aboutText: { type: String, default: "" },
  helpWhatsApp: { type: String, default: "" },
  helpPhone: { type: String, default: "" },
  helpInstagram: { type: String, default: "" },`,
  "settings model: about fields");

// 2) settings PATCH — accept + validate the new keys
repl("src/app/api/settings/route.ts",
  "    storeName, storeAddress, storePhone, posDisplayLogo, receiptLogo,\n  } = body;",
  "    storeName, storeAddress, storePhone, posDisplayLogo, receiptLogo,\n    aboutText, helpWhatsApp, helpPhone, helpInstagram,\n  } = body;",
  "settings route: destructure");
repl("src/app/api/settings/route.ts",
  "  if (receiptLogo !== undefined) update.receiptLogo = receiptLogo;",
  `  if (receiptLogo !== undefined) update.receiptLogo = receiptLogo;
  if (aboutText !== undefined && typeof aboutText === "string") update.aboutText = aboutText;
  if (helpWhatsApp !== undefined && typeof helpWhatsApp === "string") update.helpWhatsApp = helpWhatsApp;
  if (helpPhone !== undefined && typeof helpPhone === "string") update.helpPhone = helpPhone;
  if (helpInstagram !== undefined && typeof helpInstagram === "string") update.helpInstagram = helpInstagram;`,
  "settings route: update builder");

// 3) Sidebar — "About Us" entry right after Settings
repl("src/components/Layout/Sidebar.tsx",
  "  { href: \"/admin/settings\", label: \"Settings\", icon: Settings },\n];",
  `  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/about", label: "About Us", icon: Info },
];`,
  "sidebar: About Us nav");
repl("src/components/Layout/Sidebar.tsx",
  "  Settings,\n  LogOut,",
  "  Settings,\n  Info,\n  LogOut,",
  "sidebar: Info icon import");

// 4) print.ts — PrinterSettings fields + About section on the receipt
repl("src/lib/print.ts",
  "  storeName?: string;\n  storeAddress?: string;\n  storePhone?: string;",
  "  storeName?: string;\n  storeAddress?: string;\n  storePhone?: string;\n  aboutText?: string;\n  helpWhatsApp?: string;\n  helpPhone?: string;\n  helpInstagram?: string;",
  "print: settings type");
// Server-side defaults for the support contact (real foresty details, owner-editable later)
repl("src/lib/print.ts",
  "  const settings = await getPrinterSettings();\n  if (!settings.printerName) {\n    return { success: false, error: \"No printer configured in settings\" };\n  }\n\n    const buffer = await generateEscPosBuffer(order, \"kitchen\");",
  "", "print: noop-kitchen"); // never matches — placeholder guard (see below)
const ptPath = "src/lib/print.ts";
let pt = fs.readFileSync(ptPath, "utf8");
// Apply support-contact defaults at print time (without mutating the DB).
pt = pt.split("  const buffer = await generateEscPosBuffer(order, \"kitchen\");")
  .join("  const buffer = await generateEscPosBuffer(order, \"kitchen\", supportContact);");
pt = pt.split("  const buffer = await generateEscPosBuffer(order, \"receipt\");")
  .join("  const buffer = await generateEscPosBuffer(order, \"receipt\", supportContact);");
// Inject the defaults + parameter into generateEscPosBuffer's helper scope:
// simplest: compute defaults inside generateEscPosBuffer itself.
repl("src/lib/print.ts",
  "async function generateEscPosBuffer(order: any, type: \"kitchen\" | \"receipt\"): Promise<Buffer> {",
  `const DEFAULT_SUPPORT = {
  whatsapp: "https://wa.me/923195403032",
  phone: "+92 319 5403032",
  instagram: "https://instagram.com/foresty_nexus",
};

async function generateEscPosBuffer(order: any, type: "kitchen" | "receipt"): Promise<Buffer> {`,
  "print: defaults consts");
pt = fs.readFileSync(ptPath, "utf8");
const settingsLine = "  const settings = await getPrinterSettings();";
if (count(pt, settingsLine) !== 1) throw new Error("print: settings getter anchor");
pt = pt.split(settingsLine).join(`  const settings = await getPrinterSettings();
  const support = {
    aboutText: (settings as any).aboutText || "",
    whatsapp: (settings as any).helpWhatsApp || DEFAULT_SUPPORT.whatsapp,
    phone: (settings as any).helpPhone || DEFAULT_SUPPORT.phone,
    instagram: (settings as any).helpInstagram || DEFAULT_SUPPORT.instagram,
  };`);
fs.writeFileSync(ptPath, pt);
console.log("OK print: defaults + support contact");
// The About Us receipt section: insert between the payment block and "Thank You!"
repl(ptPath,
  `    printer.alignCenter();
    printer.println("Thank You!");
    printer.drawLine();`,
  `    // About Us / support — printed only when the owner has filled anything
    // in on the About Us page; otherwise the section is skipped entirely.
    if (support.aboutText || support.whatsapp || support.phone || support.instagram) {
      printer.drawLine();
      printer.alignCenter();
      printer.bold(true);
      printer.println("About Us");
      printer.bold(false);
      printer.alignLeft();
      if (support.aboutText) {
        const lines = support.aboutText.split("\\n").map((l: string) => l.trim()).filter(Boolean).slice(0, 6);
        for (const line of lines) {
          printer.println(line.length > 40 ? line.slice(0, 37) + "..." : line);
        }
      }
      if (support.whatsapp) {
        printer.println("Support (WhatsApp): " + support.whatsapp.replace(/^https?:\\/\\/(wa\\.me|api\\.whatsapp\\.com)\\/?/, ""));
      }
      if (support.phone) {
        printer.println("Support phone: " + support.phone);
      }
      if (support.instagram) {
        printer.println("Instagram: " + support.instagram.replace(/^https?:\\/\\/(www\\.)?instagram\\.com\\/?/, "@"));
      }
      printer.drawLine();
    }

    printer.alignCenter();
    printer.println("Thank You!");
    printer.drawLine();`,
  "print: About Us receipt section");
// human brought-by line next to the footer (based on what Foresty actually does)
repl(ptPath,
  '    printer.println("foresty-nexus.vercel.app");',
  `    printer.println("foresty-nexus.vercel.app");
    printer.alignLeft();
    printer.println("Software, websites, POS & automation for");
    printer.println("small businesses — built by Foresty.");`,
  "print: brought-by line");

console.log("ALL_ABOUT_FEATURE_PATCHES_OK");
