# Online First Google Lead Search

## Delivered On 2026-05-26

Founder OS now provides a manual lead-research workflow for selling the
`Authority Website Sprint` to coaches, consultants and experts.

## Workflow

1. In `/leads`, open `Google Leads suchen`; the action is visible regardless
   of the currently selected venture.
2. Choose a region such as `Hessen`, a target segment and an optional
   specialization.
3. `POST /api/leads/google-search` requests up to ten results from Google's
   official Custom Search JSON API.
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

Provide these server-side environment values in Vercel and local `.env.local`:

```text
GOOGLE_CUSTOM_SEARCH_API_KEY=...
GOOGLE_CUSTOM_SEARCH_ENGINE_ID=...
```

Set up a Google Programmable Search Engine for web results and enable the Custom
Search JSON API for the Google Cloud project owning the API key. Keys must never
be exposed via `NEXT_PUBLIC_*`, committed to the repository or stored in browser
configuration.

Google's documented service requires the API key and Programmable Search Engine
ID and returns results through its REST JSON interface. Google documents a daily
free quota and paid usage beyond that quota; check the current quota and billing
settings before enabling repeated prospecting.

Official reference:
<https://developers.google.com/custom-search/v1/overview?hl=de>

## Existing Automation

The earlier `supabase/functions/ki-lead-search` scheduled Claude-based research
remains unchanged. This new workflow is an on-demand, user-reviewed Google search
inside the CRM and does not turn on automated outreach for imported prospects.
