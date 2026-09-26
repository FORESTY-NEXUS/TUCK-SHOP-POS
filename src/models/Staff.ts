import { Schema, model, models, InferSchemaType } from "mongoose";

const StaffSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: ["waiter", "rider"], required: true, index: true },
    phone: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type StaffDoc = InferSchemaType<typeof StaffSchema>;

export const Staff = models.Staff || model("Staff", StaffSchema);
