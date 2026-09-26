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

// Was a plain (non-unique) index. A unique index scoped to isOpen:true
// makes "only one open shift" an invariant the database enforces, not just
// something the API checks-then-creates (which is a race, and doesn't stop
// data inserted directly into the DB from ever violating it).
ShiftSchema.index({ isOpen: 1 }, { unique: true, partialFilterExpression: { isOpen: true } });

export const Shift = models.Shift || model("Shift", ShiftSchema);
