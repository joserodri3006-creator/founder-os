-- Allow Blazed Instagram DMs to be mirrored into the operational Founder OS inbox.
ALTER TABLE inbox_messages
  DROP CONSTRAINT IF EXISTS inbox_messages_provider_check;

ALTER TABLE inbox_messages
  ADD CONSTRAINT inbox_messages_provider_check
  CHECK (provider IN ('imap', 'gmail', 'instagram'));
