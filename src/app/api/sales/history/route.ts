import { NextRequest, NextResponse } from "next/server";
import { getOrderHistory } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const data = await getOrderHistory({
    page: parseInt(sp.get("page") || "1", 10),
    range: sp.get("range") || "all",
    status: sp.get("status") || undefined,
    paymentMethod: sp.get("payment") || undefined,
    search: sp.get("search") || undefined,
    customStart: sp.get("start") || undefined,
    customEnd: sp.get("end") || undefined,
  });
  return NextResponse.json(data);
}
