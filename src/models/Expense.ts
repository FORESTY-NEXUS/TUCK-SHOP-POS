import { Schema, model, models } from "mongoose";

export const EXPENSE_CATEGORIES = [
  "Electricity",
  "Rent",
  "Transport",
  "Salary",
  "Maintenance",
  "Delivery",
  "Miscellaneous",
] as const;

const ExpenseSchema = new Schema(
  {
    category: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    description: { type: String, trim: true },
    date: { type: Date, required: true, default: Date.now },
    user: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

ExpenseSchema.index({ date: -1 });
ExpenseSchema.index({ category: 1, date: -1 });

export const Expense = models.Expense || model("Expense", ExpenseSchema);
