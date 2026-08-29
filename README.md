# ✈️ Flight Price Tracker

A resume-friendly full-stack project: users sign up, search real flight
prices, track a route at a target price, and get emailed automatically when
the price drops. No booking, no payments, no ORM middleman — just Next.js
talking directly to Supabase.

## Tech stack

| Part                 | Technology                              |
| --------------------- | ---------------------------------------- |
| Frontend              | Next.js 14 (App Router) + React          |
| Styling               | Tailwind CSS                             |
| Auth                  | Supabase Auth (email/password + Google)  |
| Database              | Supabase PostgreSQL, queried directly via `supabase-js` (no ORM) |
| Security              | Row Level Security (Postgres) + server-side ownership checks |
| Flight data           | RapidAPI "Flights Sky" (Skyscanner scraper) — free tier |
| Airport autocomplete  | Static local dataset (`data/airports.json`) |
| Chart                 | Recharts                                 |
| Email                 | Resend                                   |
| Scheduled checks      | node-cron (`scripts/checkPrices.js`)     |

**Why RapidAPI instead of a "real" flight API?** Amadeus's free Self-Service
sandbox shut down in July 2026, and Skyscanner/most GDS providers require a
formal travel-partner agreement. RapidAPI's "Flights Sky" wrapper is an
**unofficial scraper** — it's free and returns genuinely real prices, but
it's loosely documented, so `lib/rapidapi-flights.js` parses its response
defensively (checking a few plausible field paths) rather than assuming one
exact shape. **Why no Prisma?** Since the app already uses Supabase for
auth, querying its Postgres directly via `supabase-js` removes a whole
layer, and lets Row Level Security do real security work instead of just
app-code checks.

## How it works

```
User lands on Home
      ↓
Sign up / Log in (Supabase Auth)
      ↓
Search (From/To autocomplete, dates)
      ↓
Results — live-scraped fares from RapidAPI's Flights Sky
      ↓
Track Price (set a target) → row in Postgres, owned by your user_id
      ↓
Dashboard — shows ONLY your tracked flights (enforced by RLS + app code)
      ↓
Check Price Now (manual) or scheduled job (every 6h)
      ↓
Price < target → email alert via Resend
      ↓
History page — price-over-time chart with your target as a reference line
```

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. **Settings → API** → copy the **Project URL**, the **anon public** key,
   and the **service_role** key (secret — server-only).
3. **SQL Editor → New query** → paste the entire contents of
   `supabase/schema.sql` → **Run**. This creates `tracked_flights` and
   `price_history`, and turns on the Row Level Security policies that keep
   each user's data private.
4. *(Optional)* **Authentication → Providers → Google**, if you want the
   "Continue with Google" button to work.

## 2. Get a free RapidAPI key

1. Sign up at [rapidapi.com](https://rapidapi.com).
2. Search for **"Flights Sky"** (host: `flights-sky.p.rapidapi.com`) →
   **Subscribe** to the free/basic plan.
3. Copy your API key from the code snippet panel on that page.
4. **Keep this key private.** If it's ever pasted somewhere public (a chat,
   a public repo, a screenshot), regenerate it immediately from your
   RapidAPI dashboard → My Apps → Security.

## 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # secret, used only by scripts/checkPrices.js

RAPIDAPI_KEY=...
RAPIDAPI_HOST=flights-sky.p.rapidapi.com
USE_MOCK_FLIGHTS=false               # set true only for UI work without a key

EMAIL_API_KEY=...                    # optional — see step 5
EMAIL_FROM="FlightTracker <alerts@yourdomain.com>"
```

`.env` is already git-ignored — never commit it.

## 4. Install and run

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Sign up**, confirm the email Supabase
sends you, log in, then search a route and click **Track Price**.

## 5. Email alerts (optional but recommended)

Create a free account at [resend.com](https://resend.com), verify a sending
domain (or use their sandbox domain for testing), and set `EMAIL_API_KEY` /
`EMAIL_FROM` in `.env`. Without it, price-drop "emails" are just logged to
the server console.

## 6. Automatic price checks

**Local development:**
```bash
npm run check:prices            # run once, right now
npm run check:prices -- --watch # run once now, then every 6 hours
```
Requires a terminal/process that stays running — fine for local testing,
not for production (see below).

**In production (Vercel Cron):** `app/api/cron/check-prices/route.js` does
the same check, but as a serverless route that Vercel triggers on a
schedule — no always-on process needed.

1. Generate a random secret: `openssl rand -hex 32` (or any random string).
2. In Vercel: **Settings → Environment Variables** → add `CRON_SECRET` with
   that value.
3. `vercel.json` already schedules it for **02:30 UTC daily** (≈ 8:00 AM
   IST) — edit the `schedule` field there to change the time.
4. **Vercel's free Hobby plan caps cron jobs at once per day** — a more
   frequent schedule will fail to deploy. If you need true 6-hourly checks
   without upgrading to Pro, point a free external scheduler (e.g. a GitHub
   Actions workflow on a cron trigger) at
   `https://your-domain.vercel.app/api/cron/check-prices` with an
   `Authorization: Bearer <CRON_SECRET>` header instead of using
   `vercel.json`'s `crons` field — say the word if you want that built.
