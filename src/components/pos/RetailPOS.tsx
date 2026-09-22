"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  X,
  CreditCard,
  Banknote,
  PackageOpen,
  Loader2,
  Package,
  Tag,
  Zap,
  AlertTriangle,

  Check,
  User,
  Phone,
  Printer,
} from "lucide-react";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════════════════════════════════════ */

type CategoryInfo = { _id: string; name: string };

type ProductResult = {
  _id: string;
  name: string;
  barcode?: string;
  sku?: string;
  sellingPrice: number;
  purchasePrice: number;
  stock: number;
  category?: CategoryInfo;
};

type CartItem = {
  productId: string;
  name: string;
  barcode?: string;
  sellingPrice: number;
  purchasePrice: number;
  quantity: number;
  maxStock: number;
};

type CustomerResult = {
  _id: string;
  name?: string;
  phone: string;
  creditBalance?: number;
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function RetailPOS() {
  // ── Cart state ─────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Search state ───────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Categories ────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");

  // ── Quick products ─────────────────────────────────────────────────────
  const [quickProducts, setQuickProducts] = useState<ProductResult[]>([]);

  // ── Add Product modal ──────────────────────────────────────────────────
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [addProductBarcode, setAddProductBarcode] = useState("");
  const [addProductName, setAddProductName] = useState("");
  const [addProductSellingPrice, setAddProductSellingPrice] = useState("");
  const [addProductPurchasePrice, setAddProductPurchasePrice] = useState("");
  const [addProductCategory, setAddProductCategory] = useState("");
  const [newAddCategoryName, setNewAddCategoryName] = useState("");
  const [addProductStock, setAddProductStock] = useState("1");
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // ── Shift state ────────────────────────────────────────────────────────
  const [activeShift, setActiveShift] = useState<any>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [isStartingShift, setIsStartingShift] = useState(false);
  const [startingShiftAmount, setStartingShiftAmount] = useState("");

  // ── Checkout state ─────────────────────────────────────────────────────
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // ── Credit / Udhaar ─────────────────────────────────────────────────
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [creditAmountReceived, setCreditAmountReceived] = useState("");
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  // ── Success splash ─────────────────────────────────────────────────────
  const [lastSale, setLastSale] = useState<{
    saleNumber: string;
    total: number;
    change: number;
    paymentMethod: string;
    items: { name: string; quantity: number; sellingPrice: number }[];
  } | null>(null);

  // ── Auto-focus input ───────────────────────────────────────────────────
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Load categories & quick products on mount ──────────────────────────
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategories(data);
      })
      .catch(() => { });

    // Load first batch of products for quick-add
    fetch("/api/products/search?limit=8")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setQuickProducts(data);
      })
      .catch(() => { });

    // Load active shift
    fetch("/api/shifts?current=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.shifts && data.shifts.length > 0) setActiveShift(data.shifts[0]);
        else setActiveShift(null);
      })
      .catch(() => { })
      .finally(() => setIsLoadingShift(false));
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────
  const performSearch = useCallback(
    async (query: string, categoryFilter?: string) => {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (categoryFilter && categoryFilter !== "all")
          params.set("category", categoryFilter);
        params.set("limit", "20");

        const res = await fetch(`/api/products/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        }
      } catch {
        toast.error("Search failed");
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  // Watch search input for debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!searchInput.trim() && activeCategory === "all") {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      performSearch(searchInput.trim(), activeCategory);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, activeCategory, performSearch]);

  // ── Barcode scan (Enter key) ──────────────────────────────────────────
  const handleInputKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter" && searchInput.trim()) {
      e.preventDefault();
      const input = searchInput.trim();

      // Treat as barcode scan: exact barcode lookup
      setIsSearching(true);
      try {
        const res = await fetch(
          `/api/products/search?barcode=${encodeURIComponent(input)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            // Barcode found → add to cart
            addToCart(data[0]);
            setSearchInput("");
            setSearchResults([]);
            setHasSearched(false);
            inputRef.current?.focus();
            return;
          }
        }
      } catch { }
      setIsSearching(false);

      // Barcode not found — check search results
      // If we have exactly one search result and user hit Enter, add it
      if (searchResults.length === 1) {
        addToCart(searchResults[0]);
        setSearchInput("");
        setSearchResults([]);
        setHasSearched(false);
        inputRef.current?.focus();
        return;
      }

      // If nothing found at all, offer to create
      if (searchResults.length === 0) {
        toast("Product not found", {
          description: "Would you like to add it?",
          action: {
            label: "Add Product",
            onClick: () => {
              // If input looks like a barcode (numbers only), pre-fill it
              const isBarcode = /^\d{4,}$/.test(input);
              openAddProductModal(isBarcode ? input : "", isBarcode ? "" : input);
            },
          },
        });
      }
    }
  };

  // ── Category tab click ────────────────────────────────────────────────
  const handleCategoryClick = (catId: string) => {
    setActiveCategory(catId);
    inputRef.current?.focus();
  };

  // ── Add to cart ────────────────────────────────────────────────────────
  const addToCart = (product: ProductResult) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product._id);
      if (existing) {
        // Check stock before incrementing
        if (existing.quantity >= product.stock) {
          toast.error(`Only ${product.stock} units available for "${product.name}"`);
          return prev;
        }
        return prev.map((item) =>
          item.productId === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      // New item — check stock
      if (product.stock <= 0) {
        toast.error(`"${product.name}" is out of stock`);
        return prev;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          barcode: product.barcode,
          sellingPrice: product.sellingPrice,
          purchasePrice: product.purchasePrice,
          quantity: 1,
          maxStock: product.stock,
        },
      ];
    });

    toast.success(`${product.name} added`, { duration: 1500 });
    inputRef.current?.focus();
  };

  // ── Cart item controls ─────────────────────────────────────────────────
  const incrementItem = (productId: string) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId === productId) {
          if (item.quantity >= item.maxStock) {
            toast.error(`Only ${item.maxStock} units available`);
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      })
    );
  };

  const decrementItem = (productId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeItem = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  };

  const clearCart = () => setCart([]);

  // ── Totals ─────────────────────────────────────────────────────────────
  const subtotal = cart.reduce(
    (sum, item) => sum + item.sellingPrice * item.quantity,
    0
  );
  const total = subtotal;
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  // ── Cash sale checkout ─────────────────────────────────────────────────
  const handleCashSale = async () => {
    if (cart.length === 0) return;
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod: "cash",
          amountReceived: total,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Sale failed");
        return;
      }

      setLastSale({
        saleNumber: data.saleNumber,
        total: data.total,
        change: data.change,
        paymentMethod: "cash",
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, sellingPrice: c.sellingPrice })),
      });
      setCart([]);
      toast.success(`Sale ${data.saleNumber} completed!`);
      // Refresh quick products (stock may have changed)
      fetch("/api/products/search?limit=8")
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setQuickProducts(d))
        .catch(() => { });
    } catch {
      toast.error("Cannot reach the server");
    } finally {
      setIsCheckingOut(false);
      inputRef.current?.focus();
    }
  };

  // ── Credit sale flow ───────────────────────────────────────────────────
  const openCreditModal = () => {
    if (cart.length === 0) return;
    setShowCreditModal(true);
    setSelectedCustomer(null);
    setCustomerSearch("");
    setCustomerResults([]);
    setCreditAmountReceived("");
    setShowNewCustomer(false);
    setNewCustName("");
    setNewCustPhone("");
  };

  const searchCustomers = async (query: string) => {
    if (!query.trim()) {
      setCustomerResults([]);
      return;
    }
    setIsSearchingCustomer(true);
    try {
      const res = await fetch(
        `/api/customers?query=${encodeURIComponent(query.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        setCustomerResults(Array.isArray(data) ? data : []);
      }
    } catch { }
    setIsSearchingCustomer(false);
  };

  const createCustomerAndSelect = async () => {
    if (!newCustPhone.trim()) {
      toast.error("Phone number is required");
      return;
    }
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustName.trim(),
          phone: newCustPhone.trim(),
        }),
      });
      if (res.ok) {
        const cust = await res.json();
        setSelectedCustomer(cust);
        setShowNewCustomer(false);
        toast.success("Customer created");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to create customer");
      }
    } catch {
      toast.error("Cannot reach the server");
    }
  };

  const handleCreditSale = async () => {
    if (!selectedCustomer || cart.length === 0) return;
    if (isCheckingOut) return;
    setIsCheckingOut(true);

    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          paymentMethod: "credit",
          amountReceived: Number(creditAmountReceived) || 0,
          customer: selectedCustomer._id,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Sale failed");
        return;
      }

      setLastSale({
        saleNumber: data.saleNumber,
        total: data.total,
        change: 0,
        paymentMethod: "credit",
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, sellingPrice: c.sellingPrice })),
      });
      setCart([]);
      setShowCreditModal(false);
      toast.success(`Credit sale ${data.saleNumber} completed!`);
    } catch {
      toast.error("Cannot reach the server");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleStartShift = async () => {
    setIsStartingShift(true);
    try {
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingBalance: Number(startingShiftAmount) || 0 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to start shift");
        return;
      }
      setActiveShift(data);
      toast.success("Shift started");
    } catch {
      toast.error("Cannot reach server");
    } finally {
      setIsStartingShift(false);
    }
  };

  // ── Add Product modal logic ────────────────────────────────────────────
  const openAddProductModal = (barcode?: string, name?: string) => {
    setShowAddProduct(true);
    setAddProductBarcode(barcode || "");
    setAddProductName(name || "");
    setAddProductSellingPrice("");
    setAddProductPurchasePrice("");
    setAddProductCategory("");
    setNewAddCategoryName("");
    setAddProductStock("1");
  };

  const handleAddProduct = async () => {
    if (!addProductName.trim() || !addProductSellingPrice || (!addProductCategory && !newAddCategoryName.trim())) {
      toast.error("Name, selling price, and category are required");
      return;
    }
    setIsAddingProduct(true);
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addProductName.trim(),
          barcode: addProductBarcode.trim() || undefined,
          sellingPrice: Number(addProductSellingPrice),
          purchasePrice: Number(addProductPurchasePrice) || 0,
          category: addProductCategory || newAddCategoryName.trim(),
          stock: Number(addProductStock) || 1,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to add product");
        return;
      }

      // Auto-add to cart
      const newProduct: ProductResult = {
        _id: data._id,
        name: data.name,
        barcode: data.barcode,
        sellingPrice: data.sellingPrice,
        purchasePrice: data.purchasePrice || 0,
        stock: data.stock || 1,
        category: data.category,
      };
      addToCart(newProduct);
      setShowAddProduct(false);
      toast.success(`"${data.name}" created & added to cart`);

      // Refresh quick products
      fetch("/api/products/search?limit=8")
        .then((r) => r.json())
        .then((d) => Array.isArray(d) && setQuickProducts(d))
        .catch(() => { });
    } catch {
      toast.error("Cannot reach the server");
    } finally {
      setIsAddingProduct(false);
    }
  };

  // ── Dismiss sale splash ────────────────────────────────────────────────
  const dismissSale = () => {
    setLastSale(null);
    inputRef.current?.focus();
  };

  /* ═════════════════════════════════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex h-full overflow-hidden bg-stone-100 relative">
      {/* ─── START SHIFT OVERLAY ─────────────────────────────────────── */}
      {!isLoadingShift && !activeShift && (
        <div className="absolute inset-0 z-[60] bg-stone-100/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-stone-200">
            <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Banknote className="w-8 h-8 text-brand-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Start a New Shift</h2>
            <p className="text-sm text-stone-500 mb-6">Enter the opening cash balance in the drawer to begin processing sales.</p>
            <div className="text-left mb-6">
              <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                Opening Balance (Rs.)
              </label>
              <input
                autoFocus
                type="number"
                min="0"
                step="1"
                value={startingShiftAmount}
                onChange={(e) => setStartingShiftAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleStartShift(); }}
                className="w-full text-xl py-3 px-4 rounded-xl border-2 border-stone-200 focus:outline-none focus:ring-4 focus:ring-brand-500/20 shadow-sm transition-all text-center font-bold font-mono"
                placeholder="0"
              />
            </div>
            <button
              onClick={handleStartShift}
              disabled={isStartingShift}
              className="btn-primary w-full py-3 text-lg flex items-center justify-center gap-2"
            >
              {isStartingShift && <Loader2 className="w-5 h-5 animate-spin" />}
              {isStartingShift ? "Starting..." : "Start Shift"}
            </button>
          </div>
        </div>
      )}

      {/* ─── LEFT PANEL: Search + Products ─────────────────────────────── */}
      <div className="flex-1 flex flex-col border-r border-stone-200 bg-white min-w-0">
        {/* Search bar */}
        <div className="p-4 border-b border-stone-200">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
            <input
              id="pos-search-input"
              autoFocus
              ref={inputRef}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="w-full pl-11 pr-24 py-3.5 rounded-xl border-2 border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/20 text-lg shadow-sm transition-all bg-white"
              placeholder="Scan barcode or search product..."
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {isSearching && (
                <Loader2 className="w-4 h-4 text-brand-500 animate-spin" />
              )}
              <span className="text-[10px] font-semibold text-stone-400 bg-stone-100 px-2 py-1 rounded">
                ENTER ↵
              </span>
            </div>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 px-4 py-2.5 border-b border-stone-100 overflow-x-auto flex-shrink-0">
          <button
            onClick={() => handleCategoryClick("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === "all"
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              onClick={() => handleCategoryClick(cat._id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${activeCategory === cat._id
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Search results */}
          {hasSearched && searchResults.length > 0 && (
            <div className="space-y-1.5 mb-6">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                {searchResults.length} Result{searchResults.length !== 1 ? "s" : ""}
              </p>
              {searchResults.map((product) => (
                <button
                  key={product._id}
                  onClick={() => {
                    addToCart(product);
                    setSearchInput("");
                    setSearchResults([]);
                    setHasSearched(false);
                  }}
                  className="w-full text-left p-3 rounded-lg border border-stone-200 hover:border-brand-300 hover:bg-brand-50/50 transition-all flex items-center gap-3 group"
                >
                  <div className="w-10 h-10 rounded-lg bg-stone-100 group-hover:bg-brand-100 flex items-center justify-center shrink-0 transition-colors">
                    <Package className="w-5 h-5 text-stone-400 group-hover:text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-stone-900 truncate text-sm">
                      {product.name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-brand-700 font-bold text-sm tabular">
                        Rs. {product.sellingPrice.toFixed(0)}
                      </span>
                      <span className="text-stone-400 text-xs">•</span>
                      <span
                        className={`text-xs font-medium ${product.stock <= 0
                          ? "text-red-500"
                          : product.stock <= 5
                            ? "text-amber-600"
                            : "text-stone-500"
                          }`}
                      >
                        Stock: {product.stock}
                      </span>
                      {product.barcode && (
                        <>
                          <span className="text-stone-400 text-xs">•</span>
                          <span className="text-stone-400 text-xs font-mono">
                            {product.barcode}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <Plus className="w-5 h-5 text-stone-300 group-hover:text-brand-600 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* No results message */}
          {hasSearched && searchResults.length === 0 && !isSearching && (
            <div className="text-center py-12">
              <PackageOpen className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="text-stone-500 font-medium text-sm">No products found</p>
              <p className="text-stone-400 text-xs mt-1">
                Try a different search term or add a new product
              </p>
              <button
                onClick={() =>
                  openAddProductModal(
                    /^\d{4,}$/.test(searchInput) ? searchInput : "",
                    /^\d{4,}$/.test(searchInput) ? "" : searchInput
                  )
                }
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>
          )}

          {/* Default state — Quick Products */}
          {!hasSearched && (
            <div>
              {/* Quick-add bar */}
              {quickProducts.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">

                    <p className="text-xs font-semibold text-stone-600 uppercase tracking-wide">
                      Quick Add
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {quickProducts.map((product) => (
                      <button
                        key={product._id}
                        onClick={() => addToCart(product)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-200 bg-white hover:border-brand-300 hover:bg-brand-50 transition-all text-sm group"
                      >
                        <span className="font-medium text-stone-700 group-hover:text-brand-700">
                          {product.name}
                        </span>
                        <span className="text-xs text-stone-400 tabular">
                          Rs.{product.sellingPrice.toFixed(0)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ready state */}
              <div className="flex flex-col items-center justify-center py-12 text-stone-500">
                <div className="w-16 h-16 rounded-2xl bg-stone-100 flex items-center justify-center mb-4">
                  <Search className="w-7 h-7 text-stone-300" />
                </div>
                <h2 className="text-lg font-semibold text-stone-700">
                  Ready to Scan
                </h2>
                <p className="text-sm mt-1 text-stone-400 text-center max-w-xs">
                  Scan a barcode, search by name, or browse categories to add
                  products to the cart.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* + Add Product button (always visible at bottom of left panel) */}
        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50/50">
          <button
            onClick={() => openAddProductModal()}
            className="flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {/* ─── RIGHT PANEL: Cart & Checkout ──────────────────────────────── */}
      <div className="w-[400px] bg-stone-50 flex flex-col shrink-0">
        {/* Cart header */}
        <div className="p-4 border-b border-stone-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-stone-800">
            <ShoppingCart className="w-5 h-5" />
            <span>Current Sale</span>
          </div>
          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors"
              >
                Clear
              </button>
            )}
            <span className="bg-stone-100 text-stone-600 px-2 py-1 rounded-md text-xs font-medium tabular">
              {totalItems} Items
            </span>
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 text-sm gap-2">
              <ShoppingCart className="w-10 h-10 text-stone-200" />
              <span>Cart is empty</span>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="bg-white p-3 rounded-lg border border-stone-200 shadow-sm flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-stone-800 leading-tight text-sm truncate">
                      {item.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-brand-600 font-semibold text-sm tabular">
                        Rs. {item.sellingPrice.toFixed(0)}
                      </span>
                      <span className="text-stone-400 text-xs">×</span>
                      <span className="text-stone-600 text-xs font-medium">
                        {item.quantity}
                      </span>
                      <span className="text-stone-400 text-xs">=</span>
                      <span className="text-stone-800 text-xs font-bold tabular">
                        Rs. {(item.sellingPrice * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-md">
                    <button
                      onClick={() => decrementItem(item.productId)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-stone-600 hover:text-brand-600 active:scale-95 transition-all"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-semibold text-sm text-stone-800 tabular">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => incrementItem(item.productId)}
                      className="w-7 h-7 flex items-center justify-center bg-white rounded shadow-sm text-stone-600 hover:text-brand-600 active:scale-95 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="w-8 h-8 flex items-center justify-center text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Checkout area */}
        <div className="p-4 bg-white border-t border-stone-200 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <div className="flex justify-between items-end mb-4">
            <span className="text-stone-500 font-medium">Total</span>
            <span className="text-3xl font-brand font-bold text-stone-900 tracking-tight tabular">
              Rs. {total.toFixed(0)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={openCreditModal}
              disabled={cart.length === 0 || isCheckingOut}
              className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-white bg-amber-500 hover:bg-amber-600 active:bg-amber-700 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-sm">Credit / Udhaar</span>
            </button>
            <button
              onClick={handleCashSale}
              disabled={cart.length === 0 || isCheckingOut}
              className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isCheckingOut ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Banknote className="w-5 h-5" />
              )}
              <span className="text-sm">
                {isCheckingOut ? "Processing..." : "Cash Sale"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── ADD PRODUCT MODAL ─────────────────────────────────────────── */}
      {showAddProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-bold text-stone-900 text-lg">Add Product</h2>
              <button
                onClick={() => setShowAddProduct(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                  Product Name <span className="text-red-400">*</span>
                </label>
                <input
                  autoFocus
                  value={addProductName}
                  onChange={(e) => setAddProductName(e.target.value)}
                  placeholder="e.g. Samosa"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                  Barcode <span className="text-stone-400 normal-case font-normal">(optional)</span>
                </label>
                <input
                  value={addProductBarcode}
                  onChange={(e) => setAddProductBarcode(e.target.value)}
                  placeholder="Scan or type barcode"
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Selling Price <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={addProductSellingPrice}
                    onChange={(e) => setAddProductSellingPrice(e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Rs. 0"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Purchase Price
                  </label>
                  <input
                    value={addProductPurchasePrice}
                    onChange={(e) => setAddProductPurchasePrice(e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Rs. 0"
                    className="input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={addProductCategory}
                      onChange={(e) => setAddProductCategory(e.target.value)}
                      className="input flex-1 min-w-0"
                    >
                      <option value="">Select...</option>
                      {categories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newAddCategoryName}
                      onChange={(e) => setNewAddCategoryName(e.target.value)}
                      placeholder="New..."
                      className="input w-20"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Initial Stock
                  </label>
                  <input
                    value={addProductStock}
                    onChange={(e) => setAddProductStock(e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="1"
                    className="input"
                  />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-200 flex gap-3 justify-end bg-stone-50">
              <button
                onClick={() => setShowAddProduct(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddProduct}
                disabled={
                  isAddingProduct ||
                  !addProductName.trim() ||
                  !addProductSellingPrice ||
                  (!addProductCategory && !newAddCategoryName.trim())
                }
                className="btn-primary flex items-center gap-2"
              >
                {isAddingProduct && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isAddingProduct ? "Adding..." : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CREDIT / UDHAAR MODAL ─────────────────────────────────────── */}
      {showCreditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-stone-900 text-lg">
                Credit / Udhaar Sale
              </h2>
              <button
                onClick={() => setShowCreditModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {/* Sale total display */}
              <div className="bg-stone-50 rounded-xl p-4 text-center">
                <p className="text-xs text-stone-500 uppercase tracking-wide font-semibold mb-1">
                  Sale Total
                </p>
                <p className="text-2xl font-brand font-bold text-stone-900 tabular">
                  Rs. {total.toFixed(0)}
                </p>
              </div>

              {/* Customer selection */}
              {!selectedCustomer ? (
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Select Customer <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                    <input
                      autoFocus
                      value={customerSearch}
                      onChange={(e) => {
                        setCustomerSearch(e.target.value);
                        searchCustomers(e.target.value);
                      }}
                      placeholder="Search by name or phone..."
                      className="input pl-9"
                    />
                    {isSearchingCustomer && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 animate-spin" />
                    )}
                  </div>

                  {/* Customer results */}
                  {customerResults.length > 0 && (
                    <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden">
                      {customerResults.map((cust) => (
                        <button
                          key={cust._id}
                          onClick={() => setSelectedCustomer(cust)}
                          className="w-full text-left px-3 py-2.5 hover:bg-brand-50 transition-colors flex items-center gap-3 border-b border-stone-100 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-stone-200 flex items-center justify-center text-xs font-bold text-stone-600">
                            {(cust.name || cust.phone)
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-900 truncate">
                              {cust.name || "Unnamed"}
                            </p>
                            <p className="text-xs text-stone-500">
                              {cust.phone}
                              {(cust.creditBalance ?? 0) > 0 && (
                                <span className="ml-2 text-amber-600 font-medium">
                                  Owes Rs.{" "}
                                  {(cust.creditBalance ?? 0).toFixed(0)}
                                </span>
                              )}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {customerSearch.trim() &&
                    customerResults.length === 0 &&
                    !isSearchingCustomer && (
                      <p className="text-xs text-stone-400 mt-2">
                        No customers found.
                      </p>
                    )}

                  {/* New customer toggle */}
                  <button
                    onClick={() => setShowNewCustomer(!showNewCustomer)}
                    className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Customer</span>
                  </button>

                  {showNewCustomer && (
                    <div className="mt-3 p-3 bg-stone-50 rounded-lg space-y-2.5">
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">
                          Name
                        </label>
                        <input
                          value={newCustName}
                          onChange={(e) => setNewCustName(e.target.value)}
                          placeholder="Customer name"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-stone-500 mb-1">
                          Phone <span className="text-red-400">*</span>
                        </label>
                        <input
                          value={newCustPhone}
                          onChange={(e) => setNewCustPhone(e.target.value)}
                          placeholder="03XX-XXXXXXX"
                          className="input"
                        />
                      </div>
                      <button
                        onClick={createCustomerAndSelect}
                        disabled={!newCustPhone.trim()}
                        className="btn-primary w-full text-sm"
                      >
                        Create & Select
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Customer
                  </label>
                  <div className="flex items-center gap-3 p-3 bg-brand-50 border border-brand-200 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-sm font-bold text-brand-700">
                      {(selectedCustomer.name || selectedCustomer.phone)
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {selectedCustomer.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-stone-500">
                        {selectedCustomer.phone}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="text-xs text-stone-400 hover:text-red-500 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* Partial payment */}
              {selectedCustomer && (
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wide">
                    Amount Received{" "}
                    <span className="text-stone-400 normal-case font-normal">
                      (optional — leave 0 for full credit)
                    </span>
                  </label>
                  <input
                    value={creditAmountReceived}
                    onChange={(e) => setCreditAmountReceived(e.target.value)}
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className="input"
                  />
                  {Number(creditAmountReceived) > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1.5">
                      Remaining credit: Rs.{" "}
                      {(total - Number(creditAmountReceived)).toFixed(0)}
                    </p>
                  )}
                  {(!creditAmountReceived ||
                    Number(creditAmountReceived) === 0) && (
                      <p className="text-xs text-amber-600 font-medium mt-1.5">
                        Full credit: Rs. {total.toFixed(0)} will be added to
                        customer&apos;s balance
                      </p>
                    )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-stone-200 flex gap-3 justify-end bg-stone-50 shrink-0">
              <button
                onClick={() => setShowCreditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreditSale}
                disabled={!selectedCustomer || isCheckingOut}
                className="btn-primary flex items-center gap-2 bg-amber-500 hover:bg-amber-600"
              >
                {isCheckingOut && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {isCheckingOut
                  ? "Processing..."
                  : `Confirm Credit — Rs. ${total.toFixed(0)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SALE SUCCESS SPLASH ───────────────────────────────────────── */}
      {lastSale && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden text-center">
            <div className="px-6 py-8">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="font-brand font-bold text-xl text-stone-900 mb-1">
                Sale Complete!
              </h2>
              <p className="text-sm text-stone-500">{lastSale.saleNumber}</p>
              <div className="mt-4 space-y-1">
                <p className="text-3xl font-brand font-bold text-brand-700 tabular">
                  Rs. {lastSale.total.toFixed(0)}
                </p>
                {lastSale.paymentMethod === "cash" && lastSale.change > 0 && (
                  <p className="text-sm text-stone-500">
                    Change: Rs. {lastSale.change.toFixed(0)}
                  </p>
                )}
                <p className="text-xs text-stone-400 uppercase font-semibold tracking-wide">
                  {lastSale.paymentMethod === "credit"
                    ? "Credit / Udhaar"
                    : "Cash"}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-stone-200 bg-stone-50 flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="btn-secondary w-full py-2.5 flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Receipt
              </button>
              <button
                autoFocus
                onClick={dismissSale}
                className="btn-primary w-full py-2.5"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PRINTABLE RECEIPT ───────────────────────────────────────── */}
      <div className="hidden print:block absolute inset-0 bg-white z-[100] text-black font-mono p-4 text-sm w-[300px]">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">SEVESTO POS</h2>
          <p>Tuck Shop</p>
        </div>
        <div className="border-t border-dashed border-black py-2 mb-2">
          {lastSale && (
            <>
              <p>Sale: {lastSale.saleNumber}</p>
              <p>Method: {lastSale.paymentMethod.toUpperCase()}</p>
            </>
          )}
        </div>
        <div className="border-t border-b border-dashed border-black py-2 mb-2">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-center">Qty</th>
                <th className="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {lastSale?.items?.map((item, i) => (
                <tr key={i}>
                  <td className="w-3/5 truncate pr-2">{item.name}</td>
                  <td className="w-1/5 text-center">{item.quantity}</td>
                  <td className="w-1/5 text-right">{item.sellingPrice * item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lastSale && (
          <div className="text-right font-bold text-lg mb-4">
            Total: Rs. {lastSale.total.toFixed(0)}
          </div>
        )}

        <div className="text-center text-xs space-y-1">
          <p>Thank you for shopping with us!</p>
          <p>{new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
