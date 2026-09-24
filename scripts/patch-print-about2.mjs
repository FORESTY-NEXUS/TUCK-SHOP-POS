// print.ts — About-Us receipt section + support defaults + brought-by line.
// Uses a whitespace-flexible regex for the settings getter (indentation varies).
import fs from "fs";

const f = "src/lib/print.ts";
let s = fs.readFileSync(f, "utf8");

const getterRe = /\n(\s*)const settings = await getPrinterSettings\(\);/g;
const getterCount = (s.match(getterRe) || []).length;
console.log("settings getters:", getterCount);
if (getterCount < 2) { console.error("GETTER_ANCHOR_BAD count=" + getterCount); process.exit(1); }

const supportBlock = (ind) => `
${ind}const support = {
${ind}  aboutText: (settings as any).aboutText || "",
${ind}  whatsapp: (settings as any).helpWhatsApp || "https://wa.me/923195403032",
${ind}  phone: (settings as any).helpPhone || "+92 319 5403032",
${ind}  instagram: (settings as any).helpInstagram || "https://instagram.com/foresty_nexus",
${ind}};`;

s = s.replace(getterRe, (m, ind) => m + supportBlock(ind));

const ty = "    printer.alignCenter();\n    printer.println(\"Thank You!\");\n    printer.drawLine();";
const tyCount = (s.match(/printer\.println\("Thank You!"\);/g) || []).length;
console.log("thank-you occurrences:", tyCount);
if (tyCount !== 1) { console.error("THANKYOU_ANCHOR_BAD"); process.exit(1); }

const aboutSection = `    // About Us / support — printed only when anything is filled in on the About Us page.
    if (support.aboutText || support.whatsapp || support.phone || support.instagram) {
      printer.drawLine();
      printer.alignCenter();
      printer.bold(true);
      printer.println("About Us");
      printer.bold(false);
      printer.alignLeft();
      if (support.aboutText) {
        const lines = support.aboutText.split("\\n").map((l: string) => l.trim()).filter(Boolean).slice(0, 6);
        for (const line of lines) printer.println(line.length > 40 ? line.slice(0, 37) + "..." : line);
      }
      if (support.whatsapp) printer.println("Support (WhatsApp): " + support.whatsapp.replace(/^https?:\\/\\/(wa\\.me|api\\.whatsapp\\.com)\\/?/, ""));
      if (support.phone) printer.println("Support phone: " + support.phone);
      if (support.instagram) printer.println("Instagram: " + support.instagram.replace(/^https?:\\/\\/(www\\.)?instagram\\.com\\/?/, "@"));
      printer.drawLine();
    }

` + ty;
s = s.split(ty).join(aboutSection);

s = s.split('    printer.println("foresty-nexus.vercel.app");').join('    printer.println("foresty-nexus.vercel.app");\n    printer.alignLeft();\n    printer.println("Software, websites, POS & automation for");\n    printer.println("small businesses — built by Foresty.");');

fs.writeFileSync(f, s);
console.log("PRINT_ABOUT_OK about=" + s.includes('printer.println("About Us")') + " zap=" + s.includes("Made by foresty ⚡"));
