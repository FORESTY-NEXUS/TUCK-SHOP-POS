// Create test orders for reports verification
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sevesto";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const users = db.collection("users");
  const products = db.collection("products");
  const categories = db.collection("categories");
  const orders = db.collection("orders");
  const counters = db.collection("counters");

  // Get admin user for cashier
  const admin = await users.findOne({ role: "admin" });
  if (!admin) {
    console.error("Admin user not found");
    process.exit(1);
  }

  // Get some products from different categories
  const prodList = await products.find({ isAvailable: true }).toArray();
  if (prodList.length === 0) {
    console.error("No products found");
    process.exit(1);
  }

  // Find specific products for testing
  const italianoChicken = prodList.find(p => p.name === "Italiano Steak (Chicken)");
  const italianoBeef = prodList.find(p => p.name === "Italiano Steak (Beef)");
  const chickenTikkaPizzaSmall = prodList.find(p => p.name === "Chicken Tikka Pizza (Small)");
  const chickenTikkaPizzaMedium = prodList.find(p => p.name === "Chicken Tikka Pizza (Medium)");
  const frenchFries = prodList.find(p => p.name === "French Fries");
  const chickenBurger = prodList.find(p => p.name === "Chicken Tikka Burger");
  const mintMargarita = prodList.find(p => p.name === "Mint Margarita");

  console.log("Test products:");
  console.log("  Italiano Steak (Chicken):", italianoChicken?.price);
  console.log("  Italiano Steak (Beef):", italianoBeef?.price);
  console.log("  Chicken Tikka Pizza (Small):", chickenTikkaPizzaSmall?.price);
  console.log("  Chicken Tikka Pizza (Medium):", chickenTikkaPizzaMedium?.price);
  console.log("  French Fries:", frenchFries?.price);
  console.log("  Chicken Tikka Burger:", chickenBurger?.price);
  console.log("  Mint Margarita:", mintMargarita?.price);

  // Helper to get next order sequence
  async function getNextSeq(type) {
    const prefix = { dine_in: "DI", takeaway: "TA", delivery: "DL" }[type];
    const counter = await counters.findOneAndUpdate(
      { _id: `order_${prefix}` },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" }
    );
    return `${prefix}-${String(counter.seq).padStart(5, "0")}`;
  }

  const now = new Date();
  const testOrders = [];

  // --- Order 1: Dine-in, Cash, 2x Italiano Steak (Chicken) + 1x French Fries ---
  // Total: 2*1349 + 249 = 2947
  const order1 = {
    orderNumber: await getNextSeq("dine_in"),
    type: "dine_in",
    table: "5",
    guests: 2,
    items: [
      { product: italianoChicken._id, name: "Italiano Steak (Chicken)", price: 1349, qty: 2, lineDiscountPercent: 0 },
      { product: frenchFries._id, name: "French Fries", price: 249, qty: 1, lineDiscountPercent: 0 },
    ],
    discountPercent: 0,
    discountAmount: 0,
    subtotal: 2947,
    total: 2947,
    status: "completed",
    isPaid: true,
    paymentMethod: "cash",
    paidAmount: 2947,
    paidAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  testOrders.push(order1);

  // --- Order 2: Takeaway, Card, 1x Italiano Steak (Beef) + 1x Chicken Tikka Pizza (Small) ---
  // Total: 1649 + 849 = 2498
  const order2 = {
    orderNumber: await getNextSeq("takeaway"),
    type: "takeaway",
    items: [
      { product: italianoBeef._id, name: "Italiano Steak (Beef)", price: 1649, qty: 1, lineDiscountPercent: 0 },
      { product: chickenTikkaPizzaSmall._id, name: "Chicken Tikka Pizza (Small)", price: 849, qty: 1, lineDiscountPercent: 0 },
    ],
    discountPercent: 0,
    discountAmount: 0,
    subtotal: 2498,
    total: 2498,
    status: "completed",
    isPaid: true,
    paymentMethod: "card",
    paidAmount: 2498,
    paidAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  testOrders.push(order2);

  // --- Order 3: Delivery, EasyPaisa, 2x Chicken Tikka Pizza (Medium) + 1x Mint Margarita ---
  // Total: 2*1249 + 349 = 2847
  const order3 = {
    orderNumber: await getNextSeq("delivery"),
    type: "delivery",
    items: [
      { product: chickenTikkaPizzaMedium._id, name: "Chicken Tikka Pizza (Medium)", price: 1249, qty: 2, lineDiscountPercent: 0 },
      { product: mintMargarita._id, name: "Mint Margarita", price: 349, qty: 1, lineDiscountPercent: 0 },
    ],
    discountPercent: 0,
    discountAmount: 0,
    subtotal: 2847,
    total: 2847,
    status: "completed",
    isPaid: true,
    paymentMethod: "easypaisa",
    paidAmount: 2847,
    paidAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  testOrders.push(order3);

  // --- Order 4: Dine-in, JazzCash, 1x Chicken Tikka Burger + 1x French Fries ---
  // Total: 349 + 249 = 598
  const order4 = {
    orderNumber: await getNextSeq("dine_in"),
    type: "dine_in",
    table: "3",
    guests: 1,
    items: [
      { product: chickenBurger._id, name: "Chicken Tikka Burger", price: 349, qty: 1, lineDiscountPercent: 0 },
      { product: frenchFries._id, name: "French Fries", price: 249, qty: 1, lineDiscountPercent: 0 },
    ],
    discountPercent: 0,
    discountAmount: 0,
    subtotal: 598,
    total: 598,
    status: "completed",
    isPaid: true,
    paymentMethod: "jazzcash",
    paidAmount: 598,
    paidAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  testOrders.push(order4);

  // --- Order 5: VOIDED ORDER - Dine-in, Cash, 1x Italiano Steak (Beef) ---
  // This should NOT count in revenue
  const order5 = {
    orderNumber: await getNextSeq("dine_in"),
    type: "dine_in",
    table: "7",
    guests: 2,
    items: [
      { product: italianoBeef._id, name: "Italiano Steak (Beef)", price: 1649, qty: 1, lineDiscountPercent: 0, isVoided: true, voidReason: "Customer cancelled" },
    ],
    discountPercent: 0,
    discountAmount: 0,
    subtotal: 1649,
    total: 1649,
    status: "cancelled",
    isPaid: false,
    paymentMethod: "cash",
    paidAmount: 0,
    voidReason: "Customer cancelled before payment",
    createdAt: now,
    updatedAt: now,
  };
  testOrders.push(order5);

  // --- Order 6: Partially voided items - Takeaway, Card ---
  // 1x Chicken Tikka Pizza (Small) + 1x Mint Margarita, but pizza voided
  // Only Margarita should count
  const order6 = {
    orderNumber: await getNextSeq("takeaway"),
    type: "takeaway",
    items: [
      { product: chickenTikkaPizzaSmall._id, name: "Chicken Tikka Pizza (Small)", price: 849, qty: 1, lineDiscountPercent: 0, isVoided: true, voidReason: "Wrong item" },
      { product: mintMargarita._id, name: "Mint Margarita", price: 349, qty: 1, lineDiscountPercent: 0 },
    ],
    discountPercent: 0,
    discountAmount: 0,
    subtotal: 1198,
    total: 349, // Only margarita paid
    status: "completed",
    isPaid: true,
    paymentMethod: "card",
    paidAmount: 349,
    paidAt: now,
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  testOrders.push(order6);

  // Insert all orders
  const result = await orders.insertMany(testOrders);
  console.log(`\nInserted ${result.insertedCount} test orders`);

  // Create a REFUND for Order 1 - partial refund of 1 Italiano Steak (Chicken)
  // Refund amount: 1349
  const refund1 = {
    order: result.insertedIds[0],
    shift: null, // No shift for now
    staff: admin._id,
    amount: 1349,
    refundMethod: "cash",
    isFullRefund: false,
    items: [
      { orderItemIndex: 0, productName: "Italiano Steak (Chicken)", price: 1349, qty: 2, lineDiscountPercent: 0, qtyRefunded: 1, amount: 1349 },
    ],
    customAmount: 0,
    reason: "Customer didn't like one steak",
    createdAt: now,
    updatedAt: now,
  };

  // Create a REFUND for Order 2 - full refund
  const refund2 = {
    order: result.insertedIds[1],
    shift: null,
    staff: admin._id,
    amount: 2498,
    refundMethod: "card",
    isFullRefund: true,
    items: [],
    customAmount: 0,
    reason: "Order cancelled by customer",
    createdAt: now,
    updatedAt: now,
  };

  const refundsColl = db.collection("refunds");
  const refundResult = await refundsColl.insertMany([refund1, refund2]);
  console.log(`Inserted ${refundResult.insertedCount} refunds`);

  // Update Order 1 with refund info
  await orders.updateOne(
    { _id: result.insertedIds[0] },
    { $set: { refundedAmount: 1349, isRefunded: false, status: "partially_refunded" } }
  );

  // Update Order 2 with refund info
  await orders.updateOne(
    { _id: result.insertedIds[1] },
    { $set: { refundedAmount: 2498, isRefunded: true, status: "refunded" } }
  );

  console.log("\n=== TEST DATA SUMMARY ===");
  console.log("Order 1 (DI): Dine-in, Cash, 2x Italiano Chicken (2698) + Fries (249) = 2947, PARTIAL REFUND 1349 (1 steak)");
  console.log("  -> Net: 2947 - 1349 = 1598");
  console.log("Order 2 (TA): Takeaway, Card, 1x Italiano Beef (1649) + Pizza Small (849) = 2498, FULL REFUND 2498");
  console.log("  -> Net: 2498 - 2498 = 0");
  console.log("Order 3 (DL): Delivery, EasyPaisa, 2x Pizza Medium (2498) + Margarita (349) = 2847");
  console.log("  -> Net: 2847");
  console.log("Order 4 (DI): Dine-in, JazzCash, 1x Chicken Burger (349) + Fries (249) = 598");
  console.log("  -> Net: 598");
  console.log("Order 5 (DI): VOIDED ORDER - 1x Italiano Beef (1649) - NOT PAID");
  console.log("  -> Should NOT appear in revenue");
  console.log("Order 6 (TA): Takeaway, Card, 1x Pizza Small (voided) + 1x Margarita (349) = 349 paid");
  console.log("  -> Net: 349 (voided item excluded)");

  console.log("\n=== EXPECTED TOTALS ===");
  console.log("Gross Revenue (paid orders only): 2947 + 2498 + 2847 + 598 + 349 = 9239");
  console.log("Total Refunded: 1349 + 2498 = 3847");
  console.log("Net Revenue: 9239 - 3847 = 5392");
  console.log("");
  console.log("Order Counts: Dine-in: 3 (orders 1,4,5) but 5 is cancelled so 2 paid");
  console.log("  Actually paid: DI=2 (orders 1,4), TA=2 (orders 2,6), DL=1 (order 3)");
  console.log("  Wait - order 2 is refunded but was paid. order 6 is paid.");
  console.log("  Paid orders: 1(DI), 2(TA), 3(DL), 4(DI), 6(TA) = 5 total");
  console.log("  By type: DI=2, TA=2, DL=1");
  console.log("");
  console.log("Payment Methods (Net):");
  console.log("  Cash: Order1 gross 2947 - refund 1349 = 1598");
  console.log("  Card: Order2 gross 2498 - refund 2498 + Order6 gross 349 = 349");
  console.log("  EasyPaisa: Order3 = 2847");
  console.log("  JazzCash: Order4 = 598");
  console.log("  Bank: 0");
  console.log("");
  console.log("Top Items (by qty, excluding voided):");
  console.log("  Chicken Tikka Pizza (Medium): 2");
  console.log("  Italiano Steak (Chicken): 2 (1 refunded, but sold 2)");
  console.log("  French Fries: 2");
  console.log("  Italiano Steak (Beef): 1");
  console.log("  Chicken Tikka Pizza (Small): 1 (1 voided in order 6, 1 in order 2)");
  console.log("  Chicken Tikka Burger: 1");
  console.log("  Mint Margarita: 2");
  console.log("");
  console.log("Category Revenue:");
  console.log("  Steaks: Italiano Chicken 2*1349=2698 (1 refunded) + Italiano Beef 1*1649=1649 (refunded) = 2698+1649-1349-1649 = 1349 net");
  console.log("  Pizza: 2*1249=2498 + 849 + 849(voided)=3348 gross, voided 849 = 2499 net");
  console.log("  Appetizer: French Fries 2*249=498");
  console.log("  Chicken Burgers: 349");
  console.log("  Drinks & Beverages: Margarita 2*349=698");
  console.log("");
  console.log("Voids: 1 order (order 5) + 2 items (order5: 1 beef steak, order6: 1 pizza small)");
  console.log("Refunds: 2 refunds, amount 3847");

  await client.close();
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });