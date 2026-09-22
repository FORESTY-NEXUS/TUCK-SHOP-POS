"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Edit2, Trash2, Package } from "lucide-react";

type Category = { _id: string; name: string; sortOrder: number };
type Product = {
  _id: string;
  name: string;
  barcode?: string;
  sku?: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  minStock: number;
  unit: string;
  category: Category | string;
  isActive?: boolean;
};

export default function ProductManager({
  initialProducts,
  initialCategories,
}: {
  initialProducts: Product[];
  initialCategories: Category[];
}) {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [searchQuery, setSearchQuery] = useState("");

  // Add form
  const [name, setName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [sku, setSku] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [stock, setStock] = useState("");
  const [minStock, setMinStock] = useState("5");
  const [unit, setUnit] = useState("piece");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  // Edit form
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editPurchasePrice, setEditPurchasePrice] = useState("");
  const [editStock, setEditStock] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);

  async function refresh() {
    try {
      const res = await fetch("/api/products?all=1");
      if (res.ok) setProducts(await res.json());
      const cRes = await fetch("/api/categories");
      if (cRes.ok) setCategories(await cRes.json());
    } catch { /* keep current on error */ }
  }

  function catName(cat: Category | string): string {
    return typeof cat === "object" ? cat.name : (categories.find((c) => c._id === cat)?.name || cat);
  }

  function openEdit(p: Product) {
    setEditingProduct(p);
    setEditName(p.name);
    setEditBarcode(p.barcode || "");
    setEditSku(p.sku || "");
    setEditSellingPrice(String(p.sellingPrice));
    setEditPurchasePrice(String(p.purchasePrice || 0));
    setEditStock(String(p.stock || 0));
    setEditMinStock(String(p.minStock ?? 5));
    setEditUnit(p.unit || "piece");
    setEditCategoryId(typeof p.category === "object" ? p.category._id : p.category);
    setEditIsActive(p.isActive !== false);
  }

  async function addProduct() {
    if (!name.trim() || !sellingPrice) return;
    
    let cid = categoryId;
    // Create new category if needed
    if (!cid && newCategoryName.trim()) {
      const catRes = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      if (!catRes.ok) {
        const d = await catRes.json().catch(() => ({}));
        toast.error(d.error || "Could not create category");
        return;
      }
      const cat = await catRes.json();
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat._id);
      setNewCategoryName("");
      cid = cat._id;
    }
    
    if (!cid) {
      toast.error("Please select or create a category");
      return;
    }

    const payload = {
      name: name.trim(),
      barcode: barcode.trim() || undefined,
      sku: sku.trim() || undefined,
      sellingPrice: Number(sellingPrice),
      purchasePrice: Number(purchasePrice) || 0,
      stock: Number(stock) || 0,
      minStock: Number(minStock) || 5,
      unit: unit.trim() || "piece",
      category: cid,
    };

    const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success("Product added");
      setName(""); setBarcode(""); setSku(""); setSellingPrice(""); 
      setPurchasePrice(""); setStock(""); setMinStock("5"); setUnit("piece");
      await refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to add product");
    }
  }

  async function saveEdit() {
    if (!editingProduct || !editName.trim() || !editSellingPrice || !editCategoryId) {
      toast.error("Required fields missing");
      return;
    }
    
    const payload = {
      name: editName.trim(),
      barcode: editBarcode.trim() || undefined, // explicit empty string gets pruned to undefined or empty string depending on api handler (our api handler checks empty string and deletes)
      sku: editSku.trim() || "",
      sellingPrice: Number(editSellingPrice),
      purchasePrice: Number(editPurchasePrice) || 0,
      stock: Number(editStock) || 0,
      minStock: Number(editMinStock) || 5,
      unit: editUnit.trim() || "piece",
      category: editCategoryId,
      isActive: editIsActive,
    };
    
    // Explicitly send an empty string so the backend can unset it if it was cleared
    if (!payload.barcode) payload.barcode = "";

    const res = await fetch(`/api/products/${editingProduct._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success("Product updated");
      setEditingProduct(null);
      await refresh();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to save product");
    }
  }

  async function removeProduct(id: string, name?: string) {
    if (!confirm(`Permanently delete "${name || "this product"}"? Past orders keep their own copies.`)) return;
    const res = await fetch(`/api/products/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Product deleted");
      await refresh();
    } else {
      toast.error("Failed to delete product");
    }
  }

  async function addNewCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      const cat = await res.json();
      setCategories((prev) => [...prev, cat]);
      setCategoryId(cat._id);
      setNewCategoryName("");
      toast.success("Category added");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to create category");
    }
  }

  const groupedAndFiltered = useMemo(() => {
    let filtered = products;
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = products.filter(
        (p) =>
          p.name.toLowerCase().includes(lowerQ) ||
          p.barcode?.toLowerCase().includes(lowerQ) ||
          p.sku?.toLowerCase().includes(lowerQ)
      );
    }

    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const c = catName(p.category);
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(p);
    }
    return map;
  }, [products, categories, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Add product form */}
      <div className="card p-5 bg-white border border-stone-200">
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-brand-600" />
          Add New Product
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-2">
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Product Name <span className="text-red-400">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lays Masala 50g" className="input" onKeyDown={(e) => { if (e.key === "Enter") addProduct(); }} />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Barcode <span className="font-normal text-stone-400">(optional)</span></label>
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type" className="input font-mono text-sm" />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Category <span className="text-red-400">*</span></label>
            <div className="flex gap-2">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input flex-1 min-w-0">
                <option value="">Select...</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <input value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="New..." className="input w-24" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNewCategory(); } }} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Selling Price (Rs.) <span className="text-red-400">*</span></label>
            <input value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="0" type="number" step="0.01" className="input" />
          </div>
          
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Purchase Price (Rs.)</label>
            <input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0" type="number" step="0.01" className="input" />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1.5">Initial Stock</label>
            <div className="flex gap-2">
                <input value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" type="number" className="input w-full" />
                <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="input w-20 text-center" title="Unit (e.g. piece, kg)" />
            </div>
          </div>
          
          <div className="flex items-end">
             <button onClick={addProduct} disabled={!name || !sellingPrice || (!categoryId && !newCategoryName.trim())} className="btn-primary w-full py-2.5">
                Add Product
             </button>
          </div>
        </div>
      </div>

      {/* Product List Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-stone-800">Inventory</h2>
        <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="input pl-9"
            />
        </div>
      </div>

      {/* Products grouped by category */}
      {Array.from(groupedAndFiltered.entries()).map(([cat, items]) => (
        <div key={cat} className="mb-6">
          <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wide mb-3 flex items-center gap-2">
            {cat} <span className="bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full text-xs normal-case">{items.length}</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {items.map((p) => (
              <div key={p._id} className={`bg-white rounded-xl border border-stone-200 p-4 transition-all hover:border-brand-300 hover:shadow-sm ${p.isActive === false ? "opacity-50" : ""}`}>
                <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 pr-3">
                        <h4 className="font-semibold text-stone-900 truncate leading-tight">{p.name}</h4>
                        {p.barcode && <p className="text-xs text-stone-500 font-mono mt-0.5 truncate">{p.barcode}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEdit(p)} className="w-7 h-7 flex items-center justify-center rounded bg-stone-50 text-stone-500 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeProduct(p._id, p.name)} className="w-7 h-7 flex items-center justify-center rounded bg-stone-50 text-stone-500 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
                
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                    <div>
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Selling Price</p>
                        <p className="font-bold text-brand-700 text-sm">Rs. {p.sellingPrice}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">In Stock</p>
                        <p className={`font-semibold text-sm ${p.stock <= p.minStock ? "text-red-500" : "text-stone-700"}`}>
                            {p.stock} <span className="text-xs font-normal text-stone-500">{p.unit}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Purchase</p>
                        <p className="font-medium text-stone-600 text-sm">Rs. {p.purchasePrice || 0}</p>
                    </div>
                </div>
                {p.isActive === false && (
                    <div className="mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">Inactive</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {products.length === 0 && (
        <div className="text-center py-16 card border-dashed border-2 flex flex-col items-center">
           <Package className="w-12 h-12 text-stone-300 mb-3" />
           <h3 className="text-stone-600 font-semibold mb-1">No products found</h3>
           <p className="text-stone-400 text-sm">Add a product above to start building your inventory.</p>
        </div>
      )}

      {products.length > 0 && groupedAndFiltered.size === 0 && (
        <div className="text-center py-16 card border-dashed">
            <p className="text-stone-500 font-medium">No results for "{searchQuery}"</p>
        </div>
      )}

      {/* Edit modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50 rounded-t-2xl">
                <h2 className="font-bold text-stone-900">Edit Product</h2>
                <span className="text-xs font-medium text-stone-500 bg-white px-2 py-1 rounded border border-stone-200">ID: {editingProduct._id.slice(-6)}</span>
            </div>
            
            <div className="px-6 py-5 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Product Name <span className="text-red-400">*</span></label>
                <input value={editName} onChange={(e) => setEditName(e.target.value)} className="input" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Barcode</label>
                    <input value={editBarcode} onChange={(e) => setEditBarcode(e.target.value)} className="input font-mono text-sm" placeholder="Scan or type" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">SKU</label>
                    <input value={editSku} onChange={(e) => setEditSku(e.target.value)} className="input" placeholder="Stock keeping unit" />
                  </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Selling Price (Rs.) <span className="text-red-400">*</span></label>
                    <input value={editSellingPrice} onChange={(e) => setEditSellingPrice(e.target.value)} type="number" step="0.01" className="input" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1">Purchase Price (Rs.)</label>
                    <input value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} type="number" step="0.01" className="input" />
                  </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1">Category <span className="text-red-400">*</span></label>
                <select value={editCategoryId} onChange={(e) => setEditCategoryId(e.target.value)} className="input">
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Current Stock</label>
                  <input value={editStock} onChange={(e) => setEditStock(e.target.value)} type="number" className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Min Stock Warn</label>
                  <input value={editMinStock} onChange={(e) => setEditMinStock(e.target.value)} type="number" className="input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1">Unit</label>
                  <input value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="input text-center" />
                </div>
              </div>
              
              <div className="pt-3 pb-1">
                  <label className="flex items-center gap-3 cursor-pointer w-fit p-3 bg-stone-50 rounded-lg border border-stone-200">
                      <div className={`w-10 h-6 rounded-full transition-colors relative ${editIsActive ? 'bg-brand-500' : 'bg-stone-300'}`}>
                          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${editIsActive ? 'left-5' : 'left-1'}`} />
                      </div>
                      <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} className="sr-only" />
                      <div className="select-none">
                          <p className="text-sm font-semibold text-stone-800">Product is active</p>
                          <p className="text-xs text-stone-500">Uncheck to hide from POS</p>
                      </div>
                  </label>
              </div>
              
            </div>
            
            <div className="px-6 py-4 border-t border-stone-100 flex gap-3 justify-end bg-stone-50/50 rounded-b-2xl shrink-0">
              <button onClick={() => { setEditingProduct(null); }} className="btn-secondary px-6">Cancel</button>
              <button onClick={saveEdit} disabled={!editName || !editSellingPrice || !editCategoryId} className="btn-primary px-6">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
