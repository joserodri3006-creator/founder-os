# Agenten- und Automationsinventar (Live-Import verifiziert)

Quelle: `/opt/data/cron/jobs.json`
Erstellt aus 38 Cron-/Automation-Einträgen.

## Zusammenfassung

- Aktiv: 35
- Fehlerstatus: 10
- Manuelle Zuordnung erforderlich: 0

## Vorläufige Verteilung

### Scope
- `client_project`: 10
- `personal`: 3
- `portfolio`: 2
- `review_required`: 2
- `shared_service`: 4
- `venture`: 19

### Typ
- `ai_agent`: 18
- `manager_agent`: 3
- `script`: 9
- `worker`: 8

### Status
- `active`: 35
- `paused`: 1
- `retired`: 2

## Regeln

- Sentinel und seine Worker werden als separates `client_project` geführt.
- Founder-OS-, Portfolio-, persönliche und Shared-Service-Prozesse erhalten keinen Venture-Ersatzwert.
- Itaba und PerreoZone bleiben bis zur Bestätigung `review_required`.
- `no_agent=true` wird als Script oder Worker klassifiziert; ein Cronjob ist nur der Trigger.
- `last_status=error` wird getrennt vom fachlichen Registry-Status dokumentiert.

## Kundenprojekte mit geteilter technischer Datenhaltung

- Itaba: eigenes Kundenprojekt, Scope `client_project`, getrennt von Online First.
- PerreoZone: eigenes Kundenprojekt, Scope `client_project`, getrennt von Online First.
- Beide teilen derzeit technische Datenhaltung mit den Founder-OS-Ventures; das ändert nicht Eigentümer, Verantwortlichkeit oder Agenten-Scope.

## Vollständige Detaildaten

Die maschinenlesbare Zuordnung liegt in `agent-registry-inventory-draft.json`. Alle 38 Einträge wurden idempotent in `public.agent_registry` importiert und per Supabase-REST verifiziert.
