import CustomersClient from "./CustomersClient";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";
import { getCustomers, getOrderHistory } from "@/lib/queries";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const customerId = params.customerId;

  const customers: any[] = await getCustomers();
  const selected = customerId ? customers.find((c) => c._id === customerId) || null : null;
  const history = customerId
    ? (await getOrderHistory({ customerId, range: "all", page: 1 })).orders
    : [];

  return (
    <AppLayout>
      <CustomersClient
        initialCustomers={customers as any}
        initialSelectedCustomer={selected}
        initialOrderHistory={history as any}
      />
    </AppLayout>
  );
}
