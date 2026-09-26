import { Settings } from "@/models/Settings";
import { connectDB } from "@/lib/db";
import { ThermalPrinter, PrinterTypes, CharacterSet } from "node-thermal-printer";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { execSync } from "child_process";

type PrinterSettings = {
  printerName?: string;
  printerType?: string;
  paperWidth?: number;
  autoCut?: boolean;
  printingEnabled?: boolean;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  receiptLogo?: string;
  posDisplayLogo?: string;
};

async function getPrinterSettings(): Promise<PrinterSettings> {
  await connectDB();
  const settings = (await Settings.findOne().lean()) as PrinterSettings | null;
  if (!settings) {
    return { printerName: "", printerType: "EPSON", paperWidth: 48, autoCut: true, printingEnabled: true, storeName: "Sevesto POS" };
  }
  return settings;
}

function getPrinterType(type: string): PrinterTypes {
  switch (type?.toUpperCase()) {
    case "STAR": return PrinterTypes.STAR;
    case "TANCA": return PrinterTypes.TANCA;
    case "DARUMA": return PrinterTypes.DARUMA;
    case "BROTHER": return PrinterTypes.BROTHER;
    case "CUSTOM": return PrinterTypes.CUSTOM;
    default: return PrinterTypes.EPSON;
  }
}

async function generateEscPosBuffer(order: any): Promise<Buffer> {
  const settings = await getPrinterSettings();
  const printer = new ThermalPrinter({
    type: getPrinterType(settings.printerType || "EPSON"),
    interface: "file",
    width: settings.paperWidth || 48,
    characterSet: CharacterSet.PC850_MULTILINGUAL,
    removeSpecialCharacters: false,
    lineCharacter: "-",
  });

  const displayName = settings.storeName || "SEVESTO POS";

  // Customer receipt format (with prices) — the only receipt type a tuck
  // shop needs (single counter sale, no kitchen ticket / delivery slip).
  {
    // Best-effort store logo (raster). printImage() in this library reads
    // from a file path, not a raw buffer, so the base64 logo is written to
    // a temp PNG first; if anything goes wrong the receipt still prints
    // with the wordmark instead of failing the whole job.
    const logoPng = settings.receiptLogo?.startsWith("data:image/png;base64,")
      ? Buffer.from(settings.receiptLogo.split(",")[1] || "", "base64")
      : null;
    let logoTempFile: string | null = null;
    if (logoPng && logoPng.length > 0 && logoPng.length < 1_500_000) {
      try {
        logoTempFile = join(tmpdir(), `receipt-logo-${Date.now()}.png`);
        writeFileSync(logoTempFile, logoPng);
        await (printer as any).printImage(logoTempFile);
      } catch (err) {
        console.warn("Receipt logo skipped:", err);
      } finally {
        if (logoTempFile && existsSync(logoTempFile)) {
          try { unlinkSync(logoTempFile); } catch { /* best-effort cleanup */ }
        }
      }
    }

    printer.alignCenter();
    printer.bold(true);
    printer.println(displayName);
    printer.bold(false);
    if (settings.storeAddress) {
      printer.println(settings.storeAddress);
    }
    if (settings.storePhone) {
      printer.println(settings.storePhone);
      const digits = settings.storePhone.replace(/\D/g, "");
      if (digits) {
        printer.println(`WhatsApp: wa.me/${digits}`);
      }
    }
    printer.println("Customer Receipt");
    printer.drawLine();

    printer.alignLeft();
    printer.println(`Sale: ${order.saleNumber}`);
    if (order.customer?.name) {
      printer.println(`Customer: ${order.customer.name}`);
    }
    if (order.customer?.phone) {
      printer.println(`Phone: ${order.customer.phone}`);
    }
    const date = new Date(order.paidAt || order.createdAt);
    printer.println(`Date: ${date.toLocaleString()}`);
    printer.drawLine();

    for (const item of order.items) {
      const qty = item.qty > 1 ? `${item.qty}x ` : "";
      const lineTotal = item.sellingPrice * item.qty - (item.lineDiscount || 0);
      printer.println(`${qty}${item.name}`);
      printer.println(`  Rs. ${item.sellingPrice.toFixed(2)} x ${item.qty} = Rs. ${lineTotal.toFixed(2)}`);
      if (item.lineDiscount && item.lineDiscount > 0) {
        printer.println(`  (-Rs. ${item.lineDiscount.toFixed(2)} off)`);
      }
    }
    printer.drawLine();

    printer.println(`Subtotal: Rs. ${order.subtotal.toFixed(2)}`);
    if (order.discountAmount && order.discountAmount > 0) {
      printer.println(`Discount (${order.discountPercent}%): -Rs. ${order.discountAmount.toFixed(2)}`);
    }
    printer.drawLine();
    printer.bold(true);
    printer.println(`TOTAL: Rs. ${order.total.toFixed(2)}`);
    printer.bold(false);
    printer.drawLine();

    if (order.paymentMethod) {
      const labels: Record<string, string> = {
        cash: "Cash",
        easypaisa: "EasyPaisa",
        jazzcash: "JazzCash",
        card: "Card",
        bank_transfer: "Bank Transfer",
        mobile_wallet: "Mobile Wallet",
        credit: "Credit / Udhaar",
        other: "Other",
      };
      printer.println(`Payment: ${labels[order.paymentMethod] || order.paymentMethod}`);
      if (order.amountReceived) {
        printer.println(`Amount: Rs. ${order.amountReceived.toFixed(2)}`);
        if (order.change && order.change > 0) {
          printer.println(`Change: Rs. ${order.change.toFixed(2)}`);
        }
      }
      printer.drawLine();
    }

    printer.alignCenter();
    printer.println("Thank You!");
    printer.drawLine();

    // A short, human note — no AI boilerplate, this is the counter talking.
    printer.alignLeft();
    printer.println("Fresh food, warm service — that's");
    printer.println("what this counter is about. We cook");
    printer.println("every order the way we'd serve it to");
    printer.println("our own family. See you soon.");
    printer.drawLine();

    printer.alignCenter();
    printer.bold(true);
    printer.println("Powered by Sevesto POS");
    printer.println("Made by foresty ⚡");
    printer.bold(false);
    printer.println("foresty-nexus.vercel.app");
    printer.drawLine();

    if (settings.autoCut) {
      printer.cut();
    }
  }

  // Execute to get the buffer.
  // We use the "file" interface only to build up the ESC/POS command
  // sequence in memory — the library never actually writes it anywhere for
  // this interface type, so getBuffer() is the only way to retrieve what
  // was built. If a future version of the library removes/renames this
  // method, fail loudly here rather than silently sending an empty buffer
  // to the printer (which would report "printed" while producing a blank
  // slip of paper).
  if (typeof (printer as any).getBuffer !== "function") {
    throw new Error(
      "node-thermal-printer has no getBuffer() in this version — receipt buffer can't be built. Check the installed package version."
    );
  }
  const buffer = (printer as any).getBuffer();
  if (!buffer || buffer.length === 0) {
    throw new Error("Receipt buffer came back empty — nothing was sent to the printer.");
  }
  return Buffer.from(buffer);
}

