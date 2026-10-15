import { CLIENTS } from './index';

/**
 * Resolve whatever a consuming platform calls a brand into our canonical client id.
 *
 * The public API is consumed by platforms with their own brand vocabulary. Impact BBDO
 * Pulse, the first of them, identifies brands by display name — `?brand=Starbucks`,
 * `brand=McVitie's` — while this app uses url-safe slugs. Rather than make every consumer
 * maintain a mapping table that silently rots when a client is renamed, the API accepts
 * either and resolves here.
 *
 * Deliberately NOT fuzzy. Matching is exact after normalisation, so a typo fails loudly
 * with a 404 instead of quietly generating a brief for the wrong brand.
 */

/** Lowercase and drop everything that is not a letter or digit. "McVitie's" -> "mcvities". */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function resolveClientId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Exact id first — the common case, and the only one that needs no normalisation.
  if (CLIENTS.some((c) => c.id === raw)) return raw;

  const needle = normalise(raw);
  if (!needle) return null;

  for (const client of CLIENTS) {
    if (normalise(client.id) === needle) return client.id;
    if (normalise(client.label) === needle) return client.id;
    if (client.aliases?.some((a) => normalise(a) === needle)) return client.id;
  }

  return null;
}

/**
 * Every spelling this API accepts for a client, in a stable order. Published in the
 * catalog so a consumer can see what will resolve without guessing.
 *
 * De-duplicated on the literal string, NOT the normalised form. "mcvities" and "McVitie's"
 * normalise to the same key, but a consumer reading only "mcvities" would never learn that
 * the display name it already holds is accepted — which is the whole point of this list.
 */
export function acceptedNamesFor(clientId: string): string[] {
  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of [client.id, client.label, ...(client.aliases ?? [])]) {
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}
