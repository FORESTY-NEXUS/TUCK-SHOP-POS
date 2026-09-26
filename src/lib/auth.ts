import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE = "sevesto_session";

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET must be set in production (add it to .env.local)");
}
const secretKey = new TextEncoder().encode(sessionSecret || "dev-only-insecure-secret-change-me");

import type { Permission } from "./permissions";

export type SessionPayload = {
  userId: string;
  name: string;
  role: "cashier" | "manager" | "admin";
  mustChangePin?: boolean;
  permissions?: Permission[];
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h") // one shift's worth; re-login next shift
    .sign(secretKey);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };

/** True once a session exists AND its role is manager or admin. */
export function isManagerOrAdmin(session: SessionPayload | null): session is SessionPayload {
  return !!session && (session.role === "manager" || session.role === "admin");
}

/** True only for admin. */
export function isAdmin(session: SessionPayload | null): session is SessionPayload {
  return !!session && session.role === "admin";
}
