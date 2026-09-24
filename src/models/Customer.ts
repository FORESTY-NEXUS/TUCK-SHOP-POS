import { Schema, model, models, InferSchemaType } from "mongoose";

const CustomerSchema = new Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, required: true, unique: true, index: true },
    address: { type: String, trim: true },
    creditBalance: { type: Number, default: 0 }, // positive = customer owes shop
  },
  { timestamps: true }
);

CustomerSchema.index({ name: "text", phone: "text" });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema>;

export const Customer = models.Customer || model("Customer", CustomerSchema);
