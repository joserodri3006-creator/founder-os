-- Sentinel-Manager und Portfolioeintrag.
-- Voraussetzung: 20261119_add_sentinel_venture.sql wurde erfolgreich
-- ausgeführt und der Enum-Wert 'sentinel' ist committed.

UPDATE public.user_venture_roles
SET
  role = 'manager',
  permissions = '{"leads":"edit","customers":"edit","orders":"edit","products":"edit","drafts":"edit","invoices":"edit","settings":"edit","reviews":"edit"}'::jsonb
WHERE user_id = '1a996185-21dc-49ad-bbb0-beb246da85d2'::uuid
  AND venture = 'sentinel'::venture;

INSERT INTO public.user_venture_roles (user_id, venture, role, permissions)
SELECT
  '1a996185-21dc-49ad-bbb0-beb246da85d2'::uuid,
  'sentinel'::venture,
  'manager',
  '{"leads":"edit","customers":"edit","orders":"edit","products":"edit","drafts":"edit","invoices":"edit","settings":"edit","reviews":"edit"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_venture_roles
  WHERE user_id = '1a996185-21dc-49ad-bbb0-beb246da85d2'::uuid
    AND venture = 'sentinel'::venture
);

UPDATE public.portfolio_projects
SET
  area = 'Kundenprojekt / CRM',
  venture = 'sentinel',
  use_case = 'Branchenspezifisches CRM und digitale Sachbearbeitung für Versicherungsvertrieb.',
  audience = 'Versicherungsmakler und vertriebsgetriebene Teams',
  status = 'development',
  visibility = 'Intern / Kundenprojekt',
  portfolio_relevance = 'A - laufendes Kundenprojekt',
  role = 'Konzeption, Produktstrategie, Umsetzung und Betrieb',
  tech_stack = 'Next.js, Supabase, Vercel, Google Drive, KI-Worker',
  url = 'https://sentinellogic.vercel.app',
  link_check = 'Technisch vorhanden',
  next_step = 'Founder-OS-Aufgaben und Kundenprojektstatus getrennt weiterführen.',
  notes = 'Sentinel bleibt fachlich und datenbankseitig ein Kundenprojekt; die Venture-Zuordnung dient der Founder-OS-Steuerung.',
  is_archived = false,
  updated_at = now()
WHERE name IN ('SentinelLogic', 'Sentinel Logic');

INSERT INTO public.portfolio_projects (
  name, area, venture, use_case, audience, status, visibility,
  portfolio_relevance, role, tech_stack, url, link_check, next_step,
  notes, is_archived, updated_at
)
SELECT
  'Sentinel Logic', 'Kundenprojekt / CRM', 'sentinel',
  'Branchenspezifisches CRM und digitale Sachbearbeitung für Versicherungsvertrieb.',
  'Versicherungsmakler und vertriebsgetriebene Teams', 'development',
  'Intern / Kundenprojekt', 'A - laufendes Kundenprojekt',
  'Konzeption, Produktstrategie, Umsetzung und Betrieb',
  'Next.js, Supabase, Vercel, Google Drive, KI-Worker',
  'https://sentinellogic.vercel.app', 'Technisch vorhanden',
  'Founder-OS-Aufgaben und Kundenprojektstatus getrennt weiterführen.',
  'Sentinel bleibt fachlich und datenbankseitig ein Kundenprojekt; die Venture-Zuordnung dient der Founder-OS-Steuerung.',
  false, now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.portfolio_projects WHERE name IN ('SentinelLogic', 'Sentinel Logic')
);
