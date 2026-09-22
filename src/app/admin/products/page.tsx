import ProductManager from "@/components/admin/ProductManager";
export const dynamic = "force-dynamic";
import { getProducts, getCategories } from "@/lib/queries";

export default async function AdminProductsPage() {
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return (
    <div className="h-full w-full">
      <div className="px-6 py-8 w-full">
        <h1 className="text-2xl font-bold text-stone-900 font-brand">Products</h1>
        <p className="text-sm text-stone-500 mt-0.5 mb-6">Menu items, variants, pricing, availability</p>
        <ProductManager initialProducts={products as any} initialCategories={categories as any} />
      </div>
    </div>
  );
}
