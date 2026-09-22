import { Schema, model, models } from "mongoose";

const SettingsSchema = new Schema(
  {
    // Thermal printer settings (Windows printer queue name)
    printerName: { type: String, default: "" },
    printerType: { type: String, default: "EPSON" },
    paperWidth: { type: Number, default: 48 },
    autoCut: { type: Boolean, default: true },

    // Store branding
    storeName: { type: String, default: "" },
    storeAddress: { type: String, default: "" },
    storePhone: { type: String, default: "" },
    posDisplayLogo: { type: String, default: "" },   // base64 data URL
    receiptLogo: { type: String, default: "" },       // base64 data URL

    // Tuck shop specific
    currency: { type: String, default: "Rs." },
    allowNegativeStock: { type: Boolean, default: false },
    receiptDisclaimer: { type: String, default: "Thank you for shopping with us!" },
  },
  { timestamps: true }
);

// Singleton pattern: only one settings document
export const Settings = models.Settings || model("Settings", SettingsSchema);
