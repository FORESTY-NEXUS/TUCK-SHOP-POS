"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { FRONTEND_SESSION_STORAGE_KEY } from "@/lib/frontend-auth";

type SessionUser = {
  userId: string;
  name: string;
  role: "cashier" | "manager" | "admin";
} | null;

type SessionContextType = {
  user: SessionUser;
  loading: boolean;
};

const defaultContext: SessionContextType = { user: null, loading: true };
const SessionContext = createContext<SessionContextType>(defaultContext);
const SessionProviderComp = SessionContext.Provider;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSession() {
      if (localStorage.getItem(FRONTEND_SESSION_STORAGE_KEY) === "true") {
        setUser({ userId: "frontend-admin", name: "Admin", role: "admin" });
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/session");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, []);

  const contextValue = { user, loading };
  return (
    <SessionProviderComp value={contextValue}>
      {children}
    </SessionProviderComp>
  );
}

export function useSession(): SessionContextType {
  return useContext(SessionContext);
}
