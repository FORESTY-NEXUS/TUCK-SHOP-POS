import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/Product";
import "@/models/Category"; // ensure populated ref resolves

export const dynamic = "force-dynamic";

const PROJECTION = {
  name: 1,
  barcode: 1,
  sku: 1,
  sellingPrice: 1,
  purchasePrice: 1,
  stock: 1,
  category: 1,
  isActive: 1,
  image: 1,
  variants: 1,
};

// Flatten a matched variant into the same shape the POS expects for a
// plain product, so scanning a variant's barcode behaves identically to
// scanning a flat product's barcode — the cockpit doesn't need to know
// the difference. `variantId` is included so the cart/sale can track
// which specific variant this line item is.
function toVariantResult(product: any, variant: any) {
  return {
    _id: product._id,
    variantId: variant._id,
    name: `${product.name} — ${variant.name}`,
    barcode: variant.barcode,
    sku: variant.sku,
    sellingPrice: variant.sellingPrice,
    purchasePrice: variant.purchasePrice,
    stock: variant.stock,
    category: product.category,
    isActive: variant.isActive,
    image: product.image,
  };
}

/**
 * GET /api/products/search
 *
 * Query params:
 *   barcode  — exact barcode lookup (scanner path)
 *   q        — free-text search (name / sku / barcode / brand)
 *   category — filter by category ObjectId
 *   limit    — max results (default 20, max 50)
 */
export async function GET(req: NextRequest) {
  await connectDB();

  const sp = req.nextUrl.searchParams;
  const barcode = sp.get("barcode")?.trim();
  const q = sp.get("q")?.trim();
  const categoryId = sp.get("category")?.trim();
  const limit = Math.min(Math.max(parseInt(sp.get("limit") || "20", 10), 1), 50);

  // ── Barcode exact match (scanner) ──────────────────────────────────────
  if (barcode) {
    // Try a flat product / top-level barcode first (unchanged path).
    const product = await Product.findOne({ barcode, isActive: true })
      .select(PROJECTION)
      .populate("category", "name")
      .lean();
    if (product) return NextResponse.json([product]);

    // Fall back to a variant barcode (e.g. the beer scanner hitting a
    // specific can/bottle/case barcode under a parent product).
    const parent = await Product.findOne({ "variants.barcode": barcode, isActive: true })
      .select(PROJECTION)
      .populate("category", "name")
      .lean();
    if (parent) {
      const variant = (parent as any).variants?.find((v: any) => v.barcode === barcode && v.isActive);
      if (variant) return NextResponse.json([toVariantResult(parent, variant)]);
    }
    return NextResponse.json([]);
  }

  // ── Text / prefix search ──────────────────────────────────────────────
  const filter: Record<string, unknown> = { isActive: true };
  if (categoryId) filter.category = categoryId;

  if (q) {
    if (q.length >= 3) {
      // Use MongoDB $text index for longer queries (name, barcode, sku, brand)
      filter.$text = { $search: q };
    } else {
      // For short queries, use case-insensitive regex prefix on name
      filter.name = { $regex: q, $options: "i" };
    }
  }

  let query = Product.find(filter)
    .select(PROJECTION)
    .populate("category", "name")
    .limit(limit);

  // When using $text, sort by relevance score
  if (q && q.length >= 3) {
    query = query.sort({ score: { $meta: "textScore" } });
  } else {
    query = query.sort({ name: 1 });
  }

  const products = await query.lean();
  return NextResponse.json(products);
}
