import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { fetchPulseBrandContext, fetchPulseBrandLogo, isPulseConfigured } from '@/lib/pulse/client';
import { composeBrandContext } from '@/lib/pulse/compose';
import { matchingStaticClientId } from '@/lib/pulse/onboard';
import {
  getPulseClient,
  getPulseClientByBrandId,
  isPulseStoreConfigured,
  upsertPulseClient,
  type PropositionSource,
} from '@/lib/clients/pulse-store';
import { isStaticClientId } from '@/lib/clients/registry';
import { isClientColorKey, isClientIconKey } from '@/lib/clients/card-vocabulary';
import { getAgencyBriefConfig } from '@/lib/questions/agency';
import { pulseErrorResponse } from '@/lib/pulse/error-response';

export const runtime = 'nodejs';
// Three upstream calls in sequence in the worst case (context, then logo), each with its own
// timeout. 60s leaves room without letting a hung pull hold a function open for minutes.
export const maxDuration = 60;

/**
 * POST /api/admin/pulse-brands/{brandId}/onboard — make a Pulse brand briefable, or re-pull
 * one that has gone stale.
 *
 * ONE ROUTE FOR BOTH because they are the same write: pull Pulse's current context, compose
 * it, store it. What differs is only which fields the caller is allowed to set, and that
 * difference is stated in one place below rather than duplicated across two handlers.
 *
 * THE LOCAL / SYNCED SPLIT IS THE WHOLE DESIGN. See db/supabase/0007_pulse_clients.sql.
 * Refresh overwrites everything Pulse owns and touches nothing we own — otherwise an admin
 * who fixed a squashed description or a wrong accent colour would watch it revert the next
 * time guidelines changed upstream, which is the kind of thing that stops people clicking
 * Refresh at all.
 *
 * NOT IDEMPOTENT, and does not need to be. The write is a full-row upsert keyed on our slug,
 * so a double-click produces the same row twice rather than two rows or a half-applied one.
 * The only cost of a repeat is one more pull from Pulse.
 */

interface OnboardBody {
  mode?: unknown;
  id?: unknown;
  label?: unknown;
  description?: unknown;
  icon?: unknown;
  color?: unknown;
  aliases?: unknown;
  briefTypes?: unknown;
  proposition?: unknown;
  propositionSource?: unknown;
}

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() : null;
}

function asStringArray(value: unknown): string[] | null | undefined {
  if (value === undefined) return undefined;
  // Explicit null means "clear it" — for briefTypes that is "revert to the default tiers",
  // which is a real thing an admin may want and is not the same as omitting the field.
  if (value === null) return null;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) return undefined;
  const cleaned = (value as string[]).map((v) => v.trim()).filter(Boolean);
  return cleaned.length ? cleaned : null;
}

