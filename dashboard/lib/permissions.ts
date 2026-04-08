export type PermissionLevel = "edit" | "view" | "none";

export type Section =
  | "leads"
  | "customers"
  | "orders"
  | "products"
  | "drafts"
  | "invoices"
  | "settings";

export type Permissions = Record<Section, PermissionLevel>;

export type Role = "founder" | "manager" | "employee";

export const SECTIONS: Section[] = [
  "leads", "customers", "orders", "products", "drafts", "invoices", "settings",
];

export const SECTION_LABELS: Record<Section, string> = {
  leads: "Leads",
  customers: "Kunden",
  orders: "Aufträge",
  products: "Produkte",
  drafts: "KI-Drafts",
  invoices: "Rechnungen",
  settings: "Einstellungen",
};

export const FOUNDER_PERMISSIONS: Permissions = {
  leads: "edit", customers: "edit", orders: "edit",
  products: "edit", drafts: "edit", invoices: "edit", settings: "edit",
};

export const MANAGER_PERMISSIONS: Permissions = {
  leads: "edit", customers: "edit", orders: "edit",
  products: "edit", drafts: "edit", invoices: "edit", settings: "none",
};

export const EMPLOYEE_DEFAULT_PERMISSIONS: Permissions = {
  leads: "none", customers: "view", orders: "edit",
  products: "edit", drafts: "none", invoices: "none", settings: "none",
};

export function canEdit(permissions: Permissions, section: Section): boolean {
  return permissions[section] === "edit";
}

export function canView(permissions: Permissions, section: Section): boolean {
  return permissions[section] === "edit" || permissions[section] === "view";
}

export function mergePermissions(base: Partial<Permissions>): Permissions {
  return { ...EMPLOYEE_DEFAULT_PERMISSIONS, ...base };
}