async function sendToWindowsPrinter(printerName: string, data: Buffer): Promise<{ success: boolean; error?: string }> {
  if (!printerName) {
    return { success: false, error: "No printer name configured" };
  }

  try {
    // Write buffer to temp file
    const tempFile = join(tmpdir(), `escpos-${Date.now()}.bin`);
    writeFileSync(tempFile, data);

    // Use PowerShell to send raw data to Windows printer
    // Using .NET RawPrinterHelper approach via PowerShell
    const psScript = `
      Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class RawPrinterHelper {
          [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
          public class DOCINFOA {
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDocName;
            [MarshalAs(UnmanagedType.LPStr)]
            public string pOutputFile;
            [MarshalAs(UnmanagedType.LPStr)]
            public string pDataType;
          }
          [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
          public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
          [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
          public static extern bool ClosePrinter(IntPtr hPrinter);
          [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
          public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.Struct)] DOCINFOA di);
          [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
          public static extern bool EndDocPrinter(IntPtr hPrinter);
          [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
          public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
          public static bool SendBytesToPrinter(string szPrinterName, byte[] pBytes) {
            IntPtr hPrinter = IntPtr.Zero;
            DOCINFOA di = new DOCINFOA();
            di.pDocName = "ESCPOS Print Job";
            di.pDataType = "RAW";
            if (!OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero)) return false;
            if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return false; }
            IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(pBytes.Length);
            Marshal.Copy(pBytes, 0, pUnmanagedBytes, pBytes.Length);
            Int32 dwWritten = 0;
            bool success = WritePrinter(hPrinter, pUnmanagedBytes, pBytes.Length, out dwWritten);
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
            EndDocPrinter(hPrinter);
            ClosePrinter(hPrinter);
            return success;
          }
        }
"@
      $bytes = [System.IO.File]::ReadAllBytes('${tempFile.replace(/\\/g, '\\\\')}')
      $result = [RawPrinterHelper]::SendBytesToPrinter('${printerName.replace(/'/g, "''")}', $bytes)
      if (-not \$result) { exit 1 }
    `;

    execSync(`powershell -NoProfile -Command "${psScript}"`, { timeout: 5000, stdio: "ignore" });

    // Clean up temp file
    if (existsSync(tempFile)) {
      unlinkSync(tempFile);
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function printReceipt(order: any): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const settings = await getPrinterSettings();
    if (settings.printingEnabled === false) {
      return { success: false, skipped: true, error: "Receipt printing is turned off in Settings" };
    }
    if (!settings.printerName) {
      return { success: false, error: "No printer configured in settings" };
    }

    const buffer = await generateEscPosBuffer(order);
    return await sendToWindowsPrinter(settings.printerName, buffer);
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}