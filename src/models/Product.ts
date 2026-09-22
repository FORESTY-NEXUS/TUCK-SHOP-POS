import { Schema, model, models, InferSchemaType } from "mongoose";

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, sparse: true, index: true },
    sku: { type: String, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    purchasePrice: { type: Number, required: true, default: 0, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 5, min: 0 },
    unit: { type: String, default: "piece", trim: true },
    brand: { type: String, trim: true },
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },
    image: { type: String, default: "" }, // base64 data URL
    tax: { type: Number, default: 0, min: 0 }, // percentage
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Barcode must be unique among active products (sparse allows null/empty)
ProductSchema.index(
  { barcode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { barcode: { $ne: "" } } }
);
ProductSchema.index({ name: "text", barcode: "text", sku: "text", brand: "text" });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;

export const Product = models.Product || model("Product", ProductSchema);
