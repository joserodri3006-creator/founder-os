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

Select OAuth. ChatGPT discovers:

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
