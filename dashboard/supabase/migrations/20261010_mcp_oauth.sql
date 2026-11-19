-- OAuth storage for ChatGPT's custom MCP plugin connection.
CREATE TABLE IF NOT EXISTS mcp_oauth_clients (
  client_id TEXT PRIMARY KEY,
  client_name TEXT,
  redirect_uris JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mcp_oauth_codes (
  code_hash TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES mcp_oauth_clients(client_id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method TEXT NOT NULL DEFAULT 'S256',
  resource TEXT NOT NULL DEFAULT 'https://founder-os-theta.vercel.app/mcp',
  user_id UUID NOT NULL,
  scope TEXT NOT NULL DEFAULT 'tasks:read tasks:write',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
ALTER TABLE mcp_oauth_codes ADD COLUMN IF NOT EXISTS code_challenge_method TEXT NOT NULL DEFAULT 'S256';
ALTER TABLE mcp_oauth_codes ADD COLUMN IF NOT EXISTS resource TEXT NOT NULL DEFAULT 'https://founder-os-theta.vercel.app/mcp';
ALTER TABLE mcp_oauth_codes ALTER COLUMN scope SET DEFAULT 'tasks:read tasks:write';
CREATE INDEX IF NOT EXISTS idx_mcp_oauth_codes_expiry ON mcp_oauth_codes(expires_at);


ALTER TABLE mcp_oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE mcp_oauth_codes ENABLE ROW LEVEL SECURITY;
