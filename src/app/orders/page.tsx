import OrderHistoryClient from "./OrderHistoryClient";
export const dynamic = "force-dynamic";
import AppLayout from "@/components/Layout/AppLayout";
import { getOrderHistory } from "@/lib/queries";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; range?: string; type?: string; status?: string; search?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const range = params.range || "all";

  const data = await getOrderHistory({
    page,
    range,
    status: params.status,
    search: params.search,
    customStart: params.start,
    customEnd: params.end,
  });

  return (
    <AppLayout>
      <OrderHistoryClient initialData={data as any} />
    </AppLayout>
  );
}
