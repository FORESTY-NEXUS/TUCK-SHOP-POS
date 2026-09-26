// Fine-grained access control on top of the coarse cashier/manager/admin
// role. "staff" (managing staff accounts) and "backup" (data export/restore)
// are intentionally NOT toggleable here -- they stay locked to role==="admin"
// everywhere they're checked, so there's no checkbox that can accidentally
// hand out staff management or a full data export.

export const PERMISSION_GROUPS = [
  {
    key: "sales",
    label: "Sales & POS",
    permissions: ["salesDiscount", "salesVoid", "salesReturn", "salesCreditGive"],
  },
  {
    key: "udhaar",
    label: "Udhaar (Credit)",
    permissions: ["udhaarView", "udhaarCollect"],
  },
  {
    key: "products",
    label: "Products & Categories",
    permissions: ["productsCreate", "productsEdit", "productsDelete", "categoriesManage"],
  },
  {
    key: "shifts",
    label: "Shifts",
    permissions: ["shiftsCloseOthers"],
  },
  {
    key: "reports",
    label: "Reports",
    permissions: ["reportsView", "shiftsHistoryView"],
  },
  {
    key: "settings",
    label: "Settings",
    permissions: ["settingsManage"],
  },
] as const;

export const TOGGLEABLE_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions) as readonly Permission[];
export type Permission =
  | "salesDiscount"
  | "salesVoid"
  | "salesReturn"
  | "salesCreditGive"
  | "udhaarView"
  | "udhaarCollect"
  | "productsCreate"
  | "productsEdit"
  | "productsDelete"
  | "categoriesManage"
  | "shiftsCloseOthers"
  | "reportsView"
  | "shiftsHistoryView"
  | "settingsManage";

export const PERMISSION_LABELS: Record<Permission, string> = {
  salesDiscount: "Apply a discount on a sale",
  salesVoid: "Void an entire sale",
  salesReturn: "Process a partial return",
  salesCreditGive: "Give store credit (Udhaar) at checkout",
  udhaarView: "View the Udhaar ledger & customer balances",
  udhaarCollect: "Record an Udhaar payment collected",
  productsCreate: "Add new products",
  productsEdit: "Edit existing products (price, stock, details)",
  productsDelete: "Delete products",
  categoriesManage: "Manage categories",
  shiftsCloseOthers: "Close another cashier's shift",
  reportsView: "View dashboard & sales reports",
  shiftsHistoryView: "View shift history for all cashiers",
  settingsManage: "Manage settings",
};

// Cashier defaults to the bare minimum: ring up cash/other sales, view and
// close their own shift. No discounts, no refunds, no credit, no product
// edits -- those are exactly the levers someone could use to quietly move
// money or stock without it ever showing as "missing".
export const DEFAULT_PERMISSIONS: Record<"cashier" | "manager" | "admin", Permission[]> = {
  cashier: [],
  manager: [
    "salesDiscount", "salesVoid", "salesReturn", "salesCreditGive",
    "udhaarView", "udhaarCollect",
    "productsCreate", "productsEdit", "productsDelete", "categoriesManage",
    "shiftsCloseOthers",
    "reportsView", "shiftsHistoryView",
  ],
  admin: [...TOGGLEABLE_PERMISSIONS],
};

export function defaultPermissionsFor(role: "cashier" | "manager" | "admin"): Permission[] {
  return [...DEFAULT_PERMISSIONS[role]];
}

export function sanitizePermissions(input: unknown): Permission[] {
  if (!Array.isArray(input)) return [];
  return input.filter((p): p is Permission => (TOGGLEABLE_PERMISSIONS as readonly string[]).includes(p));
}

/** Effective permission set. Admins always have everything, regardless of
 *  what's stored on the account -- this prevents a stale/empty permissions
 *  array from ever locking an admin out. */
export function effectivePermissions(
  role: "cashier" | "manager" | "admin",
  permissions?: Permission[] | null
): Permission[] {
  if (role === "admin") return [...TOGGLEABLE_PERMISSIONS];
  return permissions && permissions.length >= 0 ? permissions : defaultPermissionsFor(role);
}

export function hasPermission(
  role: "cashier" | "manager" | "admin",
  permissions: Permission[] | undefined | null,
  perm: Permission
): boolean {
  return effectivePermissions(role, permissions).includes(perm);
}
