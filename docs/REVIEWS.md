# Bewertungssystem (MVP: Blazed Outfitters)

Verifizierte Erstanbieter-Bewertungen, ventureübergreifend angelegt (`venture`-Spalte), im MVP nur für `blazed_outfitters` aktiv.

## Ablauf
1. Auftrag wechselt auf `abgeschlossen` (`PATCH /api/auftraege/[id]`) und der Kunde hat eine E-Mail.
2. Es wird einmalig pro Auftrag eine Einladung (`review_invitations`) mit zufälligem 256-Bit-Token angelegt. Nur der SHA-256-Hash wird gespeichert, Gültigkeit 60 Tage.
3. Neutrale Mail (ohne Belohnung) mit Link `/bewerten/<token>`.
4. Kunde bewertet 1–5 Sterne, Text, optional Qualität/Kommunikation/Lieferung, entscheidet über öffentliche Freigabe. Namen werden gekürzt („Anna M.“).
5. Bewertung landet als `pending` in `/bewertungen` (Founder OS). Veröffentlichen nur mit Kundenfreigabe. Ablehnen/Markieren nur mit dokumentiertem Grund. Kritische Bewertungen werden nicht gelöscht.
6. Blazed zeigt veröffentlichte Bewertungen unter `/bewertungen` (ISR 5 Min.).

## Aktivierung
Der automatische Versand ist standardmäßig AUS. Aktivieren: Vercel-Variable `REVIEW_INVITES_ENABLED=true` (zusätzlich `RESEND_API_KEY`; Absender `info@blazedoutfitters.com` benötigt verifizierte Resend-Domain; optional `NEXT_PUBLIC_SITE_URL`).

## Sicherheit
- `reviews` / `review_invitations`: RLS aktiv, keine anon-Policies. Zugriff nur über Server-Routen (Service Role) bzw. Einmal-Token.
- Öffentliche Ausgabe filtert `status='published' AND public_consent=true`.
- Interne API `/api/reviews*` über Permission-Section `reviews` (proxy.ts). Hinweis: Entity-Level-Venture-Prüfung auf `/api/reviews/[id]` entspricht dem bestehenden Muster und ist ein offener Punkt aus dem Security-Audit.

## Migration
`supabase/migrations/20261008_blazed_reviews_mvp.sql` (bereits angewendet).
