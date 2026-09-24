import CustomerLoyaltyClient from "./CustomerLoyaltyClient";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";
import { getCustomers, getOrderHistory } from "@/lib/queries";

export default async function CustomerLoyaltyPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const params = await searchParams;
  const customerId = params.customerId;

  const customers: any[] = (await getCustomers())
    .filter((c: any) => c.phone !== "0000000000")
    .sort((a: any, b: any) => (b.loyaltyPoints || 0) - (a.loyaltyPoints || 0));

  const selected = customerId ? customers.find((c) => c._id === customerId) || null : null;
  const history = customerId ? (await getOrderHistory({ customerId, range: "all" })).orders : [];

  return (
    <AppLayout>
      <CustomerLoyaltyClient
        allCustomers={customers as any}
        initialCustomer={selected}
        initialHistory={history as any}
      />
    </AppLayout>
  );
}
