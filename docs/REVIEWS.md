# Bewertungssystem (MVP: Blazed Outfitters)

Verifizierte Erstanbieter-Bewertungen, ventureübergreifend angelegt (`venture`-Spalte), im MVP nur für `blazed_outfitters` aktiv.

## Ablauf
1. Auftrag wechselt auf `abgeschlossen` (`PATCH /api/auftraege/[id]`) und der Kunde hat eine E-Mail.
2. Founder OS merkt pro Auftrag genau eine Einladung vor (`review_invitations`, Platzhalter-Hash `unissued:<uuid>`, `send_after` = Abschluss + `REVIEW_INVITE_DELAY_DAYS`, Standard 3 Tage). Es entsteht noch kein Token.
3. Der Hermes-Worker `scripts/blazed_review_invites_send.py` (Cron „Blazed Bewertungseinladungen versenden“, täglich 10:23 UTC, no_agent, stumm bei leerer Queue) erzeugt den 256-Bit-Token, speichert nur dessen SHA-256-Hash (60 Tage gültig) und versendet die neutrale Mail (ohne Belohnung) mit Link `/bewerten/<token>` über das KAS-Postfach `info@blazedoutfitters.com`. Eine Kopie landet in „Gesendet“. Doppelversand ist ausgeschlossen (Token wird atomar reserviert).
   Vercel braucht dafür weder Resend-Domain noch Postfach-Zugangsdaten.
4. Kunde bewertet 1–5 Sterne, Text, optional Qualität/Kommunikation/Lieferung, entscheidet über öffentliche Freigabe. Namen werden gekürzt („Anna M.“).
5. Bewertung landet als `pending` in `/bewertungen` (Founder OS). Veröffentlichen nur mit Kundenfreigabe. Ablehnen/Markieren nur mit dokumentiertem Grund. Kritische Bewertungen werden nicht gelöscht.
6. Blazed zeigt veröffentlichte Bewertungen unter `/bewertungen` (ISR 5 Min.).

## Aktivierung
Das Vormerken ist standardmäßig AUS. Aktivieren: Vercel-Variable `REVIEW_INVITES_ENABLED=true` (Production). Resend wird nicht benötigt. Test: `blazed_review_invites_send.py --dry-run [--ignore-delay] [--only-invitation ID]` (Python: `/opt/data/growshop_research/.venv/bin/python`).

## Sicherheit
- `reviews` / `review_invitations`: RLS aktiv, keine anon-Policies. Zugriff nur über Server-Routen (Service Role) bzw. Einmal-Token.
- Öffentliche Ausgabe filtert `status='published' AND public_consent=true`.
- Interne API `/api/reviews*` über Permission-Section `reviews` (proxy.ts). Hinweis: Entity-Level-Venture-Prüfung auf `/api/reviews/[id]` entspricht dem bestehenden Muster und ist ein offener Punkt aus dem Security-Audit.

## Migration
`supabase/migrations/20261008_blazed_reviews_mvp.sql` (bereits angewendet).
