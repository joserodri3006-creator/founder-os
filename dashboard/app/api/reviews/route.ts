import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const STATUSES = new Set(["pending", "published", "flagged", "rejected"]);

export async function GET(req: NextRequest) {
  const venture = req.nextUrl.searchParams.get("venture");
  if (!venture) return NextResponse.json({ error: "venture is required" }, { status: 400 });
  const status = req.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("reviews")
    .select("*, customer:customers(first_name,last_name,email), order:orders(title,value)")
    .eq("venture", venture)
    .order("submitted_at", { ascending: false })
    .limit(200);
  if (status && STATUSES.has(status)) query = query.eq("status", status);

  const [reviews, invitations] = await Promise.all([
    query,
    supabaseAdmin.from("review_invitations").select("status").eq("venture", venture),
  ]);
  if (reviews.error) return NextResponse.json({ error: reviews.error.message }, { status: 500 });

  const rows = reviews.data ?? [];
  const published = rows.filter((r) => r.status === "published");
  const invites = invitations.data ?? [];
  const invited = invites.filter((i) => ["sent", "opened", "completed"].includes(i.status)).length;
  const completed = invites.filter((i) => i.status === "completed").length;
  return NextResponse.json({
    reviews: rows,
    stats: {
      total: rows.length,
      pending: rows.filter((r) => r.status === "pending").length,
      published: published.length,
      average: published.length ? Number((published.reduce((s, r) => s + r.rating, 0) / published.length).toFixed(1)) : null,
      invited,
      completed,
      conversion: invited ? Math.round((completed / invited) * 100) : null,
      unanswered_critical: rows.filter((r) => r.rating <= 2 && !r.response_text).length,
    },
  });
}
