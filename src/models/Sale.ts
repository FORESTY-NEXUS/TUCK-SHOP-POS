import { Schema, model, models, Types } from "mongoose";

export const PAYMENT_METHODS = [
  "cash",
  "card",
  "easypaisa",
  "jazzcash",
  "bank_transfer",
  "mobile_wallet",
  "credit",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SALE_STATUSES = [
  "completed",
  "returned",
  "partially_returned",
  "voided",
] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

const SaleItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sellingPrice: { type: Number, required: true },
    purchasePrice: { type: Number, required: true, default: 0 }, // cost snapshot at sale time
    qty: { type: Number, required: true, min: 1 },
    lineDiscount: { type: Number, default: 0 }, // flat amount off this line
    qtyReturned: { type: Number, default: 0 },
  },
  { _id: true }
);

const SaleSchema = new Schema(
  {
    saleNumber: { type: String, required: true, unique: true, index: true },
    items: { type: [SaleItemSchema], default: [] },

    subtotal: { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    amountReceived: { type: Number, default: 0 },
    change: { type: Number, default: 0 },

    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    cashier: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shift: { type: Schema.Types.ObjectId, ref: "Shift" },

    isPaid: { type: Boolean, default: true },
    paidAt: { type: Date },
    note: { type: String },

    status: { type: String, enum: SALE_STATUSES, default: "completed" },

    // Refund/return tracking
    returnedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ status: 1, createdAt: -1 });
SaleSchema.index({ paymentMethod: 1, createdAt: -1 });

export type SaleItem = {
  product: Types.ObjectId;
  name: string;
  sellingPrice: number;
  purchasePrice: number;
  qty: number;
  lineDiscount?: number;
  qtyReturned?: number;
};

export const Sale = models.Sale || model("Sale", SaleSchema);
