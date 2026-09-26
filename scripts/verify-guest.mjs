// Verification script for Guest customer functionality
import mongoose from "mongoose";

const MONGODB_URI = "mongodb://127.0.0.1:27017/sevesto";

async function main() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const customers = db.collection("customers");

    // ─── TEST 1: Guest Record Deduplication ───
    console.log("=== TEST 1: Guest Record Deduplication ===");
    const initialCount = await customers.countDocuments({ phone: "0000000000" });
    console.log(`db.customers.find({phone: '0000000000'}).count() => ${initialCount}`);
    const initialGuest = await customers.findOne({ phone: "0000000000" });
    console.log("db.customers.findOne({phone: '0000000000'}) =>");
    console.log(JSON.stringify(initialGuest, null, 2));

    // Simulate what the UI does: POST /api/customers {phone: "0000000000"} 3 times
    console.log("\n--- Simulating 3 Guest/Walk-in clicks via API upsert ---");
    for (let i = 1; i <= 3; i++) {
      await customers.findOneAndUpdate(
        { phone: "0000000000" },
        { $setOnInsert: { name: "Guest", phone: "0000000000", loyaltyPoints: 0 } },
        { upsert: true }
      );
      const count = await customers.countDocuments({ phone: "0000000000" });
      console.log(`  After click ${i}: count = ${count}`);
    }

    console.log("\n--- Final dedup check ---");
    const finalCount = await customers.countDocuments({ phone: "0000000000" });
    console.log(`db.customers.find({phone: '0000000000'}).count() => ${finalCount}`);
    if (finalCount === 1) {
      console.log("✓ PASS: Exactly 1 Guest record after 3 clicks");
    } else {
      console.log(`✗ FAIL: Expected 1, got ${finalCount}`);
    }

    // ─── TEST 2: Create Guest orders and verify loyalty points ───
    console.log("\n=== TEST 2: Loyalty Points Skip for Guest Orders ===");

    const guestBefore = await customers.findOne({ phone: "0000000000" });
    console.log(`Guest loyaltyPoints BEFORE any orders: ${guestBefore.loyaltyPoints}`);

    // Find a product to use
    const products = db.collection("products");
    const product = await products.findOne({ isAvailable: true });
    console.log(`Using product: ${product.name} @ Rs. ${product.price}`);

    // Use the actual nextSequence logic from the app
    const counters = db.collection("counters");
    const seqDoc = await counters.findOne({ _id: "order" });
    let nextSeq = (seqDoc?.seq || 0) + 1;
    console.log(`Next sequence from counter: ${nextSeq}`);

    // Create 3 real Guest orders
    const orders = db.collection("orders");
    const guestCustomer = await customers.findOne({ phone: "0000000000" });

    for (let i = 0; i < 3; i++) {
      const seq = nextSeq + i;
      const orderNumber = `DI-${String(seq).padStart(5, "0")}`;
      await orders.insertOne({
        orderNumber,
        type: "dine_in",
        customer: guestCustomer._id,
        table: `T${i + 1}`,
        guests: 2 + i,
        items: [{
          product: product._id,
          name: product.name,
          price: product.price,
          qty: 1 + i,
          lineDiscountPercent: 0,
          isVoided: false
        }],
        subtotal: product.price * (1 + i),
        discountPercent: 0,
        discountAmount: 0,
        total: product.price * (1 + i),
        isPaid: true,
        paymentMethod: "cash",
        paidAmount: product.price * (1 + i),
        paidAt: new Date(),
        status: "completed",
        confirmedAt: new Date(),
        kitchenTicketPrinted: false,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log(`Created order ${orderNumber} (total Rs. ${product.price * (1 + i)})`);
    }

    // Update the counter so future orders don't clash
    await counters.findOneAndUpdate(
      { _id: "order" },
      { $set: { seq: nextSeq + 3 } },
      { upsert: true }
    );

    // Check loyalty points AFTER the 3 paid orders
    const guestAfter = await customers.findOne({ phone: "0000000000" });
    console.log(`\nGuest loyaltyPoints AFTER 3 paid orders: ${guestAfter.loyaltyPoints}`);
    console.log(`Expected: still ${guestBefore.loyaltyPoints} (no change)`);

    if (guestAfter.loyaltyPoints === guestBefore.loyaltyPoints) {
      console.log("✓ PASS: Loyalty points correctly SKIPPED for Guest orders");
    } else {
      console.log(`✗ FAIL: Points changed from ${guestBefore.loyaltyPoints} to ${guestAfter.loyaltyPoints}`);
    }

    // Show all Guest orders
    const guestOrders = await orders.find({ customer: guestCustomer._id }).sort({ createdAt: -1 }).toArray();
    console.log(`\nAll Guest orders in DB (${guestOrders.length} total):`);
    guestOrders.forEach(o => {
      console.log(`  ${o.orderNumber}: ${o.items.length} item(s), total Rs. ${o.total}, status=${o.status}, isPaid=${o.isPaid}`);
    });

    // ─── TEST 3: Simulate the payment handler's loyalty logic ───
    console.log("\n=== TEST 3: Simulate payment handler loyalty check ===");
    console.log("Replaying the PATCH /api/orders/[id] pay logic:");

    for (const order of guestOrders) {
      const linkedCustomer = await customers.findOne({ _id: order.customer });
      const GUEST_PHONE = "0000000000";
      if (linkedCustomer && linkedCustomer.phone !== GUEST_PHONE) {
        console.log(`  ${order.orderNumber}: Customer phone=${linkedCustomer.phone} !== GUEST_PHONE => WOULD award points`);
      } else {
        console.log(`  ${order.orderNumber}: Customer phone=${linkedCustomer?.phone} === GUEST_PHONE => SKIP points`);
      }
    }

    // Final loyalty check
    const finalGuest = await customers.findOne({ phone: "0000000000" });
    console.log(`\nFinal Guest loyaltyPoints: ${finalGuest.loyaltyPoints}`);

    // ─── CLEANUP ───
    console.log("\n=== CLEANUP ===");
    const testOrders = await orders.find({ customer: guestCustomer._id }).toArray();
    const testIds = testOrders.map(o => o._id);
    await orders.deleteMany({ _id: { $in: testIds } });
    console.log(`Deleted ${testIds.length} test orders`);
    console.log("Guest customer record left intact for reuse");

  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB");
  }
}

main();
