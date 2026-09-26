import bcrypt from "bcryptjs";
import { User } from "@/models/User";

export const DEFAULT_ADMIN_PIN = "1234";

// PINs that are too easy to guess. Rejected for every new or changed PIN.
const WEAK_PINS = new Set([
  "0000", "1111", "2222", "3333", "4444", "5555", "6666", "7777", "8888", "9999",
  "1234", "4321", "1212", "2121", "1122", "2580", "0123", "1004",
]);

export function isWeakPin(pin: string): boolean {
  return WEAK_PINS.has(pin);
}

/** Creates the default admin (PIN 1234, must change on first login) when the
 *  users collection is empty. Safe to call on every login attempt. */
export async function ensureDefaultAdmin(): Promise<void> {
  const count = await User.countDocuments();
  if (count > 0) return;
  await User.create({
    name: "Admin",
    role: "admin",
    pinHash: await bcrypt.hash(DEFAULT_ADMIN_PIN, 10),
    isActive: true,
    mustChangePin: true,
  });
}

/** True if another account already uses this PIN. Login matches PINs across
 *  all users, so two accounts sharing a PIN would make one unreachable. */
export async function pinInUse(pin: string, exceptUserId?: string): Promise<boolean> {
  const filter = exceptUserId ? { _id: { $ne: exceptUserId } } : {};
  const users = await User.find(filter).select("+pinHash").lean();
  for (const u of users) {
    if (await bcrypt.compare(pin, u.pinHash)) return true;
  }
  return false;
}
