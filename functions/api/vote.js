import { buildResponse, isValidSlug } from '../../shared/poll.js';

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

  try {
    await env.DB.prepare('UPDATE dishes SET count = count + 1 WHERE slug = ?')
      .bind(slug)
      .run();
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
