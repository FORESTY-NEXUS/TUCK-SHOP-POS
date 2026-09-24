import { Schema, model, models, InferSchemaType } from "mongoose";

// A variant represents a different pack size / format of the same base
// product — e.g. Pepsi "Can", "1L", "1.5L". Each variant has its own
// barcode, price and stock so it scans and sells as its own line item,
// while still living under one parent product in inventory.
// Variants are OPT-IN: a product with an empty variants array behaves
// exactly like a plain flat product (unchanged from before this field
// existed).
const ProductVariantSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // e.g. "Can", "1.5L"
    barcode: { type: String, trim: true },
    sku: { type: String, trim: true },
    sellingPrice: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 5, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { _id: true, timestamps: false }
);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true, sparse: true, index: true },
    sku: { type: String, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    purchasePrice: { type: Number, required: true, default: 0, min: 0 },
    // Required UNLESS the product has at least one size/pack variant —
    // a variants-only parent (e.g. plain "Pepsi" sold only as Can/1L/1.5L)
    // is allowed to carry no price of its own. `this` is the document
    // itself during Product.create()/doc.save() validation, so the sibling
    // `variants` array is visible here.
    sellingPrice: {
      type: Number,
      min: 0,
      required: function (this: { variants?: unknown[] }) {
        return !this.variants || this.variants.length === 0;
      },
    },
    stock: { type: Number, default: 0 },
    minStock: { type: Number, default: 5, min: 0 },
    unit: { type: String, default: "piece", trim: true },
    brand: { type: String, trim: true },
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },
    image: { type: String, default: "" }, // base64 data URL
    tax: { type: Number, default: 0, min: 0 }, // percentage
    isActive: { type: Boolean, default: true },
    // Optional list of size/pack variations. Empty/absent = flat product,
    // exactly as before.
    variants: { type: [ProductVariantSchema], default: [] },
  },
  { timestamps: true }
);

// Barcode must be unique among active products (sparse allows null/empty)
ProductSchema.index(
  { barcode: 1 },
  { unique: true, sparse: true, partialFilterExpression: { barcode: { $ne: "" } } }
);
// Variant barcodes must also be unique (across all products' variants) —
// a multikey unique index enforces this across array entries and across
// documents, matching how the top-level barcode index behaves.
ProductSchema.index(
  { "variants.barcode": 1 },
  { unique: true, sparse: true, partialFilterExpression: { "variants.barcode": { $ne: "" } } }
);
ProductSchema.index({ name: "text", barcode: "text", sku: "text", brand: "text" });

export type ProductDoc = InferSchemaType<typeof ProductSchema>;

export const Product = models.Product || model("Product", ProductSchema);
