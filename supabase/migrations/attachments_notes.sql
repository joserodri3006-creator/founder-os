-- Add notes to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add notes to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;

-- Attachments table
-- NOTE: Before running this migration, create a Supabase Storage bucket named "attachments"
-- via Supabase Dashboard → Storage → New bucket → name: "attachments", public: false
CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('order','customer','product')),
  entity_id UUID NOT NULL,
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  description TEXT,
  size_bytes BIGINT,
  mime_type TEXT,
  venture venture,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id);
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;
