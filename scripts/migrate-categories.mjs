// Migration script: converts free-text category strings to Category documents
// Run with: node scripts/migrate-categories.mjs
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/sevesto";

async function main() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const products = db.collection("products");
  const categories = db.collection("categories");

  // Get all distinct category strings from existing products (only string types)
  const distinctCategories = await products.distinct("category", { category: { $type: "string" } });
  console.log("Found distinct category strings:", distinctCategories);

  // Create a Category document for each distinct category
  const categoryMap = new Map(); // old string -> new ObjectId
  let sortOrder = 0;

  for (const catName of distinctCategories) {
    if (!catName) continue;

    // Check if category already exists (idempotent)
    const existing = await categories.findOne({ name: catName });
    if (existing) {
      categoryMap.set(catName, existing._id);
      console.log(`Category "${catName}" already exists, using existing`);
    } else {
      const result = await categories.insertOne({
        name: catName,
        sortOrder: sortOrder++,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      categoryMap.set(catName, result.insertedId);
      console.log(`Created category "${catName}" with sortOrder ${sortOrder - 1}`);
    }
  }

  // Update all products to reference the new Category ObjectId
  let updatedCount = 0;
  let orphanedCount = 0;

  for (const [oldName, categoryId] of categoryMap.entries()) {
    const result = await products.updateMany(
      { category: oldName },
      { $set: { category: categoryId, updatedAt: new Date() } }
    );
    updatedCount += result.modifiedCount;
    console.log(`Updated ${result.modifiedCount} products from category "${oldName}"`);
  }

  // Check for any products with category strings not in our map (orphans)
  const allProducts = await products.find({ category: { $type: "string" } }).toArray();
  if (allProducts.length > 0) {
    console.log("WARNING: Found products with orphaned category strings:");
    for (const p of allProducts) {
      console.log(`  - ${p.name}: "${p.category}"`);
      orphanedCount++;
    }
  } else {
    console.log("SUCCESS: Zero orphaned products after migration.");
  }

  console.log(`\nMigration complete:`);
  console.log(`  Categories created/used: ${categoryMap.size}`);
  console.log(`  Products updated: ${updatedCount}`);
  console.log(`  Orphaned products: ${orphanedCount}`);

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});