# Private OS Messaging Inbox — Instagram + WhatsApp On-Demand

Status: **Dashboard/API/Migration implementiert; Instagram- und WhatsApp-Worker vorhanden; Provider-Secrets bzw. lokaler Worker-Betrieb steuern Live-Daten.**

## Ziel

Private OS bekommt eine eigene Nachrichten-Inbox für ausgewählte private Kontakte.
Threads sollen kanalübergreifend darstellbar sein:

- Instagram DMs über die Meta Instagram Messaging API
- WhatsApp über die bereits gekoppelte Baileys-Session, aber nur zeitweise/on demand
- pro Kontakt/Thread gespeicherte Nachrichten
- Antworten aus dem Dashboard heraus
- destruktive Aktionen nur als explizit freigegebene Queue-Aktion

## Datenschutz-Grenzen

- Nicht alle privaten Nachrichten ungefiltert dauerhaft speichern.
- Speicherung erfolgt standardmäßig nur für `private_os_contacts.is_tracked = true` bzw. explizit freigegebene Kontakte/Threads.
- WhatsApp wird nicht dauerhaft verbunden gehalten. Dashboard-Buttons legen Sync-Runs an, die ein lokaler Worker verarbeitet.
- Antworten werden nicht direkt im UI ausgeführt, sondern in `private_os_message_actions` als `queued` abgelegt. Ein lokaler Worker verarbeitet diese Queue.
- Remote-Löschen ist technisch pro Provider unterschiedlich und bleibt eine explizite Aktion (`delete_remote`).
- WhatsApp Read Receipts bleiben im Worker deaktiviert.

## Datenmodell

Migrationen:

- `supabase/migrations/private_os_messaging.sql`
- `supabase/migrations/private_os_whatsapp_sync_runs.sql`

Tabellen:

- `private_os_accounts` — verbundene Provider-Accounts, z.B. Instagram/WhatsApp
- `private_os_contacts` — kanalgebundene Kontakte, inkl. `is_tracked`
- `private_os_threads` — Conversation/Thread pro Provider
- `private_os_messages` — einzelne Nachrichten + Medien-Metadaten
- `private_os_message_actions` — Queue für `reply`, `delete_remote`, `delete_local`, `archive_thread`, `mark_tracked`
- `private_os_whatsapp_sync_runs` — Queue/Status für manuelle WhatsApp-Bridge-Runs

## Dashboard

Neue Seite:

- `/private-os/messages`

Founder-only Schutz:

- Sidebar-Link nur für `user.role === "founder"`
- Page zeigt Nicht-Founder keinen Inhalt
- API-Routen nutzen `requireFounder()` serverseitig

API-Routen:

- `GET /api/private-os/messages?provider=instagram|whatsapp|all&tracked_only=true|false`
- `GET /api/private-os/messages/[thread_id]`
- `POST /api/private-os/messages/[thread_id]` mit:
  - `{ action: "reply", body_text: "..." }`
  - `{ action: "delete_local", message_id: "..." }`
  - `{ action: "delete_remote", message_id: "..." }`
- `GET /api/private-os/whatsapp/status`
- `POST /api/private-os/whatsapp/sync`
- `POST /api/private-os/whatsapp/stop`

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

Worker:

- `scripts/private_os_instagram_worker.py`

Aufgaben:

- DMs abrufen
- Kontakt/Thread upserten
- nur freigegebene Kontakte speichern oder neue Kontakte als untracked sichtbar machen
- Nachrichten idempotent per `provider_message_id` speichern
- Reply-Aktionen aus `private_os_message_actions` senden

## WhatsApp On-Demand Integration

Worker:

- `scripts/private_os_whatsapp_worker.py`

Dashboard-Buttons:

- **Status prüfen** — liest den letzten Run aus `private_os_whatsapp_sync_runs`
- **Jetzt WhatsApp abrufen** — queued einen kurzen Live-Sync; Worker startet Bridge, sammelt Events, stoppt Bridge
- **letzte 2 Tage versuchen** — queued einen experimentellen History-Sync; aktuell nutzt er dasselbe sichere Sync-Fenster und dokumentiert im Run-Ergebnis, ob echte Retro-History verfügbar war
- **Bridge stoppen** — queued einen Stop-Run für lokale Bridge-Prozesse

Wichtige Grenze:

- Die vorhandene Hermes/Baileys Bridge hat einen Live-Queue-Endpunkt `/messages`, aber keinen stabilen `/history?since=...` Endpunkt.
- Deshalb ist „letzte 2 Tage“ als **Experiment** umgesetzt, nicht als Garantie.
- Wenn Baileys später einen stabilen History-Zugriff liefert, wird dieser Modus im Worker erweitert, ohne UI/Datenmodell zu ändern.

Empfohlene lokale Automatisierung:

- Worker jede Minute lokal laufen lassen, damit Dashboard-Button-Runs zeitnah verarbeitet werden.
- Der Worker bleibt still, wenn keine queued Runs existieren.
- WhatsApp-Bridge wird nur während eines aktiven Runs gestartet und danach beendet.

## WhatsApp-Regeln

- Status/Broadcast standardmäßig ignorieren
- Gruppen standardmäßig ignorieren oder separat freigeben
- Read receipts auslassen, solange wir nur beobachten
- Reply-Aktionen aus Private OS ohne Hermes-Agent-Prefix senden
- Remote-Löschen:
  - `delete_local`: im Private OS ausblenden
  - `delete_remote`: aktuell absichtlich als Fehler markiert, bis Baileys-Delete sicher implementiert und getestet ist
