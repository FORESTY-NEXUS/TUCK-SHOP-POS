import CategoryManager from "@/components/admin/CategoryManager";
export const dynamic = "force-dynamic";
import { getCategories } from "@/lib/queries";

export default async function AdminCategoriesPage() {
  const categories = await getCategories();
  return (
    <div className="h-full w-full">
      <div className="px-6 py-8 w-full">
        <h1 className="text-2xl font-bold text-stone-900 font-brand">Categories</h1>
        <p className="text-sm text-stone-500 mt-0.5 mb-6">Organize menu sections · drag to reorder</p>
        <CategoryManager initialCategories={categories as any} />
      </div>
    </div>
  );
}
