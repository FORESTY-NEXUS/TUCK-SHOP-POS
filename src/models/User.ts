import { Schema, model, models, InferSchemaType } from "mongoose";

export const USER_ROLES = ["cashier", "manager", "admin"] as const;

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    // Staff log in with a short PIN via numpad, not a typed password.
    pinHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: "cashier" },
    isActive: { type: Boolean, default: true },
    // Set on first boot (default admin) and on PIN resets: the user must
    // choose a new PIN before the app lets them do anything else.
    mustChangePin: { type: Boolean, default: false },
    // Overrides the role's default access. Ignored for admins, who always
    // have full access -- see lib/permissions.ts.
    permissions: { type: [String], default: undefined },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User = models.User || model("User", UserSchema);
