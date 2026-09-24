import { Schema, model, models } from "mongoose";

const AuditLogSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User" },
  userName: { type: String }, // denormalized for quick reading
  action: { type: String, required: true }, // e.g. "price_change", "stock_adjustment", "product_deleted"
  target: { type: String, required: true }, // e.g. "Product", "Sale", "Customer"
  targetId: { type: String },
  targetName: { type: String }, // e.g. "Coca Cola 500ml"
  before: { type: Schema.Types.Mixed },
  after: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true },
});

AuditLogSchema.index({ target: 1, timestamp: -1 });
AuditLogSchema.index({ user: 1, timestamp: -1 });

export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
