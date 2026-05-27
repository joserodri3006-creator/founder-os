# Online First Google Lead Search

## Delivered On 2026-05-26

Founder OS now provides a manual lead-research workflow for selling the
`Authority Website Sprint` to coaches, consultants and experts.

## Workflow

1. In `/leads`, open `Google Leads suchen`; the action is visible regardless
   of the currently selected venture.
2. Choose a region such as `Hessen`, a target segment and an optional
   specialization.
3. `POST /api/leads/google-search` requests up to ten Google results through
   Serper. Existing grandfathered Google Custom Search credentials remain a
   fallback only.
4. The user reviews the websites, selects suitable candidates, supplies a
   contact person and business email, and explicitly confirms that both were
   checked on the public website.
5. Selected records are created for the `Online First` venture through the
   existing `/api/leads` endpoint with source `ki_suche`, a Google-research
   note and `automation_enabled=false`.

Google results are deliberately not imported as immediately contactable leads
without reviewed contact data. Search snippets are research context, not consent
or verification for outreach.

## Required Configuration

Provide this server-side environment value in Vercel and local `.env.local`:

```text
SERPER_API_KEY=...
```

Create the key in Serper and store it only server-side. Keys must never be
exposed via `NEXT_PUBLIC_*`, committed to the repository or stored in browser
configuration.

The former implementation used Google Custom Search JSON API. Google now states
that this API is closed to new customers and existing customers must migrate by
January 1, 2027. If grandfathered credentials are already available, Founder OS
still accepts `GOOGLE_CUSTOM_SEARCH_API_KEY` and
`GOOGLE_CUSTOM_SEARCH_ENGINE_ID` as a fallback when `SERPER_API_KEY` is absent.

Official reference:
<https://developers.google.com/custom-search/v1/overview?hl=de>

Serper:
<https://serper.dev/>

## Existing Automation

The earlier `supabase/functions/ki-lead-search` scheduled Claude-based research
remains unchanged. This new workflow is an on-demand, user-reviewed Google search
inside the CRM and does not turn on automated outreach for imported prospects.
