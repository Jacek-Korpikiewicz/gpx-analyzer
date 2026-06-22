import {
  buildResponse,
  isValidSlug,
  isThrottled,
  hashIp,
} from '../../shared/poll.js';

// Constant salt is sufficient at this stakes level — see design spec.
const SALT = 'punchyaf-food-fight-v1';

// POST /api/vote  body: {"slug":"kaszanka"}
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  const slug = body && body.slug;
  if (!isValidSlug(slug)) return json({ error: 'invalid slug' }, 400);

  const now = Math.floor(Date.now() / 1000);

  try {
    const ip = request.headers.get('CF-Connecting-IP') || '0.0.0.0';
    const ipHash = await hashIp(ip, SALT);

    const voter = await env.DB.prepare(
      'SELECT ts FROM voters WHERE ip_hash = ?'
    )
      .bind(ipHash)
      .first();

    if (voter && isThrottled(voter.ts, now)) {
      // Already voted recently — return current results, don't double-count.
      return json({ ...(await tally(env)), throttled: true }, 409);
    }

    await env.DB.batch([
      env.DB
        .prepare('UPDATE dishes SET count = count + 1 WHERE slug = ?')
        .bind(slug),
      env.DB
        .prepare(
          'INSERT INTO voters (ip_hash, ts) VALUES (?, ?) ' +
            'ON CONFLICT(ip_hash) DO UPDATE SET ts = excluded.ts'
        )
        .bind(ipHash, now),
    ]);

    return json(await tally(env));
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
}

async function tally(env) {
  const { results } = await env.DB.prepare(
    'SELECT slug, label, emoji, count FROM dishes'
  ).all();
  return buildResponse(results);
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}
