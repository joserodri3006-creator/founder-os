import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { REVIEW_VENTURES } from "@/lib/review-domain";

const ALLOWED_ORIGINS = new Set([
  "https://blazedoutfitters.com",
  "https://www.blazedoutfitters.com",
  "https://blazed-outfitters.vercel.app",
  "https://founder-os-theta.vercel.app",
]);

function cors(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.blazedoutfitters.com",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function GET(req: NextRequest) {
  const venture = new URL(req.url).searchParams.get("venture") || "blazed_outfitters";
  if (!REVIEW_VENTURES.includes(venture)) {
    return NextResponse.json({ error: "Öffentliches Bewertungsprofil nicht freigeschaltet." }, { status: 404, headers: cors(req) });
  }
  const productId = new URL(req.url).searchParams.get("product_id");
  if (productId) {
    const { data: rows, error: pErr } = await supabaseAdmin
      .from("review_product_ratings")
      .select("rating, reviews!inner(status,public_consent,venture,title,body,author_display_name,published_at)")
      .eq("product_id", productId)
      .eq("venture", venture)
      .eq("reviews.status", "published")
      .eq("reviews.public_consent", true);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500, headers: cors(req) });
    const list = rows ?? [];
    const avg = list.length ? Number((list.reduce((sum, r) => sum + r.rating, 0) / list.length).toFixed(1)) : null;
    return NextResponse.json({ venture, product_id: productId, average: avg, count: list.length }, { headers: cors(req) });
  }
  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("id,rating,title,body,author_display_name,is_verified,review_type,response_text,response_at,submitted_at,published_at")
    .eq("venture", venture)
    .eq("status", "published")
    .eq("public_consent", true)
    .order("published_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: cors(req) });

  const reviews = data ?? [];
  const count = reviews.length;
  const average = count ? reviews.reduce((sum, review) => sum + Number(review.rating), 0) / count : null;
  const distribution = [1, 2, 3, 4, 5].reduce<Record<string, number>>((acc, rating) => {
    acc[String(rating)] = reviews.filter((review) => review.rating === rating).length;
    return acc;
  }, {});

  return NextResponse.json({
    venture,
    average: average === null ? null : Number(average.toFixed(1)),
    count,
    distribution,
    reviews,
  }, { headers: cors(req) });
}
