-- Close direct PostgREST access to internal tables.
-- Server-side API routes use the service role and continue to work.
-- user_venture_roles retains its existing authenticated SELECT policy (own_roles).

ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_venture_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_os_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_os_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_os_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_os_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_os_message_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.private_os_whatsapp_sync_runs ENABLE ROW LEVEL SECURITY;
