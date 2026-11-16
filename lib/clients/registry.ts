import { CLIENTS } from './index';
import type { ClientConfig } from './types';
import {
  isPulseStoreConfigured,
  listIncludedDocumentsFor,
  listPulseClients,
  type PulseClientRow,
} from './pulse-store';
import { acceptedNamesIn, resolveClientIdIn } from './resolve';
import { composeDocumentContext, withLocalNotes } from '@/lib/pulse/compose';

/**
 * The merged client registry: compile-time configs plus brands synced from Pulse.
 *
 * SERVER ONLY — it reads the database. Client components get card-level data from
 * GET /api/clients instead, which is also what keeps brand prose out of the browser bundle.
 *
 * WHY THIS EXISTS. Until now `CLIENTS` was the whole truth and every consumer imported it
 * synchronously. A brand onboarded by an admin cannot be a compile-time import, so there are
 * now two sources and one of them needs awaiting. This module is the single place the two are
 * joined, so no caller has to know which registry a client came from — and so the rules for
 * resolution, ordering and precedence are stated once.
 *
 * PRECEDENCE: static wins. A compile-time config and a synced row with the same id cannot
 * both be served, and the hand-authored one is the one someone deliberately wrote and
 * reviewed. The onboarding route refuses a colliding id up front, so this is a backstop
 * rather than a routine path — but it is the safe direction if it ever fires.
 *
 * DEGRADATION: static-only. If Supabase is unconfigured or the read throws, this returns the
 * seven compile-time clients and logs. A synced-table outage must not blank the picker for
 * every user and take the whole product down; the cost is that a synced brand temporarily
 * disappears, which looks exactly like the pre-existing "not onboarded yet" state and is
 * already handled everywhere.
 */

/**
 * One synced row as a ClientConfig, so nothing downstream needs to know the difference.
 *
 * The three prose fields are stored already composed (lib/pulse/compose.ts ran at pull
 * time), so buildClientContextBlock() consumes them unchanged — a synced client and a
 * hand-authored one produce the same shape of prompt block.
 */
export function pulseRowToClientConfig(
  row: PulseClientRow,
  documents?: { filename: string; distilled_text: string }[],
): ClientConfig {
  const documentContext = composeDocumentContext(documents);
  return {
    id: row.id,
    label: row.label,
    description: row.description,
    icon: row.icon,
    color: row.color,
    aliases: row.aliases ?? undefined,
    // null in the column means "the four default tiers", which is also what omitting the
    // field means to getBriefTypesForClient. Same convention, two representations.
    briefTypes: row.brief_types ?? undefined,
    // Not `logo`: there is no file under public/ for these. logo_content_type is non-null
    // exactly when bytes exist, so it doubles as the has-a-logo test.
    logoUrl: row.logo_content_type ? `/api/clients/${encodeURIComponent(row.id)}/logo` : undefined,
    source: 'pulse',
    proposition: row.proposition,
    // Pulse's pulled text with the admin's additions appended under their own heading. The two
    // are joined HERE, at the single point where a row becomes a ClientConfig, so every
    // consumer — prefill, refine chat, the public API, the .docx header — gets the combined
    // text without knowing the two halves exist, and nothing downstream had to change.
    brandGuidelines: withLocalNotes(row.brand_guidelines, row.local_brand_notes),
    promptGuidance: withLocalNotes(row.prompt_guidance, row.local_prompt_notes),
    documentContext: documentContext || undefined,
  };
}

/** True when `id` belongs to a compile-time client — i.e. onboarding must not claim it. */
export function isStaticClientId(id: string): boolean {
  return CLIENTS.some((c) => c.id === id);
}

/**
 * Every client a brief can be raised for: the compile-time seven first, then active synced
 * brands alphabetically.
 *
 * Static first because that is the order the picker has always shown and the order people
 * know; synced brands arriving at the end is a stable, predictable place for them rather
 * than reshuffling the grid every time one is onboarded.
 */
export async function getAllClientConfigs(): Promise<ClientConfig[]> {
  const statics: ClientConfig[] = CLIENTS.map((c) => ({ ...c, source: 'static' as const }));
  if (!isPulseStoreConfigured()) return statics;

  let rows: PulseClientRow[];
  try {
    rows = await listPulseClients();
  } catch (err) {
    // Loud in the logs, invisible to the user. See DEGRADATION above.
    console.error('[clients/registry] synced clients unavailable, serving static only:', err);
    return statics;
  }

  const staticIds = new Set(statics.map((c) => c.id));
  const syncedRows = rows.filter((r) => !staticIds.has(r.id));

  // One query for every synced brand's included documents, not one per brand. This function
  // runs on /api/v1/catalog and the client picker, so a per-row query here would be an N+1
  // that grows with every brand onboarded.
  //
  // Its own try/catch, and NOT the static-only fallback: losing the documents degrades a
  // brand's context, while treating it as a registry failure would remove the brand from the
  // picker entirely. The lesser loss is the right one.
  let documentsByClient = new Map<string, { filename: string; distilled_text: string }[]>();
  try {
    documentsByClient = await listIncludedDocumentsFor(syncedRows.map((r) => r.id));
  } catch (err) {
    console.error('[clients/registry] brand documents unavailable, serving brands without them:', err);
  }

  const synced = syncedRows.map((r) => pulseRowToClientConfig(r, documentsByClient.get(r.id)));
  return [...statics, ...synced];
}

/**
 * One client by canonical id, from either registry.
 *
 * The async replacement for getClientConfig(). A route that still calls the synchronous one
 * will 404 every brand onboarded from Pulse, so when in doubt use this.
 */
export async function resolveClientConfig(id: string | null | undefined): Promise<ClientConfig | undefined> {
  if (!id) return undefined;
  // Static first: a synchronous hit avoids a database round trip for the common case, and it
  // encodes the precedence rule above.
  const staticHit = CLIENTS.find((c) => c.id === id);
  if (staticHit) return { ...staticHit, source: 'static' };

  const all = await getAllClientConfigs();
  return all.find((c) => c.id === id);
}

/**
 * Resolve a consuming platform's spelling of a brand across both registries.
 *
 * This is what makes Pulse's "Create Brief" button work for a synced brand: Pulse posts a
 * display name, and until the brand is in this list that name 404s.
 */
export async function resolveClientIdAsync(input: string): Promise<string | null> {
  return resolveClientIdIn(await getAllClientConfigs(), input);
}

/**
 * Resolve a consuming platform's spelling straight to the config, in ONE registry read.
 *
 * The public API needs both the canonical id and the config — the id for persistence and
 * metering, the config for the scope check and the prompt. Calling resolveClientIdAsync then
 * resolveClientConfig would read the synced table twice for one request.
 */
export async function resolveClientByName(input: string): Promise<ClientConfig | undefined> {
  const all = await getAllClientConfigs();
  const id = resolveClientIdIn(all, input);
  return id ? all.find((c) => c.id === id) : undefined;
}

/** Every spelling the public API accepts for a client, across both registries. */
export async function acceptedNamesForAsync(clientId: string): Promise<string[]> {
  return acceptedNamesIn(await getAllClientConfigs(), clientId);
}

/**
 * The tiers a client may raise, without a second registry lookup.
 *
 * getBriefTypesForClient() in lib/questions/agency takes an allow-list rather than an id for
 * exactly this reason — it cannot await, and it must not reach into a registry.
 */
export function briefTypeIdsFor(client: ClientConfig | undefined): string[] | undefined {
  return client?.briefTypes;
}
