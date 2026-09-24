import { NextRequest, NextResponse } from "next/server";
import { getSalesReport } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const revalidate = 60;

// Thin wrapper: the analytics live in lib/queries.getSalesReport (single
// source of truth shared with the server-rendered reports page).
export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get("range") || "today";
  const start = req.nextUrl.searchParams.get("start") || undefined;
  const end = req.nextUrl.searchParams.get("end") || undefined;
  const report = await getSalesReport(range, start, end);
  return NextResponse.json(report);
}
