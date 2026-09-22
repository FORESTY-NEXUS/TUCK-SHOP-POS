import AboutManager from "@/components/admin/AboutManager";

// admin/layout.tsx already provides the single AppLayout (sidebar + header).
// Wrapping again here would render two sidebars — same class of bug that
// hit the other admin pages in Round 2, which is exactly what this fix
// is for.
export default function AdminAboutPage() {
  return (
    <div className="h-full w-full overflow-hidden">
      <AboutManager />
    </div>
  );
}
