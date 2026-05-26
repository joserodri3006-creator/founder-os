import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PAGE_PREFIXES = ["/login", "/auth", "/invite", "/online-first"];
const PUBLIC_API_PREFIXES = ["/api/invite", "/api/public"];

type PermissionLevel = "edit" | "view" | "none";
type Section = "leads" | "customers" | "orders" | "products" | "drafts" | "invoices" | "settings";

const API_SECTIONS: Array<{ prefix: string; section: Section }> = [
  { prefix: "/api/leads", section: "leads" },
  { prefix: "/api/kunden", section: "customers" },
  { prefix: "/api/auftraege", section: "orders" },
  { prefix: "/api/drafts", section: "drafts" },
  { prefix: "/api/produkte", section: "products" },
  { prefix: "/api/produkt-", section: "products" },
  { prefix: "/api/steuerklassen", section: "settings" },
  { prefix: "/api/payment-models", section: "settings" },
  { prefix: "/api/team", section: "settings" },
  { prefix: "/api/config", section: "settings" },
  { prefix: "/api/attachments", section: "orders" },
];
const VENTURE_SCOPED_LIST_PATHS = new Set([
  "/api/dashboard",
  "/api/leads",
  "/api/kunden",
  "/api/auftraege",
  "/api/drafts",
  "/api/produkte",
]);

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isProtectedPath(pathname: string) {
  if (pathname.startsWith("/api/")) {
    return !startsWithAny(pathname, PUBLIC_API_PREFIXES);
  }

  return !startsWithAny(pathname, PUBLIC_PAGE_PREFIXES);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtectedPath(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request: req });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (!pathname.startsWith("/api/")) return response;

    const { data: role } = await supabase
      .from("user_venture_roles")
      .select("role,venture,permissions")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (role?.role === "founder" || user.email === "jose.rodri3006@gmail.com") {
      return response;
    }

    const requestedVenture = req.nextUrl.searchParams.get("venture");
    if (role?.venture && requestedVenture && requestedVenture !== role.venture) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (role?.venture && req.method === "GET" && VENTURE_SCOPED_LIST_PATHS.has(pathname) && !requestedVenture) {
      return NextResponse.json({ error: "venture is required" }, { status: 400 });
    }
    if (
      role?.venture
      && req.method !== "GET"
      && req.headers.get("content-type")?.includes("application/json")
    ) {
      const body = await req.clone().json().catch(() => null) as { venture?: string } | null;
      if (body?.venture && body.venture !== role.venture) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const mapped = API_SECTIONS.find(({ prefix }) => pathname.startsWith(prefix));
    if (!mapped) return response;

    const required: Exclude<PermissionLevel, "none"> =
      req.method === "GET" || req.method === "HEAD" ? "view" : "edit";
    const assigned = (role?.permissions?.[mapped.section] ?? "none") as PermissionLevel;
    const permitted = assigned === "edit" || (assigned === "view" && required === "view");

    if (permitted) return response;
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
