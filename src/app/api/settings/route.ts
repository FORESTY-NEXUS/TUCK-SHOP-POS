import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Settings } from "@/models/Settings";

// GET /api/settings — returns current settings (singleton)
export async function GET() {
  await connectDB();

  let settings = await Settings.findOne().lean();
  if (!settings) {
    // Create default settings if none exist
    const defaultSettings = await Settings.create({
      rupeesPerPoint: 100, // 1 point per Rs. 100 spent
    });
    settings = defaultSettings.toObject();
  }

  return NextResponse.json(settings);
}

// PATCH /api/settings — update settings
export async function PATCH(req: NextRequest) {
  await connectDB();

  const body = await req.json();
  const {
    rupeesPerPoint, printerName, printerType, paperWidth, autoCut, printingEnabled,
    speedDial,
    storeName, storeAddress, storePhone, posDisplayLogo, receiptLogo,
  } = body;

  // Validate rupeesPerPoint
  if (rupeesPerPoint !== undefined && (typeof rupeesPerPoint !== "number" || rupeesPerPoint < 1)) {
    return NextResponse.json(
      { error: "rupeesPerPoint must be a positive number" },
      { status: 400 }
    );
  }

  // Validate paperWidth
  if (paperWidth !== undefined && (typeof paperWidth !== "number" || paperWidth < 1)) {
    return NextResponse.json(
      { error: "paperWidth must be a positive number" },
      { status: 400 }
    );
  }

  // Validate printerType
  const validPrinterTypes = ["EPSON", "STAR", "TANCA", "DARUMA", "BROTHER", "CUSTOM"];
  if (printerType !== undefined && !validPrinterTypes.includes(printerType)) {
    return NextResponse.json(
      { error: `printerType must be one of: ${validPrinterTypes.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate speedDial: must be object with keys 0-9 mapping to product IDs (strings)
  if (speedDial !== undefined) {
    if (typeof speedDial !== "object" || speedDial === null || Array.isArray(speedDial)) {
      return NextResponse.json(
        { error: "speedDial must be an object" },
        { status: 400 }
      );
    }
    for (const [key, value] of Object.entries(speedDial)) {
      const numKey = Number(key);
      if (isNaN(numKey) || numKey < 0 || numKey > 9 || !Number.isInteger(numKey)) {
        return NextResponse.json(
          { error: "speedDial keys must be integers 0-9" },
          { status: 400 }
        );
      }
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: "speedDial values must be product ID strings" },
          { status: 400 }
        );
      }
    }
  }

  // Validate printingEnabled
  if (printingEnabled !== undefined && typeof printingEnabled !== "boolean") {
    return NextResponse.json(
      { error: "printingEnabled must be a boolean" },
      { status: 400 }
    );
  }

  // Build update object with only provided fields
  const update: Record<string, unknown> = {};
  if (rupeesPerPoint !== undefined) update.rupeesPerPoint = rupeesPerPoint;
  if (printerName !== undefined) update.printerName = printerName;
  if (printerType !== undefined) update.printerType = printerType;
  if (paperWidth !== undefined) update.paperWidth = paperWidth;
  if (autoCut !== undefined) update.autoCut = autoCut;
  if (printingEnabled !== undefined) update.printingEnabled = printingEnabled;
  if (speedDial !== undefined) update.speedDial = speedDial;
  if (storeName !== undefined) update.storeName = storeName;
  if (storeAddress !== undefined) update.storeAddress = storeAddress;
  if (storePhone !== undefined) update.storePhone = storePhone;
  if (posDisplayLogo !== undefined) update.posDisplayLogo = posDisplayLogo;
  if (receiptLogo !== undefined) update.receiptLogo = receiptLogo;

  // Upsert: create if it doesn't exist, update if it does. A single explicit
  // $set means no two operators can ever touch the same path (the
  // ConflictingUpdateOperators class of crash) and an empty update is a no-op.
  const settings =
    Object.keys(update).length === 0
      ? await Settings.findOne().lean()
      : await Settings.findOneAndUpdate({}, { $set: update }, { new: true, upsert: true }).lean();

  return NextResponse.json(settings);
}
