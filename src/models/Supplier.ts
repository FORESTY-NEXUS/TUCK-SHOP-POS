import { Schema, model, models, InferSchemaType } from "mongoose";

const SupplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    notes: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ name: "text" });

export type SupplierDoc = InferSchemaType<typeof SupplierSchema>;

export const Supplier = models.Supplier || model("Supplier", SupplierSchema);
