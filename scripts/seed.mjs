// One-time bootstrap script. Run with: node scripts/seed.mjs
// Creates the first login (admin, PIN 1234) plus the cafe menu (starter fixture).
// Safe to re-run — it skips anything that already exists.
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sevesto";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  // --- 1. Create admin user ---
  const users = db.collection("users");
  const existingAdmin = await users.findOne({ role: "admin" });
  if (!existingAdmin) {
    const pinHash = await bcrypt.hash("1234", 10);
    await users.insertOne({
      name: "Admin",
      pinHash,
      role: "admin",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Created admin user — PIN: 1234 (change this before going live)');
  } else {
    console.log("Admin user already exists, skipping.");
  }

  // --- 2. Ensure Categories exist with correct sortOrder ---
  const categories = db.collection("categories");
  const categoryDefs = [
    { name: "Steaks", sortOrder: 0 },
    { name: "Pasta", sortOrder: 1 },
    { name: "Pakistani", sortOrder: 2 },
    { name: "Drinks & Beverages", sortOrder: 3 },
    { name: "Soup", sortOrder: 4 },
    { name: "Chicken / Beef Rolls", sortOrder: 5 },
    { name: "Chicken Fried", sortOrder: 6 },
    { name: "Appetizer", sortOrder: 7 },
    { name: "Chicken Burgers", sortOrder: 8 },
    { name: "Beef Burgers", sortOrder: 9 },
    { name: "Chinese", sortOrder: 10 },
    { name: "Pizza", sortOrder: 11 },
  ];

  const categoryNameToId = {};
  for (const def of categoryDefs) {
    let cat = await categories.findOne({ name: def.name });
    if (!cat) {
      const result = await categories.insertOne({
        ...def,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      cat = { _id: result.insertedId, ...def };
      console.log(`Created category: ${def.name} (sortOrder: ${def.sortOrder})`);
    } else {
      // Update sortOrder if needed
      if (cat.sortOrder !== def.sortOrder) {
        await categories.updateOne({ _id: cat._id }, { $set: { sortOrder: def.sortOrder } });
        cat.sortOrder = def.sortOrder;
      }
      console.log(`Category exists: ${def.name} (sortOrder: ${cat.sortOrder})`);
    }
    categoryNameToId[def.name] = cat._id;
  }

  // --- 3. Seed Products ---
  const products = db.collection("products");

  // Define all menu items: [name, price, categoryName]
  // For items with variants (Steaks, Pakistani, Soup, Pizza), create one product per variant
  const menuItems = [
    // --- STEAKS (Chicken | Beef) ---
    ["Italiano Steak (Chicken)", 1349, "Steaks"],
    ["Italiano Steak (Beef)", 1649, "Steaks"],
    ["Classic Mushroom Steak (Chicken)", 1349, "Steaks"],
    ["Classic Mushroom Steak (Beef)", 1649, "Steaks"],
    ["Zingara Steak (Chicken)", 1399, "Steaks"],
    ["Zingara Steak (Beef)", 1699, "Steaks"],
    ["Southwest Steak (Chicken)", 1349, "Steaks"],
    ["Southwest Steak (Beef)", 1649, "Steaks"],
    ["Jalapeno Steak (Chicken)", 1349, "Steaks"],
    ["Jalapeno Steak (Beef)", 1649, "Steaks"],
    ["Pepper-Jack Steak (Chicken)", 1399, "Steaks"],
    ["Pepper-Jack Steak (Beef)", 1699, "Steaks"],
    ["Steakhouse Special (Chicken)", 1399, "Steaks"],
    ["Steakhouse Special (Beef)", 1699, "Steaks"],
    ["Mexican Steak (Chicken)", 1349, "Steaks"],
    ["Mexican Steak (Beef)", 1649, "Steaks"],

    // --- PASTA ---
    ["Alfredo Pasta", 749, "Pasta"],
    ["Midtown's Special Pasta", 849, "Pasta"],
    ["Southwest Pasta", 849, "Pasta"],
    ["Beef Lasagna", 849, "Pasta"],
    ["Chicken Lasagna", 799, "Pasta"],

    // --- PAKISTANI (Full | Half) ---
    ["Chicken Brown Handi (Full)", 1299, "Pakistani"],
    ["Chicken Brown Handi (Half)", 749, "Pakistani"],
    ["Chicken White Handi (Full)", 1349, "Pakistani"],
    ["Chicken White Handi (Half)", 799, "Pakistani"],
    ["Midtown's Special Handi (Full)", 1399, "Pakistani"],
    ["Midtown's Special Handi (Half)", 799, "Pakistani"],
    ["Seekh Kabab Karahi (8 Pcs)", 899, "Pakistani"],
    ["Vegetable Salad", 100, "Pakistani"],
    ["Raita", 100, "Pakistani"],
    ["Naan", 35, "Pakistani"],

    // --- DRINKS & BEVERAGES ---
    ["Mint Margarita", 349, "Drinks & Beverages"],
    ["Fresh Lime", 299, "Drinks & Beverages"],
    ["Lemonade", 299, "Drinks & Beverages"],
    ["Pina Colada", 349, "Drinks & Beverages"],
    ["Strawberry Margarita", 349, "Drinks & Beverages"],
    ["Coffee", 250, "Drinks & Beverages"],
    ["Black Tea", 80, "Drinks & Beverages"],
    ["Green Tea", 30, "Drinks & Beverages"],

    // --- SOUP (Regular | Family) ---
    ["Chicken Corn Soup (Regular)", 299, "Soup"],
    ["Chicken Corn Soup (Family)", 799, "Soup"],
    ["Hot & Sour Soup (Regular)", 299, "Soup"],
    ["Hot & Sour Soup (Family)", 799, "Soup"],
    ["Midtown's Premium Soup (Regular)", 299, "Soup"],
    ["Midtown's Premium Soup (Family)", 799, "Soup"],
    ["Chef's Special Soup (Regular)", 349, "Soup"],
    ["Chef's Special Soup (Family)", 949, "Soup"],

    // --- CHICKEN / BEEF ROLLS ---
    ["Chicken Shawarma", 199, "Chicken / Beef Rolls"],
    ["Chicken Cheese Shawarma", 220, "Chicken / Beef Rolls"],
    ["Chicken Achari Shawarma", 220, "Chicken / Beef Rolls"],
    ["Chicken Parata Roll", 349, "Chicken / Beef Rolls"],
    ["Crispy Zinger Roll", 449, "Chicken / Beef Rolls"],
    ["Hunter Beef Roll", 549, "Chicken / Beef Rolls"],
    ["Midtown Wraptor", 599, "Chicken / Beef Rolls"],
    ["Midtown's Special Roll", 599, "Chicken / Beef Rolls"],
    ["Crispy Fish Roll", 549, "Chicken / Beef Rolls"],

    // --- CHICKEN FRIED ---
    ["01 Piece Fried Chicken", 249, "Chicken Fried"],
    ["04 Pieces Fried Chicken", 799, "Chicken Fried"],
    ["08 Pieces Fried Chicken", 1699, "Chicken Fried"],

    // --- APPETIZER ---
    ["French Fries", 249, "Appetizer"],
    ["Hotshots", 599, "Appetizer"],
    ["Loaded Fries", 649, "Appetizer"],
    ["Chicken Wings", 549, "Appetizer"],
    ["Peri-Peri Crispy Wings", 599, "Appetizer"],
    ["Buffalo Wings", 649, "Appetizer"],
    ["Nachos", 649, "Appetizer"],
    ["Calzone Chunks", 699, "Appetizer"],
    ["Chicken Nuggets", 449, "Appetizer"],
    ["Fish Finger", 549, "Appetizer"],
    ["Fish & Chips", 649, "Appetizer"],
    ["Midtown Special Wings", 599, "Appetizer"],

    // --- CHICKEN BURGERS ---
    ["Chicken Tikka Burger", 349, "Chicken Burgers"],
    ["Chicken Patty Burger", 349, "Chicken Burgers"],
    ["Crunch Burger", 449, "Chicken Burgers"],
    ["Zinger Burger", 449, "Chicken Burgers"],
    ["Zinger Tower Burger", 599, "Chicken Burgers"],
    ["Zingerella Burger (Special)", 599, "Chicken Burgers"],
    ["Mighty Zinger Burger", 649, "Chicken Burgers"],
    ["Grilled Cheese Burger", 499, "Chicken Burgers"],
    ["Mushroom Swiss Burger", 549, "Chicken Burgers"],
    ["Peri-Peri Grilled Burger", 549, "Chicken Burgers"],
    ["Classic Fish Burger", 549, "Chicken Burgers"],
    ["Jalapeno Chicken Burger", 549, "Chicken Burgers"],
    ["Royal Stuffed Burger", 649, "Chicken Burgers"],
    ["Midtown Premium Burger", 649, "Chicken Burgers"],

    // --- BEEF BURGERS ---
    ["Spanish Bull", 649, "Beef Burgers"],
    ["Classic American", 649, "Beef Burgers"],
    ["The Steakhouse", 749, "Beef Burgers"],
    ["Texas Beef", 649, "Beef Burgers"],
    ["Haunted-Berlin", 649, "Beef Burgers"],
    ["Midtown's Titan", 749, "Beef Burgers"],
    ["Frankenstein", 749, "Beef Burgers"],
    ["Mushroom Meltdown", 649, "Beef Burgers"],

    // --- CHINESE ---
    ["Chicken Fried Rice", 549, "Chinese"],
    ["Chicken Fried Rice (Special)", 599, "Chinese"],
    ["Vegetable Rice", 299, "Chinese"],
    ["Egg Fried Rice", 349, "Chinese"],
    ["Chicken Chowmein", 499, "Chinese"],
    ["Beef Chowmein", 549, "Chinese"],
    ["Chicken Manchurian (with rice)", 699, "Chinese"],
    ["Chicken Shashlik (with rice)", 699, "Chinese"],
    ["Chicken Chilli Dry (with rice)", 699, "Chinese"],
    ["Beef Chilli Dry (with rice)", 699, "Chinese"],
    ["Fish Chilli Dry (with rice)", 699, "Chinese"],

    // --- PIZZA (Small | Medium | Large | Family) ---
    // Chicken Tikka
    ["Chicken Tikka Pizza (Small)", 849, "Pizza"],
    ["Chicken Tikka Pizza (Medium)", 1249, "Pizza"],
    ["Chicken Tikka Pizza (Large)", 1599, "Pizza"],
    ["Chicken Tikka Pizza (Family)", 2099, "Pizza"],
    // Chicken Fajita
    ["Chicken Fajita Pizza (Small)", 849, "Pizza"],
    ["Chicken Fajita Pizza (Medium)", 1249, "Pizza"],
    ["Chicken Fajita Pizza (Large)", 1599, "Pizza"],
    ["Chicken Fajita Pizza (Family)", 2099, "Pizza"],
    // Pepperoni-Cheese
    ["Pepperoni-Cheese Pizza (Small)", 849, "Pizza"],
    ["Pepperoni-Cheese Pizza (Medium)", 1249, "Pizza"],
    ["Pepperoni-Cheese Pizza (Large)", 1599, "Pizza"],
    ["Pepperoni-Cheese Pizza (Family)", 2099, "Pizza"],
    // Midtown's Premium
    ["Midtown's Premium Pizza (Small)", 899, "Pizza"],
    ["Midtown's Premium Pizza (Medium)", 1349, "Pizza"],
    ["Midtown's Premium Pizza (Large)", 1749, "Pizza"],
    ["Midtown's Premium Pizza (Family)", 2249, "Pizza"],
    // Grilled Chicken
    ["Grilled Chicken Pizza (Small)", 849, "Pizza"],
    ["Grilled Chicken Pizza (Medium)", 1249, "Pizza"],
    ["Grilled Chicken Pizza (Large)", 1599, "Pizza"],
    ["Grilled Chicken Pizza (Family)", 2099, "Pizza"],
    // Calzone Stuffed
    ["Calzone Stuffed Pizza (Small)", 849, "Pizza"],
    ["Calzone Stuffed Pizza (Medium)", 1249, "Pizza"],
    ["Calzone Stuffed Pizza (Large)", 1599, "Pizza"],
    ["Calzone Stuffed Pizza (Family)", 2099, "Pizza"],
    // Midtown's Delight
    ["Midtown's Delight Pizza (Small)", 899, "Pizza"],
    ["Midtown's Delight Pizza (Medium)", 1299, "Pizza"],
    ["Midtown's Delight Pizza (Large)", 1699, "Pizza"],
    ["Midtown's Delight Pizza (Family)", 2199, "Pizza"],
    // Crown Crust
    ["Crown Crust Pizza (Small)", 899, "Pizza"],
    ["Crown Crust Pizza (Medium)", 1349, "Pizza"],
    ["Crown Crust Pizza (Large)", 1749, "Pizza"],
    ["Crown Crust Pizza (Family)", 2249, "Pizza"],
    // Midtown's Speciality
    ["Midtown's Speciality Pizza (Small)", 899, "Pizza"],
    ["Midtown's Speciality Pizza (Medium)", 1299, "Pizza"],
    ["Midtown's Speciality Pizza (Large)", 1699, "Pizza"],
    ["Midtown's Speciality Pizza (Family)", 2199, "Pizza"],
    // Double Crust (Special)
    ["Double Crust Pizza (Small)", 899, "Pizza"],
    ["Double Crust Pizza (Medium)", 1299, "Pizza"],
    ["Double Crust Pizza (Large)", 1699, "Pizza"],
    ["Double Crust Pizza (Family)", 2199, "Pizza"],
    // Bon-Fire (for Spice Lovers)
    ["Bon-Fire Pizza (Small)", 849, "Pizza"],
    ["Bon-Fire Pizza (Medium)", 1249, "Pizza"],
    ["Bon-Fire Pizza (Large)", 1599, "Pizza"],
    ["Bon-Fire Pizza (Family)", 2099, "Pizza"],
  ];

  // Check if products already exist
  const existingCount = await products.countDocuments();
  if (existingCount > 0) {
    console.log(`Products already exist (${existingCount}), skipping menu seed.`);
    console.log("If you want to re-seed, clear the products collection first.");
  } else {
    // Build product documents
    const productDocs = menuItems.map(([name, price, categoryName]) => {
      const categoryId = categoryNameToId[categoryName];
      if (!categoryId) {
        console.error(`ERROR: Category "${categoryName}" not found for product "${name}"`);
        return null;
      }
      return {
        name,
        price,
        category: categoryId,
        isAvailable: true,
        cost: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }).filter(Boolean);

    if (productDocs.length > 0) {
      await products.insertMany(productDocs);
      console.log(`Seeded ${productDocs.length} menu items.`);
    }
  }

  // --- Summary ---
  const totalProducts = await products.countDocuments();
  const totalCategories = await categories.countDocuments({ isActive: true });
  console.log(`\n=== Seed Complete ===`);
  console.log(`Categories: ${totalCategories}`);
  console.log(`Products: ${totalProducts}`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});