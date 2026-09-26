import { connectDB } from "@/lib/db";
import { Sale } from "@/models/Sale";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { Customer } from "@/models/Customer";
import { Shift } from "@/models/Shift";
import { Settings } from "@/models/Settings";
import { sanitizeForClient } from "@/lib/serialize";
import { User } from "@/models/User";
import { StockMovement } from "@/models/StockMovement";
import { CustomerCredit } from "@/models/CustomerCredit";

// Server-side data helpers used by Server Components for the initial paint.
// Client components then refresh through the API routes. All results are
// sanitized for the Server -> Client serialization boundary.

export function getDateRange(range: string, customStart?: string, customEnd?: string): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
  switch (range) {
    case "today": return { start: todayStart, end: todayEnd };
    case "yesterday": {
      const y = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      return { start: y, end: new Date(y.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
    case "this_week": {
      const ws = new Date(todayStart.getTime() - now.getDay() * 24 * 60 * 60 * 1000);
      return { start: ws, end: new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000 - 1) };
    }
    case "this_month": {
      const ms = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: ms, end: new Date(now.getFullYear(), now.getMonth() + 1, 1, 23, 59, 59, 999) };
    }
    case "all": return { start: new Date("2020-01-01"), end: todayEnd };
    case "custom": {
      if (!customStart || !customEnd) return { start: todayStart, end: todayEnd };
      const s = new Date(customStart); s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    default: return { start: todayStart, end: todayEnd };
  }
}

export async function getSalesReport(range = "today", customStart?: string, customEnd?: string) {
  await connectDB();
  const { start, end } = getDateRange(range, customStart, customEnd);

  const sales = await Sale.find({
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ["voided"] },
  }).populate("items.product", "name category").lean();

  // Previous-period comparison
  const rangeMs = end.getTime() - start.getTime() + 1;
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - rangeMs + 1);
  const prevPeriodSales = await Sale.find({
    createdAt: { $gte: prevStart, $lte: prevEnd },
    status: { $nin: ["voided"] },
  }).lean();
  const prevPeriodNet = prevPeriodSales.reduce((s, o) => s + (o.total ?? 0) - (o.returnedAmount ?? 0), 0);

  const dayCount = Math.max(1, Math.round(rangeMs / (24 * 60 * 60 * 1000)));
  const hourlyBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, revenue: 0, orders: 0 }));
  for (const o of sales) {
    const h = new Date(o.createdAt as any).getHours();
    hourlyBuckets[h].revenue += o.total ?? 0;
    hourlyBuckets[h].orders += 1;
  }
  const hourlyPattern = hourlyBuckets.map((b) => ({
    hour: b.hour,
    revenue: Math.round((b.revenue / dayCount) * 100) / 100,
    orders: b.orders,
  }));

  const categories = await Category.find({ isActive: true }).lean();
  const catMap = new Map(categories.map((c) => [String(c._id), c.name]));

  const grossRevenue = sales.reduce((s, o) => s + (o.total ?? 0), 0);
  const totalRefunded = sales.reduce((s, o) => s + (o.returnedAmount ?? 0), 0);
  const netRevenue = grossRevenue - totalRefunded;
  const methodBreakdown: Record<string, { gross: number; refunded: number; net: number }> = {};
  
  for (const m of ["cash", "easypaisa", "jazzcash", "card", "bank_transfer", "credit"]) {
    methodBreakdown[m] = { gross: 0, refunded: 0, net: 0 };
  }
  
  for (const o of sales) {
    if (o.paymentMethod) {
      if (!methodBreakdown[o.paymentMethod]) {
         methodBreakdown[o.paymentMethod] = { gross: 0, refunded: 0, net: 0 };
      }
      methodBreakdown[o.paymentMethod].gross += o.total ?? 0;
      methodBreakdown[o.paymentMethod].refunded += o.returnedAmount ?? 0;
    }
  }
  
  for (const m of Object.keys(methodBreakdown)) {
     methodBreakdown[m].net = methodBreakdown[m].gross - methodBreakdown[m].refunded;
  }

  const orderCounts: Record<string, number> = { pos_sale: sales.length };

  const itemMap = new Map<string, { _id: string; name: string; qty: number; revenue: number }>();
  for (const o of sales) {
    for (const item of o.items || []) {
      const name = item.name.trim();
      const key = name.toLocaleLowerCase();
      const existing = itemMap.get(key) ?? { _id: key, name, qty: 0, revenue: 0 };
      const lineTotal = item.sellingPrice * (item.qty - (item.qtyReturned || 0)) - (item.lineDiscount || 0);
      existing.qty += (item.qty - (item.qtyReturned || 0));
      existing.revenue += lineTotal;
      itemMap.set(key, existing);
    }
  }

  const rankedItems = Array.from(itemMap.values()).filter((i) => i.qty > 0).sort((a, b) => b.qty - a.qty);
  const bestItems = rankedItems.slice(0, 5);
  const worstItems = rankedItems.slice(-5).reverse();
  const topItems = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 20);

  const catRevenue: Record<string, { qty: number; revenue: number }> = {};
  for (const o of sales) {
    for (const item of o.items || []) {
      const lineTotal = item.sellingPrice * (item.qty - (item.qtyReturned || 0)) - (item.lineDiscount || 0);
      const catName = catMap.get(String((item.product as any)?.category)) || "Unknown";
      catRevenue[catName] = catRevenue[catName] || { qty: 0, revenue: 0 };
      catRevenue[catName].qty += (item.qty - (item.qtyReturned || 0));
      catRevenue[catName].revenue += lineTotal;
    }
  }
  const revenueByCategory = Object.entries(catRevenue)
    .map(([category, data]) => ({ category, qty: data.qty, revenue: data.revenue }))
    .sort((a, b) => b.revenue - a.revenue);

  const dayMap = new Map<string, { date: string; revenue: number; orders: number }>();
  for (const o of sales) {
    const d = new Date(o.createdAt as any);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dayMap.set(key, dayMap.get(key) || { date: key, revenue: 0, orders: 0 });
    dayMap.get(key)!.revenue += o.total ?? 0;
    dayMap.get(key)!.orders += 1;
  }
  let dailySeries = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  
  if (dailySeries.length > 1) {
    const filled: typeof dailySeries = [];
    let cursor = new Date(dailySeries[0].date);
    const last = new Date(dailySeries[dailySeries.length - 1].date);
    const map = new Map(dailySeries.map((d) => [d.date, d]));
    while (cursor.getTime() <= last.getTime()) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      filled.push(map.get(key) || { date: key, revenue: 0, orders: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
    dailySeries = filled;
  }

  const aovSeries = Array.isArray(dailySeries)
    ? dailySeries.map((d) => ({ ...d, aov: d.orders > 0 ? Math.round((d.revenue / d.orders) * 100) / 100 : 0 }))
    : [];

  return sanitizeForClient({
    range: { start: start.toISOString(), end: end.toISOString(), label: range },
    summary: {
      grossRevenue, totalRefunded, netRevenue, totalOrders: sales.length, orderCounts,
      methodBreakdown, topItems, revenueByCategory, dailySeries,
      refundCount: sales.filter(s => (s.returnedAmount || 0) > 0).length, 
      refundAmount: totalRefunded,
      prevPeriod: {
        netRevenue: prevPeriodNet,
        orders: prevPeriodSales.length,
        revenueChangePct: prevPeriodNet > 0 ? Math.round((((grossRevenue - totalRefunded - prevPeriodNet) / prevPeriodNet) * 100) * 10) / 10 : null,
      },
      hourlyPattern,
      bestItems,
      worstItems,
      aovSeries,
    },
  });
}

export async function getOrderHistory(opts: { page?: number; range?: string; status?: string; paymentMethod?: string; customerId?: string; search?: string; customStart?: string; customEnd?: string } = {}) {
  await connectDB();
  const PAGE_SIZE = 50;
  const page = Math.max(1, opts.page || 1);
  const { start, end } = getDateRange(opts.range || "today", opts.customStart, opts.customEnd);
  
  const filter: Record<string, unknown> = { createdAt: { $gte: start, $lte: end } };
  if (opts.status && opts.status !== "all") filter.status = opts.status;
  if (opts.paymentMethod && opts.paymentMethod !== "all") filter.paymentMethod = opts.paymentMethod;
  if (opts.customerId) filter.customer = opts.customerId;
  if (opts.search) {
    const re = { $regex: opts.search, $options: "i" };
    filter.$or = [{ saleNumber: re }];
  }

  const [sales, totalCount] = await Promise.all([
    Sale.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate("customer", "name phone creditBalance")
      .populate("cashier", "name")
      .lean(),
    Sale.countDocuments(filter),
  ]);

  return sanitizeForClient({
    orders: sales, // mapped for compat
    totalCount, page, totalPages: Math.ceil(totalCount / PAGE_SIZE), pageSize: PAGE_SIZE,
  });
}

export async function getShifts(page = 1, currentOnly = false) {
  await connectDB();
  const PAGE_SIZE = 20;
  const filter = currentOnly ? { isOpen: true } : {};
  const [shifts, totalCount] = await Promise.all([
    Shift.find(filter).populate("cashier", "name").sort({ openedAt: -1 })
      .skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
    Shift.countDocuments(filter),
  ]);
  return sanitizeForClient({
    shifts: shifts.map((s) => ({
      _id: s._id, cashier: s.cashier, openedAt: s.openedAt, closedAt: s.closedAt,
      openingBalance: s.openingBalance, closingBalance: s.closingBalance,
      expectedCash: s.expectedCash, difference: s.difference, isOpen: s.isOpen,
      byMethod: (s as any).byMethod || null, orderCount: (s as any).orderCount || 0,
      refundCount: (s as any).refundCount || 0,
    })),
    totalCount, page, totalPages: Math.ceil(totalCount / PAGE_SIZE), pageSize: PAGE_SIZE,
  });
}

export async function getOpenShift() {
  await connectDB();
  const shift = await Shift.findOne({ isOpen: true }).populate("cashier", "name").lean();
  return sanitizeForClient(shift);
}

export async function getCustomers() {
  await connectDB();
  const customers = await Customer.find().sort({ createdAt: -1 }).limit(2000).lean();
  return sanitizeForClient(customers);
}

export async function getProducts() {
  await connectDB();
  const products = await Product.find().populate("category", "name sortOrder").sort({ name: 1 }).lean();
  return sanitizeForClient(products);
}

export async function getCategories() {
  await connectDB();
  const categories = await Category.find().sort({ sortOrder: 1 }).lean();
  return sanitizeForClient(categories);
}

export async function getSettings() {
  await connectDB();
  let settings = await Settings.findOne().lean();
  if (!settings) settings = (await Settings.create({ rupeesPerPoint: 100 })).toObject();
  return sanitizeForClient(settings);
}

export async function getOrderById(id: string) {
  await connectDB();
  const sale = await Sale.findById(id)
    .populate("customer", "name phone creditBalance")
    .populate("cashier", "name")
    .lean();
  return sanitizeForClient(sale);
}

export async function getUserById(id: string) {
  await connectDB();
  const user = await User.findById(id).select("name role").lean();
  return sanitizeForClient(user);
}
