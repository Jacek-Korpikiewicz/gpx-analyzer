# Food Fight poll — Cloudflare setup (one-time)

The page (`/food-fight/`) and API (`/functions/api/*`) deploy automatically when
you push to `master`. The only manual step is creating the D1 database and
binding it to the Pages project as `DB`.

## 1. Create the D1 database

```bash
npx wrangler d1 create foodfight
```

Note the printed `database_id`.

## 2. Apply the schema + seed

Local (for `wrangler pages dev`):

```bash
npx wrangler d1 execute foodfight --local --file=db/schema.sql
```

Remote (production):

```bash
npx wrangler d1 execute foodfight --remote --file=db/schema.sql
```

## 3. Bind it to the Pages project

Cloudflare dashboard → your Pages project → **Settings → Functions → D1 database
bindings** → add a binding:

- Variable name: `DB`
- D1 database: `foodfight`

Add it for **both** Production and Preview environments. Redeploy (or push) so the
binding takes effect.

## Local development

`wrangler.toml` is git-ignored (it holds a fake local `database_id`). To run
locally:

```bash
npx wrangler d1 execute DB --local --file=db/schema.sql   # seed once
npx wrangler pages dev --port 8788                         # serve + functions
# → http://localhost:8788/food-fight/
```

## Resetting counts

```bash
npx wrangler d1 execute foodfight --remote --command "UPDATE dishes SET count = 0;"
```
