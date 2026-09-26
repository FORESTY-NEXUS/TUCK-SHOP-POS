// print.ts — About-Us receipt section + support defaults + brought-by line.
import fs from "fs";

const f = "src/lib/print.ts";
let s = fs.readFileSync(f, "utf8");

const getter = "  const settings = await getPrinterSettings();";
const n = (s.match(/\n  const settings = await getPrinterSettings\(\);/g) || []).length;
console.log("settings getters:", n);
if (n < 2) { console.error("GETTER_ANCHOR_BAD"); process.exit(1); }

s = s.split(getter).join(getter + `
  const support = {
    aboutText: (settings as any).aboutText || "",
    whatsapp: (settings as any).helpWhatsApp || "https://wa.me/923195403032",
    phone: (settings as any).helpPhone || "+92 319 5403032",
    instagram: (settings as any).helpInstagram || "https://instagram.com/foresty_nexus",
  };`);

const ty = "    printer.alignCenter();\n    printer.println(\"Thank You!\");\n    printer.drawLine();";
if ((s.match(/printer\.println\("Thank You!"\);/g) || []).length !== 1) {
  console.error("THANKYOU_ANCHOR_BAD");
  process.exit(1);
}
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