5. Redeploy. Vercel registers the schedule automatically; check
   **Deployments → Cron Jobs** in your project to confirm it's listed and
   see run history.

## Demo mode (no RapidAPI key yet)

Set `USE_MOCK_FLIGHTS=true` to see the search/results UI with realistic mock
prices without a RapidAPI key. Login, signup, and the dashboard still need a
real Supabase project either way — mock mode only replaces the flight-search
call.

## Project structure

```
flight-price-tracker/
├── app/
│   ├── page.js                      # Home / search form
│   ├── login/page.js + components/LoginForm.js  # Log in
│   ├── signup/page.js               # Sign up
│   ├── auth/callback/route.js       # OAuth / email-confirm callback
│   ├── search/page.js               # Search results
│   ├── dashboard/page.js            # Tracked flights (current user only)
│   ├── history/[id]/page.js         # Price history + chart
│   └── api/
│       ├── flights/route.js              # GET  /api/flights
│       ├── tracked/route.js              # GET+POST /api/tracked (session-scoped)
│       ├── tracked/[id]/route.js         # GET+DELETE /api/tracked/:id
│       ├── prices/[id]/route.js          # POST /api/prices/:id ("Check Price Now")
│       └── cron/check-prices/route.js    # GET, called by Vercel Cron — checks all users' flights
├── components/
│   ├── Navbar.js                    # Session-aware nav + logout
│   ├── AirportAutocomplete.js       # Local airport search dropdown
│   ├── SearchForm.js
│   ├── FlightCard.js / FlightList.js
│   ├── TrackedFlightCard.js / DashboardList.js
│   ├── PriceChart.js
│   └── Footer.js
├── lib/
│   ├── supabase/client.js           # Browser Supabase client (auth)
│   ├── supabase/server.js           # Server Supabase client + getAuthedUser() — session-scoped
│   ├── supabase/admin.js            # Service-role client — cron route only, bypasses RLS on purpose
│   ├── rapidapi-flights.js          # Flight search — no silent mock fallback
│   └── email.js                     # Resend wrapper + console fallback
├── data/airports.json               # Static airport list for autocomplete
├── supabase/schema.sql              # Tables + RLS policies — run once in SQL Editor
├── scripts/checkPrices.js           # Local scheduled job (every 6h) / one-off run
├── vercel.json                      # Production cron schedule (once/day on Hobby)
├── middleware.js                    # Session check — scoped to /dashboard & /history only
└── .env.example
```

## Known limitations of the RapidAPI integration

Because "Flights Sky" is an unofficial scraper rather than an official
partner API, `lib/rapidapi-flights.js` parses its JSON response defensively
— trying a few plausible field paths for the itinerary list and price,
rather than hard-coding one exact structure. If you see empty results in
production, check Vercel's function logs for the raw response shape; the
field-path list at the top of `extractItineraries()` and `mapItinerary()`
is the place to adjust if the live API differs from what's coded. This is
expected occasional maintenance for an unofficial API, not a sign something
is fundamentally broken.

## Bug fixes worth knowing about (useful in an interview)

- **Login/logout appeared to "hang" on the same page.** The original code
  called `router.push(next)` immediately followed by `router.refresh()`.
  These two App Router calls can race — `refresh()` can re-fetch the *old*
  route instead of the one just pushed to. Fixed by using a full
  `window.location.assign(...)` navigation instead, which guarantees the
  next page is requested fresh from the server with the new session cookie
  already attached.
- **Site felt slow on every page, not just protected ones.** The original
  `middleware.js` matcher excluded only static assets, so it ran a network
  round-trip to Supabase's auth server on *every* request — including the
  public Home page, which doesn't need auth at all. Fixed by scoping the
  middleware's `matcher` to only `/dashboard/:path*` and `/history/:path*`.

## Security notes

- Every API route calls `getAuthedUser()`, which reads the verified
  Supabase session server-side — never a client-supplied id.
- Ownership is enforced twice: in API route code, and by Row Level Security
  policies in `supabase/schema.sql`.
- `middleware.js` redirects unauthenticated visitors away from
  `/dashboard` and `/history/*` before the page even renders.
- No silent mock fallback — if `USE_MOCK_FLIGHTS=false` and the real API
  call fails, you get a real error, not a realistic-looking fake price.
- `SUPABASE_SERVICE_ROLE_KEY` is only ever used in `scripts/checkPrices.js`,
  never in the Next.js app or anything shipped to the browser.

## Deliberately left out

Flight booking, payments, seat selection, an admin panel, hotel booking,
maps, an AI chatbot, and push/SMS notifications — out of scope by design.

## Deploying (GitHub → Vercel + Supabase)

- **App**: push to GitHub → import into [Vercel](https://vercel.com) → add
  the same env vars from `.env` → deploy.
- **Database & Auth**: already on Supabase — point Vercel at the same
  project.
- **After deploying**: in Supabase → Authentication → URL Configuration,
  set Site URL and add `https://your-domain.vercel.app/auth/callback` to
  Redirect URLs, or login/signup email links will point at `localhost`.
- **Scheduled checks**: already built — see "Automatic price checks" above.
  Just set `CRON_SECRET` in Vercel's environment variables and redeploy.
