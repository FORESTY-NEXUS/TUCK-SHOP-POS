import AppLayout from "@/components/Layout/AppLayout";

// Single source of chrome for every /admin route: exactly ONE sidebar +
// header, rendered here — pages under /admin must NOT wrap themselves.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
