import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import {
  getPulseClientByBrandId,
  isPulseStoreConfigured,
  listClientDocuments,
  listIncludedDocumentsFor,
  updateLocalNotes,
  updateProposition,
  type PropositionSource,
  type PulseClientRow,
} from '@/lib/clients/pulse-store';
import { pulseRowToClientConfig } from '@/lib/clients/registry';
import { buildClientContextBlock } from '@/lib/clients';

export const runtime = 'nodejs';

/**
 * GET/PATCH /api/admin/pulse-brands/{brandId}/detail — one synced brand's editable context.
 *
 * NO PULSE CALL ON EITHER VERB. Everything here is already stored, which is the point: an
 * admin can read and edit a brand's local context while Pulse is unreachable, undeployed or
 * mid-incident. Only Refresh needs the partner API.
 *
 * WHY THE PROSE COMES THROUGH A ROUTE. CLAUDE.md: brand prose must not reach the browser.
 * Importing @/lib/clients into a client component put every brand's full strategy into a
 * public JS chunk until 2026-11-09. This route is admin-gated, so it is the one legitimate
 * way that text reaches a browser — and it reaches only an admin's.
 *
 * Keyed on Pulse's brand id, like every sibling route, so the dashboard never has to hold two
 * identifiers for one row.
 */

/** Shared by both verbs so the UI always re-renders from one shape. */
async function detailPayload(row: PulseClientRow) {
  const documents = await listClientDocuments(row.id);

  // The prompt preview is built from the SAME functions the live path uses — the registry's
  // row-to-config mapper and buildClientContextBlock — rather than re-assembled here. A
  // preview that is assembled separately is a preview that drifts from reality, which would
  // make it worse than no preview at all.
  const included = await listIncludedDocumentsFor([row.id]);
  const config = pulseRowToClientConfig(row, included.get(row.id));
  const promptPreview = buildClientContextBlock(config);

  return {
    client: {
      id: row.id,
      pulseBrandId: row.pulse_brand_id,
      label: row.label,
      description: row.description,
      icon: row.icon,
      color: row.color,
      aliases: row.aliases,
      briefTypes: row.brief_types,
      isActive: row.is_active,
      hasLogo: Boolean(row.logo_content_type),

      proposition: row.proposition,
      propositionSource: row.proposition_source,

      /** Pulse's composed text. Read-only here: a Refresh replaces it wholesale. */
      pulse: {
        brandGuidelines: row.brand_guidelines,
        promptGuidance: row.prompt_guidance,
      },
      /** Ours. A Refresh never touches these. */
      local: {
        brandNotes: row.local_brand_notes,
        promptNotes: row.local_prompt_notes,
        updatedAt: row.local_notes_updated_at,
        updatedByEmail: row.local_notes_updated_by_email,
      },

      guidelineVersion: row.guideline_version,
      guidelineCreatedAt: row.guideline_created_at,
      syncedAt: row.synced_at,
      syncedByEmail: row.synced_by_email,
    },
    documents,
    /** Exactly what the model will be sent for this client, or null when there is nothing. */
    promptPreview,
    promptPreviewChars: promptPreview?.length ?? 0,
  };
}

async function loadOr404(brandId: string) {
  const row = await getPulseClientByBrandId(brandId);
  if (!row) {
    return { row: null, response: NextResponse.json({ error: 'That brand is not onboarded.' }, { status: 404 }) };
  }
  return { row, response: null };
}

export async function GET(_req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  try {
    const { row, response } = await loadOr404(brandId);
    if (!row) return response;
    return NextResponse.json(await detailPayload(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] detail read failed:', err);
    return NextResponse.json({ error: 'Could not load this brand.', detail: message }, { status: 500 });
  }
}

interface PatchBody {
  localBrandNotes?: unknown;
  localPromptNotes?: unknown;
  proposition?: unknown;
  propositionSource?: unknown;
}

/** Caps so one paste cannot put a novel into every brief's prompt for this client. */
const MAX_NOTES_CHARS = 20_000;
const MAX_PROPOSITION_CHARS = 4_000;

export async function PATCH(req: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  if (!isPulseStoreConfigured()) {
    return NextResponse.json({ error: 'The synced client store is not configured.' }, { status: 503 });
  }

  const { brandId } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const asString = (value: unknown, field: string, max: number): string | null | NextResponse => {
    if (value === undefined) return null;
    if (typeof value !== 'string') return NextResponse.json({ error: `"${field}" must be a string.` }, { status: 400 });
    if (value.length > max) {
      return NextResponse.json({ error: `"${field}" is longer than ${max} characters.` }, { status: 400 });
    }
    return value;
  };

  const brandNotes = asString(body.localBrandNotes, 'localBrandNotes', MAX_NOTES_CHARS);
  if (brandNotes instanceof NextResponse) return brandNotes;
  const promptNotes = asString(body.localPromptNotes, 'localPromptNotes', MAX_NOTES_CHARS);
  if (promptNotes instanceof NextResponse) return promptNotes;
  const proposition = asString(body.proposition, 'proposition', MAX_PROPOSITION_CHARS);
  if (proposition instanceof NextResponse) return proposition;

  const source: PropositionSource | null =
    body.propositionSource === 'local' ? 'local' : body.propositionSource === 'pulse' ? 'pulse' : null;
  if (body.propositionSource !== undefined && source === null) {
    return NextResponse.json({ error: '"propositionSource" must be "pulse" or "local".' }, { status: 400 });
  }

  try {
    const { row, response } = await loadOr404(brandId);
    if (!row) return response;

    let current = row;

    // Two writes rather than one, because they are two different ownership statements and
    // either can be sent alone. Both are plain column updates on a row that already exists,
    // so there is no partial-state worth a transaction here: a failure leaves the other field
    // as it was and the editor re-reads the truth.
    if (brandNotes !== null || promptNotes !== null) {
      const saved = await updateLocalNotes(
        current.id,
        {
          local_brand_notes: brandNotes ?? current.local_brand_notes,
          local_prompt_notes: promptNotes ?? current.local_prompt_notes,
        },
        session.email,
      );
      if (saved) current = saved;
    }

    if (proposition !== null || source !== null) {
      // An explicit source wins. Otherwise editing the text at all means taking ownership of
      // it — a hand-typed proposition that a Refresh then overwrote would be the exact bug
      // this whole local/synced split exists to prevent.
      const nextSource: PropositionSource = source ?? 'local';
      const saved = await updateProposition(
        current.id,
        proposition ?? current.proposition,
        nextSource,
      );
      if (saved) current = saved;
    }

    return NextResponse.json(await detailPayload(current));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[admin/pulse-brands] detail save failed:', err);
    return NextResponse.json({ error: 'Could not save your changes.', detail: message }, { status: 500 });
  }
}
