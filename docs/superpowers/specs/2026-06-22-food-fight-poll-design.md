# punchyaf.cc/food-fight — Polish Food Fight Poll

**Date:** 2026-06-22
**Status:** Implemented.

> **Amendment (2026-06-22):** the server-side hashed-IP throttle was **removed**
> after review — on shared/CGNAT IPs it suppressed legitimate votes. The
> `voters` table, IP hashing, and the 6h-window/409 logic described below are
> superseded; abuse prevention is now the client-side localStorage flag only.

## Summary

A fun, shareable single-page poll at `https://punchyaf.cc/food-fight/` asking
visitors to vote for the "best" of four Polish dishes that famously horrify
tourists: **kaszanka** (blood sausage), **czernina** (duck blood soup),
**flaki** (tripe soup), and **wątróbka** (liver). Votes aggregate into a real,
shared, global tally that everyone sees as a live leaderboard.

The page is added to the existing `gpx-analyzer` repo (which deploys
`punchyaf.cc` via **Cloudflare Pages**) and reuses the site's dark/lime terminal
aesthetic.

## Goals

- Real cross-user vote counting (not client-only).
- Playful tone; results presented as a live leaderboard ("who's winning").
- Shareable: a one-tap share/copy-link action.
- Light, best-effort abuse prevention appropriate for a joke poll.
- Self-contained: does not modify `index.html`, `build.js`, or existing pages.

## Non-Goals (YAGNI)

- Hardened one-vote-per-person enforcement / auth / captcha.
- Adding new dishes at runtime, comments, or per-dish blurbs.
- Analytics dashboards or admin UI.

## Context

- Host: **Cloudflare Pages**, wired to the GitHub repo via the Cloudflare
  dashboard (auto-deploys on push to `master`). Confirmed via live headers
  (`server: cloudflare`, `cf-cache-status: DYNAMIC`) and absence of GitHub Pages
  / CNAME / CI config in the repo.
- Repo serves static files from root. Existing example subpage:
  `sudovia-ride100.html` → `/sudovia-ride100.html`.
- Palette (from `styles.css`): `--bg:#0a0c0a`, `--panel:#11140f`,
  `--card:#161a14`, `--border:#1f2418`, `--border-hi:#2d3424`,
  `--text:#d4d8c8`, `--text-dim:#7a7f6e`, `--accent:#c8ff5a`; fonts JetBrains
  Mono (body) + Inter Tight (display); sharp corners (border-radius 0).

## Architecture

### URL & files

- `food-fight/index.html` → served at `/food-fight/` (clean URL).
- `/functions` directory at repo root holds **Cloudflare Pages Functions**
  (auto-detected by Pages on deploy):
  - `functions/api/votes.js` — `GET /api/votes`
  - `functions/api/vote.js` — `POST /api/vote`
- The page is self-contained (inline CSS/JS), reusing the palette via copied
  CSS custom properties so it is independent of `styles.css`.

### Storage — Cloudflare D1

Chosen over KV because KV has no atomic increment (concurrent read-modify-write
races silently lose votes). D1 (Cloudflare's serverless SQLite, free tier)
supports atomic `UPDATE ... SET count = count + 1`.

Binding: a D1 database bound as `DB` in the Pages project settings.

Schema:

```sql
CREATE TABLE dishes (
  slug  TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE voters (
  ip_hash TEXT PRIMARY KEY,
  ts      INTEGER NOT NULL   -- unix seconds of last accepted vote
);
```

Seed data:

| slug      | label    | emoji |
|-----------|----------|-------|
| kaszanka  | kaszanka | 🩸    |
| czernina  | czernina | 🦆    |
| flaki     | flaki    | 🫃    |
| watrobka  | wątróbka | 🫀    |

(Dish display order in the ballot is fixed; results are sorted by `count` desc.)

### API

**`GET /api/votes`**
Response `200`:
```json
{
  "total": 1284,
  "dishes": [
    {"slug":"kaszanka","label":"kaszanka","emoji":"🩸","count":527,"pct":41}
  ]
}
```
`pct` is integer percent of `total` (0 when `total` is 0). `dishes` returned
sorted by `count` descending.

**`POST /api/vote`**
Body: `{"slug":"kaszanka"}`.
- Validates `slug` is one of the four seeded slugs → else `400`.
- Best-effort throttle: compute `ip_hash` (see below). If a `voters` row exists
  with `ts` within the last 6 hours → `409` (client treats as "already voted",
  shows current results).
- Otherwise: atomic increment of that dish's `count`, upsert the `voters` row
  with current timestamp, return the same shape as `GET /api/votes` (`200`).

## Voting Flow (Layout B — vertical ballot + inline bars)

1. On load, `GET /api/votes`.
2. If `localStorage["foodfight.voted"]` is absent → render four tappable
   full-width ballot rows (emoji + dish name), in fixed order.
3. If present → skip directly to the results view.
4. Tapping a row → `POST /api/vote` with that slug.
   - On success/409: set `localStorage["foodfight.voted"] = slug`, then animate
     the rows into the results view: rows re-sorted by count, each filling
     left-to-right (`--accent` translucent fill + right border) to its `pct`,
     showing `pct%` and the running "VOTES **N**" total.
5. **Share** button: `navigator.share({url})` where available (mobile);
   otherwise copy link to clipboard and show a brief toast.

### Results view details

- Header: kicker `punchyaf.cc / vote`, display title `POLISH FOOD FIGHT`
  (FIGHT in accent), short hook line.
- Each result row: fill bar, emoji, label, percent. Bars animate width on
  reveal.
- Footer: `VOTES <total>` (accent) on the left, `SHARE ↗` button on the right.

## Error Handling

- `GET /api/votes` fails → render the page shell, disable voting, show a quiet
  inline "results unavailable" line. No broken page.
- `POST /api/vote` network error → keep ballot interactive, show a small retry
  hint; do not set the voted flag.
- Invalid/missing slug → `400`. Duplicate within throttle window → `409`; client
  silently transitions to results.
- All API responses JSON with appropriate status codes and
  `content-type: application/json`.

### IP hashing (privacy)

- Source IP from `request.headers.get("CF-Connecting-IP")`.
- `ip_hash = hex(SHA-256(ip + server-side salt))`. Raw IP is never stored.
- Salt is a constant in the function module (sufficient for a joke poll; not a
  secret-management concern at this stakes level).

## Testing

- Unit tests (Vitest, run via the locally installed Node) for:
  - `pct` computation incl. zero-total.
  - slug validation (accept the 4, reject others / missing).
  - throttle logic (within vs outside the 6h window).
  - response shapes / status codes.
- Logic that touches D1 is factored so the SQL-executing layer is thin and the
  pure logic is unit-testable without a live D1.
- Manual end-to-end via `wrangler pages dev` with a local D1 before deploy.

## Deployment Notes

- Push to `master` triggers Cloudflare Pages build. No build command needed for
  the static page; `/functions` is auto-detected.
- One-time manual setup in the Cloudflare dashboard: create a D1 database, run
  the schema + seed SQL, and add the `DB` binding to the Pages project
  (Production + Preview). Exact CLI/dashboard steps to be included in the
  implementation plan.
- Add a `<url>` entry for `/food-fight/` to `sitemap.xml`.

## Open Decisions (resolved)

- Storage: **D1** (over KV) for atomic counting.
- URL: **`/food-fight/`**.
- Layout: **B** (vertical ballot → inline leaderboard bars).
- Features in scope: live results, share button, total votes counter.
  (Per-dish comedic blurbs intentionally excluded.)
