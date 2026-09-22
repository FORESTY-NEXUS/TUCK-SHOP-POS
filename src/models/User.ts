import { Schema, model, models, InferSchemaType } from "mongoose";

export const USER_ROLES = ["cashier", "manager", "admin"] as const;

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Counter staff log in with a short PIN via numpad, not a typed
    // password — matches the fast-tap style of the rest of the app.
    pinHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: "cashier" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User = models.User || model("User", UserSchema);
