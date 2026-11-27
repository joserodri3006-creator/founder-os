import { supabaseAdmin } from "@/lib/supabase-admin";
import type { PermissionLevel, Section } from "@/lib/permissions";

type VentureRole = {
  role: string;
  venture: string | null;
  permissions: Partial<Record<Section, PermissionLevel>> | null;
};

export type McpAccess = {
  isFounder: boolean;
  roles: VentureRole[];
};

export async function getMcpAccess(userId: string): Promise<McpAccess | null> {
  const { data, error } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role,venture,permissions")
    .eq("user_id", userId);

  if (error) throw new Error(`MCP role lookup failed: ${error.message}`);
  const roles = (data ?? []) as VentureRole[];
  if (roles.length === 0) return null;

  return {
    isFounder: roles.some((row) => row.role === "founder"),
    roles,
  };
}

export function canAccessVenture(access: McpAccess, venture: string): boolean {
  return access.isFounder || access.roles.some((row) => row.venture === venture);
}

export function canUseSection(
  access: McpAccess,
  venture: string,
  section: Section,
  required: Exclude<PermissionLevel, "none">,
): boolean {
  if (access.isFounder) return true;
  return access.roles.some((row) => {
    if (row.venture !== venture) return false;
    const assigned = row.permissions?.[section] ?? "none";
    return assigned === "edit" || (assigned === "view" && required === "view");
  });
}

export function allowedVentures(access: McpAccess): string[] {
  return access.isFounder
    ? []
    : [...new Set(access.roles.flatMap((row) => row.venture ? [row.venture] : []))];
}
