import { buildResponse } from '../../shared/poll.js';

// GET /api/votes — current tallies for rendering results.
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(
      'SELECT slug, label, emoji, count FROM dishes'
    ).all();
    return json(buildResponse(results));
  } catch {
    return json({ error: 'unavailable' }, 503);
  }
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
