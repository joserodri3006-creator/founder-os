import { supabaseAdmin } from "@/lib/supabase-admin";

/** Antwortfrist in Stunden je Sternebewertung (Konzept: 1 Stern 24 h, 2 Sterne 48 h). */
export const REPLY_DEADLINE_HOURS: Record<number, number> = { 1: 24, 2: 48 };

/**
 * Bei 1 bis 2 Sternen: Aufgabe für das Team (an den Kunden gehängt) und Benachrichtigung
 * an Founder sowie Venture-Manager. Fehler hier dürfen die Bewertung nie blockieren.
 */
export async function escalateCriticalReview(
  reviewId: string,
  invitation: { venture: string; customer_id: string | null; customer_name: string | null },
  rating: number
) {
  try {
    const hours = REPLY_DEADLINE_HOURS[rating] ?? 48;
    const due = new Date(Date.now() + hours * 3600_000).toISOString().slice(0, 10);
    const who = invitation.customer_name || "Kunde";

    if (invitation.customer_id) {
      await supabaseAdmin.from("tasks").insert({
        venture: invitation.venture,
        entity_type: "customer",
        entity_id: invitation.customer_id,
        title: `Kritische Bewertung (${rating} ${rating === 1 ? "Stern" : "Sterne"}) beantworten: ${who}`,
        description: `Antwortfrist ${hours} Stunden. Bewertung prüfen unter /bewertungen, Kunden bei Bedarf privat kontaktieren und öffentlich sachlich antworten. Bewertung nicht löschen.`,
        status: "open",
        priority: "high",
        due_date: due,
      });
    }

    const { data: recipients } = await supabaseAdmin
      .from("user_venture_roles")
      .select("user_id,role,venture")
      .or(`role.eq.founder,and(role.eq.manager,venture.eq.${invitation.venture})`);
    const unique = Array.from(new Set((recipients ?? []).map((r) => r.user_id).filter(Boolean)));
    if (unique.length) {
      await supabaseAdmin.from("notifications").insert(unique.map((user_id) => ({
        user_id,
        venture: invitation.venture,
        event_type: "critical_review",
        title: `Kritische Bewertung: ${rating} ${rating === 1 ? "Stern" : "Sterne"}`,
        body: `${who} hat eine kritische Bewertung abgegeben. Antwortfrist ${hours} Stunden.`,
        link: "/bewertungen",
      })));
    }
  } catch (err) {
    console.warn("critical review escalation failed", reviewId, err);
  }
}
