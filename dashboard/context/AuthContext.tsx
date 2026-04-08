"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase-browser";
import {
  Permissions, Section, PermissionLevel, Role,
  FOUNDER_PERMISSIONS, MANAGER_PERMISSIONS, mergePermissions, canEdit, canView,
} from "@/lib/permissions";
import type { User } from "@supabase/supabase-js";

interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  venture: string | null; // null = alle Ventures (Founder)
  permissions: Permissions;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  canEdit: (section: Section) => boolean;
  canView: (section: Section) => boolean;
  hasVentureAccess: (ventureId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  canEdit: () => false,
  canView: () => false,
  hasVentureAccess: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadUser(supabaseUser: User) {
    // Load role from DB
    const { data: roleData } = await supabase
      .from("user_venture_roles")
      .select("*")
      .eq("user_id", supabaseUser.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let role: Role = "employee";
    let venture: string | null = null;
    let permissions: Permissions = mergePermissions({});

    if (roleData) {
      role = roleData.role as Role;
      venture = roleData.venture ?? null;
      if (role === "founder") permissions = FOUNDER_PERMISSIONS;
      else if (role === "manager") permissions = MANAGER_PERMISSIONS;
      else permissions = mergePermissions(roleData.permissions ?? {});
    } else {
      // No role yet — check if this is the founder email
      if (supabaseUser.email === "jose.rodri3006@gmail.com") {
        role = "founder";
        venture = null;
        permissions = FOUNDER_PERMISSIONS;
        // Auto-insert founder role
        await supabase.from("user_venture_roles").upsert({
          user_id: supabaseUser.id,
          venture: null,
          role: "founder",
          permissions: FOUNDER_PERMISSIONS,
        }, { onConflict: "user_id,venture" });
      }
    }

    setUser({
      id: supabaseUser.id,
      email: supabaseUser.email ?? "",
      name: supabaseUser.user_metadata?.full_name ?? supabaseUser.email ?? "",
      avatar_url: supabaseUser.user_metadata?.avatar_url ?? null,
      role,
      venture,
      permissions,
    });
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) loadUser(u).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadUser(session.user).finally(() => setLoading(false));
      else { setUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  }

  function checkCanEdit(section: Section): boolean {
    if (!user) return false;
    return canEdit(user.permissions, section);
  }

  function checkCanView(section: Section): boolean {
    if (!user) return false;
    return canView(user.permissions, section);
  }

  function hasVentureAccess(ventureId: string): boolean {
    if (!user) return false;
    if (user.role === "founder") return true; // founder sieht alles
    return user.venture === ventureId;
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signOut,
      canEdit: checkCanEdit,
      canView: checkCanView,
      hasVentureAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function usePermission(section: Section): { canEdit: boolean; canView: boolean } {
  const { canEdit, canView } = useAuth();
  return { canEdit: canEdit(section), canView: canView(section) };
}
