# Bewertungssystem (MVP: Blazed Outfitters)

Verifizierte Erstanbieter-Bewertungen, ventureübergreifend angelegt (`venture`-Spalte), im MVP nur für `blazed_outfitters` aktiv.

## Ablauf
1. Auftrag wechselt auf `abgeschlossen` (`PATCH /api/auftraege/[id]`) und der Kunde hat eine E-Mail.
2. Founder OS merkt pro Auftrag genau eine Einladung vor (`review_invitations`, Platzhalter-Hash `unissued:<uuid>`, `send_after` = Abschluss + `REVIEW_INVITE_DELAY_DAYS`, Standard 3 Tage). Es entsteht noch kein Token.
3. Der Hermes-Worker `scripts/blazed_review_invites_send.py` (Cron „Blazed Bewertungseinladungen versenden“, täglich 10:23 UTC, no_agent, stumm bei leerer Queue) erzeugt den 256-Bit-Token, speichert nur dessen SHA-256-Hash (60 Tage gültig) und versendet die neutrale Mail (ohne Belohnung) mit Link `https://www.blazedoutfitters.com/bewerten/<token>` (HTML-Mail im Blazed-Design mit Button und Text-Fallback; die URL leitet per 307 auf das Founder-OS-Formular weiter) über das KAS-Postfach `info@blazedoutfitters.com`. Eine Kopie landet in „Gesendet“. Doppelversand ist ausgeschlossen (Token wird atomar reserviert).
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

## Branding
Das Formular `/bewerten/<token>` wird serverseitig gerendert, ohne Founder-OS-Rahmen, und übernimmt das Branding des Ventures aus der Einladung (`lib/venture-branding.ts`: Logo, Farben, Schriften, Anrede du/Sie, Footer). Neues Venture = ein Eintrag in `BRANDINGS`; ohne Eintrag greift das neutrale Founder-OS-Fallback. Die Seite ist `noindex`, `no-store` und per `robots.txt` auf Blazed ausgeschlossen.

## Gültigkeit
Ein Link ist einmal verwendbar und läuft 60 Tage nach dem frühesten Versandzeitpunkt ab (`expires_at` = Abschluss + Wartezeit + 60 Tage, Standard also 63 Tage nach Auftragsabschluss). Danach zeigt die Seite „Link abgelaufen“.

## Erweiterungen (Okt 2026)
- **Venture-Prüfung:** `/api/reviews*` erlaubt nur Founder oder Nutzer des jeweiligen Ventures (`lib/review-access.ts`), sonst 403/401.
- **Rollenrechte:** Permission-Section `reviews`. Manager von Blazed haben `edit`, alle anderen Manager `none`; Migration `20261008_review_products_roles.sql`.
- **Erinnerung:** `blazed_review_invites_send.py` sendet 7 Tage nach Versand einmalig eine Erinnerung an unbewertete Einladungen. Der Link wird dabei erneuert (alter Link ungültig). Danach keine weitere Nachricht.
- **Kritische Bewertungen (1 bis 2 Sterne):** automatische Aufgabe (hoch, Frist 24 h bzw. 48 h, am Kunden) plus Benachrichtigung `critical_review` an Founder und Venture-Manager.
- **Produktbewertungen:** optional im Formular für die Produkte der Bestellung (`review_product_ratings`). Blazed gibt pro Produkt `aggregateRating` im JSON-LD nur aus, wenn veröffentlichte Produktbewertungen vorliegen. Ob Google daraus Sterne zeigt, entscheidet Google.
- **Ventureübersicht:** `/bewertungen` zeigt dem Founder alle Ventures mit Durchschnitt, offenen und kritischen Bewertungen. Weitere Ventures: in `REVIEW_VENTURES` (`lib/review-domain.js`), `venture-branding.ts` und `Sidebar.tsx` ergänzen sowie einen Versand-Worker mit eigenem Postfach anlegen.
