import StaffAccountsManager from "@/components/admin/StaffAccountsManager";
export const dynamic = "force-dynamic";

export default function AdminStaffPage() {
  return (
    <div className="h-full w-full">
      <div className="px-6 py-8 w-full">
        <h1 className="text-2xl font-bold text-stone-900 font-brand">Staff Accounts</h1>
        <p className="text-sm text-stone-500 mt-0.5 mb-6">Cashier, manager and admin logins</p>
        <StaffAccountsManager />
      </div>
    </div>
  );
}
