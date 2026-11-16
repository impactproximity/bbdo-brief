import { CLIENTS } from '@/lib/clients';
import { resolveClientIdIn } from '@/lib/clients/resolve';
import type { PulseClientRow } from '@/lib/clients/pulse-store';
import {
  DEFAULT_CLIENT_ICON,
  nearestColorKey,
  suggestIconKey,
  type ClientColorKey,
  type ClientIconKey,
} from '@/lib/clients/card-vocabulary';
import type { PulseBrandSummary } from './types';
import { suggestClientId } from './compose';

/**
 * The join between Pulse's roster and ours: which of their brands we have onboarded, which
 * have moved on since we pulled them, and what to pre-fill when onboarding one.
 *
 * Pure functions over data both routes already have, so the admin dashboard's GET and the
 * onboard POST agree on what "stale" means without either one owning the definition.
 */

export type OnboardStatus =
  /** Live on Pulse, no local row, no compile-time client that matches. The onboardable case. */
  | 'not_onboarded'
  /** Onboarded here and in step with Pulse's current guideline version. */
  | 'onboarded'
  /** Onboarded, but Pulse's guideline has advanced since we pulled. Offer a Refresh. */
  | 'stale'
  /** Onboarded then deactivated here. Hidden from users; re-activatable. */
  | 'deactivated'
  /**
   * Already a hand-authored compile-time client. Not onboardable — a second row under a
   * different slug would put the same brand on the picker twice, with two different sets of
   * brand context and no way for a user to know which one they picked.
   */
  | 'onboarded_static';

export interface PulseBrandDashboardRow {
  pulseBrandId: string;
  name: string;
  clientName: string;
  industries: string[];
  regions: string[];
  /** Whether PULSE has a logo for this brand — not whether we have pulled it. */
  hasLogo: boolean;
  guidelineVersion: number | null;
  guidelineCreatedAt: string | null;

  status: OnboardStatus;

  /** Our client id once onboarded (or the matching compile-time id), else null. */
  clientId: string | null;
  /** The guideline version we actually hold. Compare against guidelineVersion above. */
  syncedGuidelineVersion: number | null;
  syncedAt: string | null;
  syncedByEmail: string | null;
  propositionSource: 'pulse' | 'local' | null;
  /** Whether WE hold logo bytes. Differs from hasLogo if a pull predates their upload. */
  hasSyncedLogo: boolean;
  /** Admin-typed additions exist on this brand. They survive every Refresh. */
  hasLocalNotes: boolean;
  /**
   * Uploaded documents, and how many actually reach the prompt. The gap is the signal worth
   * surfacing: documents uploaded but never reviewed contribute nothing and look identical to
   * none at all unless both numbers are shown.
   */
  documentCount: number;
  includedDocumentCount: number;

  /** Pre-fill for the onboard dialog. Ignored for an already-onboarded brand. */
  suggested: SuggestedCard;
}

export interface SuggestedCard {
  id: string;
  label: string;
  description: string;
  icon: ClientIconKey;
  color: ClientColorKey;
}

/** The category words worth showing on a card, most specific first. */
function categoryOf(brand: PulseBrandSummary): string {
  return brand.homeIndustryLabel || brand.industries[0] || '';
}

/**
 * Everything that might hint at a category, for the icon guess only.
 *
 * Both fields, because either can be the useful one: P&O's homeIndustryLabel is the tagline
 * "A DP World Company" and gets us nowhere, while its industries carry "Travel" and get us a
 * ship. Searching both costs nothing and the result is a dropdown default either way.
 */
function iconHintFor(brand: PulseBrandSummary): string {
  return [brand.homeIndustryLabel ?? '', ...brand.industries].join(' ');
}

/**
 * What to pre-fill in the onboard dialog.
 *
 * Every value here is a SUGGESTION the admin can overwrite, which is why a crude guess is
 * the right amount of effort: `id` because Pulse's name does not always slugify the way a
 * human would have chosen ("P&O Ferries" became `p-and-o`, not `p-and-o-ferries`), and
 * icon/colour because our card vocabulary is a closed set that cannot represent most brands
 * exactly. See lib/clients/card-vocabulary.ts.
 */
