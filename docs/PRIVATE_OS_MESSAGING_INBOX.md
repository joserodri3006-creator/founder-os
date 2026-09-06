# Private OS Messaging Inbox — Instagram-first MVP

Status: **MVP-Skeleton im Dashboard implementiert; Instagram-Verbindung/Worker noch offen.**

## Ziel

Private OS bekommt eine eigene Nachrichten-Inbox für ausgewählte private Kontakte.
Threads sollen kanalübergreifend darstellbar sein:

- Instagram DMs zuerst
- WhatsApp danach über die bereits gekoppelte Baileys-Session
- pro Kontakt/Thread gespeicherte Nachrichten
- Antworten aus dem Dashboard heraus
- destruktive Aktionen nur als explizit freigegebene Queue-Aktion

## Datenschutz-Grenzen

- Nicht alle privaten Nachrichten ungefiltert dauerhaft speichern.
- Speicherung erfolgt nur für `private_os_contacts.is_tracked = true` bzw. explizit freigegebene Kontakte/Threads.
- Antworten werden nicht direkt im UI ausgeführt, sondern in `private_os_message_actions` als `queued` abgelegt. Ein lokaler Worker verarbeitet diese Queue.
- Remote-Löschen ist technisch pro Provider unterschiedlich und bleibt eine explizite Aktion (`delete_remote`).

## Datenmodell

Migration: `supabase/migrations/private_os_messaging.sql`

Tabellen:

- `private_os_accounts` — verbundene Provider-Accounts, z.B. Instagram/WhatsApp
- `private_os_contacts` — kanalgebundene Kontakte, inkl. `is_tracked`
- `private_os_threads` — Conversation/Thread pro Provider
- `private_os_messages` — einzelne Nachrichten + Medien-Metadaten
- `private_os_message_actions` — Queue für `reply`, `delete_remote`, `delete_local`, `archive_thread`, `mark_tracked`

## Dashboard

Neue Seite:

- `/private-os/messages`

Neue API-Routen:

- `GET /api/private-os/messages?provider=instagram|whatsapp|all&tracked_only=true|false`
- `GET /api/private-os/messages/[thread_id]`
- `POST /api/private-os/messages/[thread_id]` mit:
  - `{ action: "reply", body_text: "..." }`
  - `{ action: "delete_local", message_id: "..." }`
  - `{ action: "delete_remote", message_id: "..." }`

## Instagram-Integration

Empfohlener stabiler Weg: **Meta Instagram Messaging API**, nicht Browser-Scraping.

Voraussetzungen:

1. Instagram Professional Account
2. verbunden mit Facebook Page
3. Meta App mit Messenger/Instagram Messaging Permissions
4. Long-lived Page Access Token
5. Webhook oder Polling-Worker

Benötigte Secrets lokal/Vercel/Worker:

- `PRIVATE_OS_INSTAGRAM_IG_USER_ID`
- `PRIVATE_OS_INSTAGRAM_PAGE_ACCESS_TOKEN`
- optional `PRIVATE_OS_INSTAGRAM_VERIFY_TOKEN` für Webhooks

MVP-Worker:

- DMs abrufen
- Kontakt/Thread upserten
- nur freigegebene Kontakte speichern oder neue Kontakte als untracked sichtbar machen
- Nachrichten idempotent per `provider_message_id` speichern
- Reply-Aktionen aus `private_os_message_actions` senden

## WhatsApp-Integration später

WhatsApp ist gekoppelt, aber für Produktivbetrieb braucht es genau einen kontrollierten Prozess pro Session.

Empfohlene Regeln:

- Status/Broadcast standardmäßig ignorieren
- Gruppen standardmäßig ignorieren oder separat freigeben
- Read receipts auslassen, solange wir nur beobachten
- Reply-Aktionen aus Private OS ohne Hermes-Agent-Prefix senden
- Remote-Löschen:
  - `delete_local`: im Private OS ausblenden
  - `delete_remote`: per Baileys versuchen; WhatsApp kann Löschen für alle zeitlich/seitig begrenzen

## Nächste Phase

1. Migration in Supabase anwenden.
2. Instagram Professional/Page/API-Zugang einrichten.
3. Polling- oder Webhook-Worker bauen.
4. Reply-Worker für Instagram-Aktionen bauen.
5. Danach WhatsApp-Worker aus der aktuellen Bridge heraus sauber kapseln.
