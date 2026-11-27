# Founder OS OAuth-MCP-Server

## Vercel Environment Variables

Required:

```text
MCP_OAUTH_SECRET=<openssl rand -base64 48>
NEXT_PUBLIC_SITE_URL=https://<deine-founder-os-domain>
```

The existing Supabase variables are also required:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

## One-time database migration

Run this file in the Supabase SQL Editor before connecting ChatGPT:

```text
supabase/migrations/20261010_mcp_oauth.sql
```

It creates `mcp_oauth_clients` and `mcp_oauth_codes`.

## ChatGPT Plugin / MCP connection

Use this Server URL in the ChatGPT “Neues Plugin” dialog:

```text
https://<deine-founder-os-domain>/mcp
```

Select OAuth. Claude (claude.ai) funktioniert mit derselben URL. ChatGPT discovers:

```text
/.well-known/oauth-protected-resource/mcp
/.well-known/oauth-authorization-server
/oauth/register
/oauth/authorize
/oauth/token
```

The server advertises task access for the intended integration:

```text
tasks:read tasks:write
```

Lead/CRM scopes remain supported for separately authorized clients, but are not part of the default task-management grant. The authorization and token requests must carry the exact resource `https://<founder-os-domain>/mcp`, the registered redirect URI byte-for-byte, and PKCE `S256`. The token endpoint accepts `application/x-www-form-urlencoded` and JSON bodies, plus public-client `none` and Basic client-id variants.

Available MCP tools:

- `list_tasks` — Aufgaben lesen und nach Venture, Status, Lead/Kunde oder Verantwortlichem filtern
- `create_task` — Aufgaben sofort anlegen
- `update_task` — Aufgaben sofort bearbeiten und Status ändern
- `delete_task` — Aufgaben sofort löschen
- `get_lead`
- `update_lead`
- `pipeline_stats`

ChatGPT should use `batch_create_leads` for researched lead lists instead of Excel.

## Sicherheit und Betrieb

- `/mcp`, `/oauth/*` und `/.well-known/*` sind im Login-Schutz (`proxy.ts`) bewusst öffentlich, weil externe Clients ohne Founder-OS-Session ankommen. `/mcp` verlangt einen gültigen Bearer-Token (JWT, 1 Stunde), `/oauth/authorize` das Founder-Passwort. Ohne Token kommt ein 401 mit `resource_metadata`.
- Die Client-Registrierung (`/oauth/register`) ist ohne Anmeldung möglich und akzeptiert deshalb nur https-Redirects auf `chatgpt.com`, `chat.openai.com`, `platform.openai.com`, `claude.ai` und `claude.com`. Weitere Clients: Liste `ALLOWED_HOSTS` in `app/oauth/register/route.ts` erweitern.
- Jeder Benutzer autorisiert sich mit seinem eigenen Founder-OS-Login. Der Server liest bei jeder MCP-Anfrage die aktuellen Einträge aus `user_venture_roles` und erlaubt nur die dort zugewiesenen Ventures und Bereiche. Founder behalten ventureübergreifenden Zugriff.
- Anonymer MCP-Zugriff ist grundsätzlich deaktiviert. Ein optionaler statischer Token funktioniert nur zusammen mit einer expliziten `MCP_STATIC_USER_ID`; auch dann gelten deren aktuelle Venture- und Bereichsrechte.
- Widerruf: Benutzerrolle in `user_venture_roles` entfernen. Für einen globalen Widerruf `MCP_OAUTH_SECRET` ändern (macht alle OAuth-Tokens ungültig) und optional `mcp_oauth_clients` leeren.
- `NEXT_PUBLIC_SITE_URL` wird ohne abschließenden Schrägstrich normalisiert.
- OAuth-Discovery, Registrierung, PKCE-S256, Resource-Bindung, exakte Redirect-URI-Prüfung und Code-Wiederverwendung sind durch Regressionstests abgedeckt.
- Die vier Task-Tools prüfen zusätzlich die Claims `tasks:read` bzw. `tasks:write`; ein Token mit zu engem Scope kann keine Schreiboperation ausführen.
- Offen: Ein Refresh-Token gibt es nicht, nach 1 Stunde ist eine neue Anmeldung nötig.