export function suggestCard(brand: PulseBrandSummary): SuggestedCard {
  const category = categoryOf(brand);
  const descriptionBits = [category, brand.regions.join(', ')].filter(Boolean);

  return {
    id: suggestClientId(brand.name),
    label: brand.name,
    description: descriptionBits.join(' · '),
    icon: brand.hasLogo ? DEFAULT_CLIENT_ICON : suggestIconKey(iconHintFor(brand)),
    color: nearestColorKey(brand.selectorBg),
  };
}

/**
 * The compile-time client this Pulse brand already is, if any.
 *
 * Two routes to a match, in order of authority:
 *  1. `briefClientId` — Pulse's own explicit override, naming OUR client id. If someone set
 *     it, they meant it.
 *  2. Name resolution through the same non-fuzzy matcher the public API uses, so "Starbucks"
 *     finds `starbucks` and "McVitie's" finds `mcvities` without a mapping table.
 *
 * Returns null for the common case. Getting this wrong in the permissive direction would let
 * an admin onboard a brand we already have; in the strict direction it would hide a brand
 * that genuinely needs onboarding — so the matcher is exact-after-normalisation, never fuzzy.
 */
export function matchingStaticClientId(brand: PulseBrandSummary): string | null {
  if (brand.briefClientId && CLIENTS.some((c) => c.id === brand.briefClientId)) {
    return brand.briefClientId;
  }
  return resolveClientIdIn(CLIENTS, brand.name);
}

/**
 * Is Pulse's guideline ahead of the one we hold?
 *
 * Their brand_guidelines is append-only and the current row is MAX(version), so this is an
 * integer comparison — the single reason this integration needs no sync job or webhook.
 *
 * The null cases are both real and both matter:
 *  - they have none and we have none: in step, nothing to pull.
 *  - they have one and we hold null: a brand onboarded before its guidelines were authored.
 *    Stale, and the most valuable Refresh of all, since it is the first real brand context
 *    that brand will ever get.
 *  - they have none and we hold a version: they cannot un-append a row, so this means the
 *    brand was re-created or the row was deleted out of band. Not stale — re-pulling would
 *    replace real context with nothing.
 */
export function isStale(pulseVersion: number | null, syncedVersion: number | null): boolean {
  if (pulseVersion === null) return false;
  if (syncedVersion === null) return true;
  return pulseVersion > syncedVersion;
}

/** One dashboard row per brand live on Pulse, joined against what we hold. */
export function buildDashboardRows(
  brands: PulseBrandSummary[],
  syncedRows: PulseClientRow[],
  documentCounts?: Map<string, { total: number; included: number }>,
): PulseBrandDashboardRow[] {
  const byBrandId = new Map(syncedRows.map((r) => [r.pulse_brand_id, r]));

  return brands.map((brand) => {
    const row = byBrandId.get(brand.id);
    const staticId = row ? null : matchingStaticClientId(brand);

    let status: OnboardStatus;
    if (row) {
      if (!row.is_active) status = 'deactivated';
      else if (isStale(brand.guidelineVersion, row.guideline_version)) status = 'stale';
      else status = 'onboarded';
    } else if (staticId) {
      status = 'onboarded_static';
    } else {
      status = 'not_onboarded';
    }

    return {
      pulseBrandId: brand.id,
      name: brand.name,
      clientName: brand.clientName,
      industries: brand.industries,
      regions: brand.regions,
      hasLogo: brand.hasLogo,
      guidelineVersion: brand.guidelineVersion,
      guidelineCreatedAt: brand.guidelineCreatedAt,
      status,
      clientId: row?.id ?? staticId,
      syncedGuidelineVersion: row?.guideline_version ?? null,
      syncedAt: row?.synced_at ?? null,
      syncedByEmail: row?.synced_by_email ?? null,
      propositionSource: row?.proposition_source ?? null,
      hasSyncedLogo: Boolean(row?.logo_content_type),
      hasLocalNotes: Boolean(row?.local_brand_notes?.trim() || row?.local_prompt_notes?.trim()),
      documentCount: (row && documentCounts?.get(row.id)?.total) ?? 0,
      includedDocumentCount: (row && documentCounts?.get(row.id)?.included) ?? 0,
      suggested: suggestCard(brand),
    };
  });
}