/** Our slugs live in the same namespace as the compile-time ids, so the same rules apply. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,59}$/;

export async function POST(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!isPulseConfigured() || !isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'Pulse brand sync is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  let body: OnboardBody;
  try {
    body = (await req.json()) as OnboardBody;
  } catch {
    return bad('Request body must be valid JSON.');
  }

  const mode = body.mode === 'refresh' ? 'refresh' : 'onboard';

  try {
    const existing = await getPulseClientByBrandId(brandId);

    if (mode === 'onboard' && existing) {
      return NextResponse.json(
        { error: `This brand is already onboarded as "${existing.id}". Use Refresh to re-pull it.` },
        { status: 409 },
      );
    }
    if (mode === 'refresh' && !existing) {
      return NextResponse.json({ error: 'This brand is not onboarded yet, so there is nothing to refresh.' }, { status: 404 });
    }

    // --- The id. Fixed forever at onboarding. ---
    //
    // A refresh takes it from the row and ignores the body: briefs.client_id is free-form
    // text with no foreign key, so renaming the slug would not fail — it would silently
    // orphan every brief already written for this brand, which would then render with a raw
    // slug where its client name should be.
    let id: string;
    if (existing) {
      id = existing.id;
    } else {
      const requested = asTrimmedString(body.id);
      if (!requested) return bad('"id" is required.');
      if (!SLUG_RE.test(requested)) {
        return bad('"id" must be lowercase letters, digits and hyphens, starting with a letter or digit.');
      }
      if (isStaticClientId(requested)) {
        return NextResponse.json(
          { error: `"${requested}" is already a hand-authored client in lib/clients. Pick a different id.` },
          { status: 409 },
        );
      }
      if (await getPulseClient(requested)) {
        return NextResponse.json({ error: `"${requested}" is already used by another synced brand.` }, { status: 409 });
      }
      id = requested;
    }

    // --- Card fields: ours. On a refresh, an omitted field keeps its stored value. ---
    const label = asTrimmedString(body.label) ?? existing?.label ?? '';
    if (!label) return bad('"label" is required.');

    const description = asTrimmedString(body.description) ?? existing?.description ?? '';

    const icon = asTrimmedString(body.icon) ?? existing?.icon ?? '';
    if (!isClientIconKey(icon)) {
      // Validated rather than defaulted. Both card maps fall back silently, so an invalid
      // value would render the wrong icon indefinitely with nothing to notice.
      return bad(`"icon" must be one of the supported icon keys. Received: ${icon || '(empty)'}`);
    }

    const color = asTrimmedString(body.color) ?? existing?.color ?? '';
    if (!isClientColorKey(color)) {
      return bad(`"color" must be one of the supported accent keys. Received: ${color || '(empty)'}`);
    }

    const aliasesInput = asStringArray(body.aliases);
    const aliases = aliasesInput === undefined ? existing?.aliases ?? null : aliasesInput;

    const briefTypesInput = asStringArray(body.briefTypes);
    const briefTypes = briefTypesInput === undefined ? existing?.brief_types ?? null : briefTypesInput;
    if (briefTypes) {
      const unknown = briefTypes.filter((t) => !getAgencyBriefConfig(t));
      if (unknown.length) return bad(`Unknown brief type(s): ${unknown.join(', ')}`);
    }

    // --- The pull. ---
    const context = await fetchPulseBrandContext(brandId);

    // A brand that is a hand-authored client already must not also become a synced one: it
    // would appear twice on the picker with two different sets of brand context and no way
    // for a user to tell which they chose. Checked after the pull so the message can name the
    // brand, and only on first onboarding — a refresh of an existing row is unaffected.
    if (!existing) {
      const staticMatch = matchingStaticClientId(context.brand);
      if (staticMatch) {
        return NextResponse.json(
          {
            error: `"${context.brand.name}" is already the hand-authored client "${staticMatch}". ` +
              'Onboarding it again would put the same brand on the picker twice.',
          },
          { status: 409 },
        );
      }
    }

    const composed = composeBrandContext(context);

    // --- The proposition. The one field with two possible owners. ---
    //
    // Pulse added brand_guidelines.proposition for us, so positioning is a real field and the
    // default is simply to take theirs. But an admin may write a sharper line by hand, and a
    // Refresh must not discard it — so 'local' pins the stored value and a re-pull leaves it
    // alone. The dashboard still shows that Pulse's differs, so the divergence is visible
    // rather than forgotten.
    const bodyProposition = asTrimmedString(body.proposition);
    const bodySource: PropositionSource | null =
      body.propositionSource === 'local' ? 'local' : body.propositionSource === 'pulse' ? 'pulse' : null;

    let proposition: string;
    let propositionSource: PropositionSource;
    if (bodySource === 'local') {
      // An explicit local override, from the dialog's editable field.
      proposition = bodyProposition ?? '';
      propositionSource = 'local';
    } else if (bodySource === 'pulse') {
      // Explicitly handing ownership back to Pulse — how an admin discards their own edit.
      proposition = composed.proposition;
      propositionSource = 'pulse';
    } else if (existing?.proposition_source === 'local') {
      // Refresh with no instruction: the local value stands.
      proposition = existing.proposition;
      propositionSource = 'local';
    } else {
      proposition = composed.proposition;
      propositionSource = 'pulse';
    }

    // --- The logo. Null is a normal outcome, not a failure. ---
    //
    // Plenty of their brands have none, and a brand whose logo we cannot fetch must still
    // onboard: the card falls back to a lucide icon and the .docx header to a name TextRun,
    // exactly as a static client with no logo file already does. An upstream error other than
    // "no logo" is NOT swallowed, though — that is a real fault worth seeing.
    const logo = context.brand.hasLogo ? await fetchPulseBrandLogo(brandId) : null;

    const row = await upsertPulseClient({
      id,
      pulse_brand_id: brandId,
      label,
      description,
      icon,
      color,
      aliases,
      brief_types: briefTypes,
      proposition,
      proposition_source: propositionSource,
      brand_guidelines: composed.brandGuidelines,
      prompt_guidance: composed.promptGuidance,
      guideline_version: context.guideline?.version ?? null,
      guideline_created_at: context.guideline?.createdAt ?? null,
      pulse_payload: context,
      logo_base64: logo?.base64 ?? null,
      logo_content_type: logo?.contentType ?? null,
      synced_by_email: session.email,
    });

    return NextResponse.json({
      mode,
      client: {
        id: row.id,
        label: row.label,
        guidelineVersion: row.guideline_version,
        propositionSource: row.proposition_source,
        hasLogo: Boolean(row.logo_content_type),
        syncedAt: row.synced_at,
      },
      // So the UI can say what actually landed rather than just "done". A pull that produced
      // no competitors and no themes is worth an admin knowing about.
      stored: {
        propositionChars: proposition.length,
        brandGuidelinesChars: composed.brandGuidelines.length,
        promptGuidanceChars: composed.promptGuidance.length,
        logoBytes: logo ? Buffer.from(logo.base64, 'base64').byteLength : 0,
      },
    });
  } catch (err) {
    return pulseErrorResponse(err);
  }
}
