import { Schema, model, models } from "mongoose";

export const CREDIT_TYPES = ["credit", "payment", "return", "adjustment"] as const;

const CustomerCreditSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    amount: { type: Number, required: true }, // positive for both types
    type: { type: String, enum: CREDIT_TYPES, required: true },
    reference: { type: Schema.Types.ObjectId }, // sale ID for credit type
    referenceModel: { type: String }, // "Sale"
    notes: { type: String, trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CustomerCreditSchema.index({ customer: 1, createdAt: -1 });

export const CustomerCredit =
  models.CustomerCredit || model("CustomerCredit", CustomerCreditSchema);
