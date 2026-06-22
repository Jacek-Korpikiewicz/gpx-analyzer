// Pure, dependency-free logic for the Polish Food Fight poll.
// Kept free of Cloudflare/D1 specifics so it can be unit-tested under plain Node.

export const DISHES = [
  { slug: 'kaszanka', label: 'kaszanka', emoji: '🩸' },
  { slug: 'czernina', label: 'czernina', emoji: '🦆' },
  { slug: 'flaki', label: 'flaki', emoji: '🫃' },
  { slug: 'watrobka', label: 'wątróbka', emoji: '🫀' },
];

export const SLUGS = new Set(DISHES.map((d) => d.slug));

// Best-effort re-vote window: ignore the same hashed IP for 6 hours.
export const THROTTLE_SECONDS = 6 * 60 * 60;

export function isValidSlug(slug) {
  return typeof slug === 'string' && SLUGS.has(slug);
}

// Integer percent of total; 0 when there are no votes yet.
export function pct(count, total) {
  if (!total || total <= 0) return 0;
  return Math.round((count / total) * 100);
}

// Turn raw dish rows into the API response shape: total + dishes sorted by
// count descending (ties broken alphabetically for stable ordering).
export function buildResponse(rows) {
  const total = rows.reduce((sum, r) => sum + (r.count || 0), 0);
  const dishes = rows
    .map((r) => ({
      slug: r.slug,
      label: r.label,
      emoji: r.emoji,
      count: r.count || 0,
      pct: pct(r.count || 0, total),
    }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
  return { total, dishes };
}

// True if a previous vote at `lastTs` (unix seconds) is still inside the window.
export function isThrottled(lastTs, now, windowSeconds = THROTTLE_SECONDS) {
  if (lastTs == null) return false;
  return now - lastTs < windowSeconds;
}

// SHA-256 hex of ip+salt using Web Crypto (available in Workers and Node 18+).
// Raw IP is never persisted — only this hash.
export async function hashIp(ip, salt) {
  const data = new TextEncoder().encode(`${ip}${salt}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
