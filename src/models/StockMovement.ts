import { Schema, model, models } from "mongoose";

export const MOVEMENT_TYPES = [
  "sale",
  "purchase",
  "adjustment",
  "return",
  "damage",
  "expired",
  "correction",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

const StockMovementSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    qty: { type: Number, required: true }, // positive = stock in, negative = stock out
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    reason: { type: String, trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    reference: { type: Schema.Types.ObjectId }, // sale, purchase, or refund ID
    referenceModel: { type: String }, // "Sale", "Purchase", "Refund"
    costPrice: { type: Number, default: 0 }, // cost at time of movement
    stockAfter: { type: Number }, // stock level after this movement
  },
  { timestamps: true }
);

StockMovementSchema.index({ product: 1, createdAt: -1 });
StockMovementSchema.index({ type: 1, createdAt: -1 });

export const StockMovement = models.StockMovement || model("StockMovement", StockMovementSchema);
