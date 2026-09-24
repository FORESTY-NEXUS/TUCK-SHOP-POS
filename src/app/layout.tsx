import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "@/lib/auth-client";

export const metadata: Metadata = {
  title: "Sevesto POS",
  description: "Sevesto POS Made by foresty — point of sale for cafes and restaurants",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-sans">
        <SessionProvider>{children}</SessionProvider>
        <Toaster position="top-right" expand={false} toastOptions={{ duration: 2500, style: { background: "#1C1917", color: "#fff", fontSize: "13px", fontFamily: "inherit" } }} />
      </body>
    </html>
  );
}
