import { Schema, model, models } from "mongoose";

const PurchaseItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    costPrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, min: 0 }, // optional: update product selling price
  },
  { _id: false }
);

const PurchaseSchema = new Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true, index: true },
    supplier: { type: Schema.Types.ObjectId, ref: "Supplier" },
    items: { type: [PurchaseItemSchema], default: [] },
    totalCost: { type: Number, required: true, default: 0 },
    notes: { type: String, trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PurchaseSchema.index({ supplier: 1, createdAt: -1 });
PurchaseSchema.index({ createdAt: -1 });

export const Purchase = models.Purchase || model("Purchase", PurchaseSchema);
