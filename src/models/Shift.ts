import { Schema, model, models } from "mongoose";

const ShiftSchema = new Schema(
  {
    cashier: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedAt: { type: Date, required: true, default: Date.now },
    closedAt: { type: Date },
    openingBalance: { type: Number, required: true, default: 0 },
    // Filled in at close time from the orders placed during this shift.
    closingBalance: { type: Number },
    expectedCash: { type: Number },
    difference: { type: Number },
    isOpen: { type: Boolean, default: true },
    // Persisted at close time for shift history / reports
    byMethod: {
      type: Schema.Types.Mixed,
      default: {},
    },
    orderCount: { type: Number, default: 0 },
    refundCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ShiftSchema.index({ isOpen: 1 });

export const Shift = models.Shift || model("Shift", ShiftSchema);
