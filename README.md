# OpsPilot: AI Request Triage

OpsPilot turns messy, plain-English requests from store employees and customers into organized, prioritized work.
Someone types "the froyo machine at store 12 is leaking." The AI classifies it, sets a priority, routes it to the right
team, writes next steps, and drafts a reply. Every request lands in a live queue sorted by urgency.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · Claude API · Deployed on Vercel

## How it works

```
Browser (page.tsx)  ──POST /api/triage──▶  API route (route.ts)  ──▶  Claude API
        ▲                                         │
        └────────── JSON triage result ◀──────────┘  (falls back to rule engine if no key / error)
```

| File | What it does |
|---|---|
| `src/app/page.tsx` | The dashboard: intake form, triage result card, filterable request queue, stats. Client component. |
| `src/app/api/triage/route.ts` | Server endpoint. Validates input, calls the AI, falls back to demo mode. The API key stays on the server and never reaches the browser. |
| `src/lib/triage.ts` | The two triage engines. `triageWithAI` sends a structured prompt and asks for strict JSON, then **validates every field** so bad model output can't break the app. `triageDemo` is a keyword-scoring engine so the site works without an API key. |
| `src/lib/types.ts` | Shared TypeScript types (`TriageResult`, `Ticket`) used by both the server and the UI. |

## Design decisions (good interview talking points)

- **Structured output:** the prompt asks for JSON with fixed allowed values, and the code checks them. That makes AI output reliable enough to automate on.
- **Graceful fallback:** if the AI is down or there's no key, the app still works using the rule engine.
- **Security:** the API key is only read on the server (`process.env`), never sent to the browser.
- **Input limits:** requests are capped at 2,000 characters to control cost and abuse.
- **Persistence:** the queue is saved in the browser (localStorage) for the demo. In production I'd swap in a database (Postgres via Vercel/Supabase) and add auth.

## Run locally

```bash
npm install
npm run dev        # open http://localhost:3000
```

To turn on live AI, create `.env.local`:

```
ANTHROPIC_API_KEY=your-key-here
```

## Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel, click **Add New → Project** and import the repo (it auto-detects Next.js).
3. Optional: add `ANTHROPIC_API_KEY` under **Settings → Environment Variables**, then redeploy.

## What I'd build next

- Database + login so a team can share one queue
- Email/SMS alerts for Urgent tickets (e.g. Twilio)
- Slack or Teams integration to post routed tickets to each team's channel
- Analytics: requests by store, category, and time to resolve
