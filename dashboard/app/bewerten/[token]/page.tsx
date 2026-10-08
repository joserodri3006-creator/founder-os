import type { Metadata } from "next";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hashReviewToken } from "@/lib/review-domain";
import { getBranding } from "@/lib/venture-branding";
import ReviewForm from "./ReviewForm";

// Kundenseitige Seite: nie indexieren, nie cachen (Token im Pfad).
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Bewertung abgeben",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

type State =
  | { kind: "ok"; venture: string; customerName: string | null; orderTitle: string | null; products: Array<{ product_id: string; product_name: string }> }
  | { kind: "invalid" | "used" | "expired"; venture: string | null };

async function resolve(token: string): Promise<State> {
  if (!/^[a-f0-9]{64}$/.test(token)) return { kind: "invalid", venture: null };
  const { data } = await supabaseAdmin
    .from("review_invitations")
    .select("id,venture,customer_name,status,expires_at,order_id,orders(title)")
    .eq("token_hash", hashReviewToken(token))
    .maybeSingle();
  if (!data) return { kind: "invalid", venture: null };
  if (data.status === "completed") return { kind: "used", venture: data.venture };
  if (["expired", "cancelled"].includes(data.status) || new Date(data.expires_at) < new Date()) {
    return { kind: "expired", venture: data.venture };
  }
  if (data.status === "pending" || data.status === "sent") {
    await supabaseAdmin.from("review_invitations").update({ status: "opened", opened_at: new Date().toISOString() }).eq("id", data.id);
  }
  const { data: items } = data.order_id
    ? await supabaseAdmin.from("order_items").select("product_id,product_name").eq("order_id", data.order_id)
    : { data: [] as Array<{ product_id: string | null; product_name: string }> };
  const products = Array.from(new Map((items ?? []).filter((i) => i.product_id).map((i) => [i.product_id as string, { product_id: i.product_id as string, product_name: i.product_name }])).values());
  return {
    kind: "ok",
    products,
    venture: data.venture,
    customerName: data.customer_name,
    orderTitle: (data.orders as unknown as { title?: string } | null)?.title ?? null,
  };
}

export default async function BewertenPage({ params }: Props) {
  const { token } = await params;
  const state = await resolve(token);
  const b = getBranding(state.venture);
  const c = b.colors;

  const message: Record<string, [string, string]> = {
    invalid: ["Link nicht gefunden", "Dieser Bewertungslink ist ungültig. Bitte prüfe, ob du den vollständigen Link aus der E-Mail verwendet hast."],
    used: ["Schon bewertet", "Zu diesem Link wurde bereits eine Bewertung abgegeben. Vielen Dank dafür!"],
    expired: ["Link abgelaufen", "Dieser Bewertungslink ist nicht mehr gültig."],
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={b.fonts.googleFontsUrl} />
      <main style={{ minHeight: "100vh", background: c.page, color: c.ink, fontFamily: b.fonts.body, display: "flex", flexDirection: "column" }}>
        <header style={{ padding: "28px 20px 8px", textAlign: "center" }}>
          {b.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <a href={b.siteUrl}><img src={b.logoUrl} alt={b.name} style={{ height: 64, width: "auto" }} /></a>
          ) : (
            <p style={{ fontFamily: b.fonts.heading, letterSpacing: "0.14em", textTransform: "uppercase", fontSize: 20, margin: 0 }}>{b.name}</p>
          )}
        </header>

        <section style={{ flex: 1, display: "flex", justifyContent: "center", padding: "16px 16px 40px" }}>
          <div style={{ width: "100%", maxWidth: 560 }}>
            <div style={{ textAlign: "center", margin: "12px 0 24px" }}>
              <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.3em", textTransform: "uppercase", color: c.accent }}>
                {state.kind === "ok" ? "Deine Meinung zählt" : "Bewertung"}
              </p>
              <h1 style={{ fontFamily: b.fonts.heading, fontStyle: "italic", fontWeight: 500, fontSize: "clamp(2rem, 6vw, 2.8rem)", lineHeight: 1.1, margin: "10px 0 0" }}>
                {state.kind === "ok"
                  ? b.address === "du" ? "Wie war deine Erfahrung?" : "Wie war Ihre Erfahrung?"
                  : message[state.kind][0]}
              </h1>
              {state.kind === "ok" && (
                <p style={{ margin: "12px auto 0", maxWidth: 440, color: c.muted, lineHeight: 1.6, fontSize: 15 }}>
                  {b.address === "du"
                    ? "Ehrlich, positiv, neutral oder kritisch: Dein Feedback hilft uns, besser zu werden. Es gibt keine Belohnung für Bewertungen."
                    : "Ehrlich, positiv, neutral oder kritisch: Ihr Feedback hilft uns, besser zu werden. Es gibt keine Belohnung für Bewertungen."}
                </p>
              )}
            </div>

            <div style={{ background: c.surface, border: `1px solid ${c.border}`, borderRadius: 2, padding: "28px 24px" }}>
              {state.kind === "ok" ? (
                <ReviewForm token={token} branding={b} customerName={state.customerName} orderTitle={state.orderTitle} products={state.products} />
              ) : (
                <div style={{ textAlign: "center" }}>
                  <p style={{ margin: "0 0 20px", color: c.muted, lineHeight: 1.6 }}>{message[state.kind][1]}</p>
                  <a href={b.siteUrl} style={{ display: "inline-block", padding: "12px 28px", background: c.accent, color: c.accentText, textDecoration: "none", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase" }}>
                    Zu {b.name}
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>

        <footer style={{ padding: "16px 20px 28px", textAlign: "center", fontSize: 12, color: c.muted }}>
          {b.name}{b.contactEmail ? <> · <a href={`mailto:${b.contactEmail}`} style={{ color: c.muted }}>{b.contactEmail}</a></> : null}
        </footer>
      </main>
    </>
  );
}
