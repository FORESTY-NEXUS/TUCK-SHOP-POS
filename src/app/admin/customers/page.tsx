import CustomerManager from "@/components/admin/CustomerManager";
export const dynamic = "force-dynamic";
import { getCustomers } from "@/lib/queries";

export default async function AdminCustomersPage() {
  const customers = await getCustomers();
  return (
    <div className="h-full w-full">
      <div className="px-6 py-8 w-full">
        <h1 className="text-2xl font-bold text-stone-900 font-brand">Customers</h1>
        <p className="text-sm text-stone-500 mt-0.5 mb-6">Directory and loyalty management</p>
        <CustomerManager initialCustomers={customers as any} />
      </div>
    </div>
  );
}
