import { SessionProvider } from "@/lib/auth-client";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}