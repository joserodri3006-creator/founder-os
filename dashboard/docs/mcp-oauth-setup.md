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

The authorization page requires the Founder OS founder account. Only users with
role `founder` can authorize access.

Available MCP tools:

- `list_leads`
- `create_lead`
- `batch_create_leads`
- `get_lead`
- `update_lead`
- `pipeline_stats`

ChatGPT should use `batch_create_leads` for researched lead lists instead of Excel.

## Sicherheit und Betrieb

- `/mcp`, `/oauth/*` und `/.well-known/*` sind im Login-Schutz (`proxy.ts`) bewusst öffentlich, weil externe Clients ohne Founder-OS-Session ankommen. `/mcp` verlangt einen gültigen Bearer-Token (JWT, 1 Stunde), `/oauth/authorize` das Founder-Passwort. Ohne Token kommt ein 401 mit `resource_metadata`.
- Die Client-Registrierung (`/oauth/register`) ist ohne Anmeldung möglich und akzeptiert deshalb nur https-Redirects auf `chatgpt.com`, `chat.openai.com`, `platform.openai.com`, `claude.ai` und `claude.com`. Weitere Clients: Liste `ALLOWED_HOSTS` in `app/oauth/register/route.ts` erweitern.
- Der Zugriff gilt für das ganze Founder-OS-Lead-CRM aller Ventures. Widerruf: Tabelle `mcp_oauth_clients` leeren oder `MCP_OAUTH_SECRET` ändern (macht alle Tokens ungültig).
- `NEXT_PUBLIC_SITE_URL` wird ohne abschließenden Schrägstrich normalisiert.
- Getestet (Okt 2026): Discovery, Registrierung (gut und böse), PKCE-Ablauf, falsches Passwort, Code-Wiederverwendung, alle 6 Tools, ungültiger Token.
- Offen: Ein Refresh-Token gibt es nicht, nach 1 Stunde ist eine neue Anmeldung nötig. Tools decken nur Leads ab (Aufträge, Kunden, Bewertungen, Aufgaben fehlen).
