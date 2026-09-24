"use client";

import { useState } from "react";
import { toast } from "sonner";

type Category = { _id: string; name: string; sortOrder: number };

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [newName, setNewName] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function addCategory() {
    if (!newName.trim()) return;
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const cat = await res.json();
      setCategories((prev) => [...prev, cat]);
      setNewName("");
      toast.success("Category added");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Failed to add category");
    }
  }

  async function deleteCategory(id: string) {
    const cat = categories.find((c) => c._id === id);
    if (!cat) return;
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c._id !== id));
      toast.success("Category deleted");
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Delete failed");
    }
  }

  async function persistOrder(ordered: Category[]) {
    // Fire PATCHes for every moved category so the on-screen order survives restart.
    await Promise.all(
      ordered.map((c, i) =>
        fetch(`/api/categories/${c._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: i }),
        }).catch(() => null)
      )
    );
  }

  function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    if (!draggingId || draggingId === targetId) { setDraggingId(null); return; }

    const dragIndex = categories.findIndex((c) => c._id === draggingId);
    const targetIndex = categories.findIndex((c) => c._id === targetId);
    if (dragIndex === -1 || targetIndex === -1) return;

    const next = [...categories];
    const [removed] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, removed);
    const reordered = next.map((c, i) => ({ ...c, sortOrder: i }));

    setCategories(reordered);
    setDraggingId(null);
    persistOrder(reordered);
  }

  return (
    <div>
      <div className="card p-4 mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">Category name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Beverages" className="input" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }} />
          </div>
          <button onClick={addCategory} disabled={!newName.trim()} className="btn-primary">Add Category</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
          <p className="text-xs text-stone-500">Drag items to reorder — order determines display sequence on the POS</p>
        </div>
        <div className="divide-y divide-stone-100">
          {categories.map((cat, index) => (
            <div
              key={cat._id}
              draggable
              onDragStart={(e) => setDraggingId(cat._id)}
              onDragOver={(e) => { e.preventDefault(); if (cat._id !== draggingId) setDragOverId(cat._id); }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDrop(e, cat._id)}
              onDragEnd={() => { setDraggingId(null); setDragOverId(null); }}
              className={`px-4 py-3 flex items-center gap-3 transition-colors cursor-grab hover:bg-stone-50 ${
                draggingId === cat._id ? "bg-brand-50 border-l-4 border-brand-600" : "border-l-4 border-transparent"
              } ${dragOverId === cat._id && cat._id !== draggingId ? "bg-brand-50" : ""}`}
            >
              <svg className="w-4 h-4 text-stone-300 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
              </svg>
              <span className="w-7 h-7 rounded-lg bg-stone-100 text-stone-500 text-xs font-mono font-medium flex items-center justify-center shrink-0">{index + 1}</span>
              <span className="flex-1 font-medium text-stone-900">{cat.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); deleteCategory(cat._id); }}
                className="text-red-400 hover:text-red-600 text-sm font-medium transition-colors px-2 py-1 rounded hover:bg-red-50"
              >Delete</button>
            </div>
          ))}
        </div>
      </div>

      {categories.length === 0 && (
        <div className="text-center py-16 card border-dashed mt-4"><p className="text-stone-400 text-sm">No categories yet. Add one above.</p></div>
      )}
    </div>
  );
}
