import { describe, it, expect } from 'vitest';
import {
  isValidSlug,
  pct,
  buildResponse,
  isThrottled,
  hashIp,
  THROTTLE_SECONDS,
  SLUGS,
} from '../shared/poll.js';

describe('isValidSlug', () => {
  it('accepts the four seeded slugs', () => {
    for (const s of SLUGS) expect(isValidSlug(s)).toBe(true);
  });
  it('rejects unknown, empty, and non-string values', () => {
    expect(isValidSlug('pierogi')).toBe(false);
    expect(isValidSlug('')).toBe(false);
    expect(isValidSlug(undefined)).toBe(false);
    expect(isValidSlug(null)).toBe(false);
    expect(isValidSlug(123)).toBe(false);
  });
});

describe('pct', () => {
  it('returns 0 when total is 0 or missing', () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(5, 0)).toBe(0);
    expect(pct(5, undefined)).toBe(0);
  });
  it('rounds to nearest integer percent', () => {
    expect(pct(1, 3)).toBe(33);
    expect(pct(2, 3)).toBe(67);
    expect(pct(527, 1284)).toBe(41);
  });
});

describe('buildResponse', () => {
  const rows = [
    { slug: 'kaszanka', label: 'kaszanka', emoji: '🩸', count: 10 },
    { slug: 'czernina', label: 'czernina', emoji: '🦆', count: 30 },
    { slug: 'flaki', label: 'flaki', emoji: '🫃', count: 20 },
    { slug: 'watrobka', label: 'wątróbka', emoji: '🫀', count: 0 },
  ];

  it('totals all counts', () => {
    expect(buildResponse(rows).total).toBe(60);
  });
  it('sorts dishes by count descending', () => {
    const order = buildResponse(rows).dishes.map((d) => d.slug);
    expect(order).toEqual(['czernina', 'flaki', 'kaszanka', 'watrobka']);
  });
  it('computes per-dish pct against the total', () => {
    const bySlug = Object.fromEntries(
      buildResponse(rows).dishes.map((d) => [d.slug, d.pct])
    );
    expect(bySlug.czernina).toBe(50);
    expect(bySlug.flaki).toBe(33);
    expect(bySlug.watrobka).toBe(0);
  });
  it('handles the all-zero (fresh poll) case', () => {
    const fresh = rows.map((r) => ({ ...r, count: 0 }));
    const out = buildResponse(fresh);
    expect(out.total).toBe(0);
    expect(out.dishes.every((d) => d.pct === 0)).toBe(true);
    // stable alphabetical order when all tied at 0
    expect(out.dishes.map((d) => d.slug)).toEqual([
      'czernina',
      'flaki',
      'kaszanka',
      'watrobka',
    ]);
  });
});

describe('isThrottled', () => {
  const now = 1_000_000;
  it('is false when there is no prior vote', () => {
    expect(isThrottled(null, now)).toBe(false);
    expect(isThrottled(undefined, now)).toBe(false);
  });
  it('is true within the window', () => {
    expect(isThrottled(now - 60, now)).toBe(true);
    expect(isThrottled(now - (THROTTLE_SECONDS - 1), now)).toBe(true);
  });
  it('is false once the window has passed', () => {
    expect(isThrottled(now - THROTTLE_SECONDS, now)).toBe(false);
    expect(isThrottled(now - (THROTTLE_SECONDS + 1), now)).toBe(false);
  });
});

describe('hashIp', () => {
  it('produces a stable 64-char hex digest', async () => {
    const h = await hashIp('203.0.113.7', 'salt');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashIp('203.0.113.7', 'salt')).toBe(h);
  });
  it('differs by ip and by salt', async () => {
    const a = await hashIp('203.0.113.7', 'salt');
    expect(await hashIp('203.0.113.8', 'salt')).not.toBe(a);
    expect(await hashIp('203.0.113.7', 'pepper')).not.toBe(a);
  });
});
