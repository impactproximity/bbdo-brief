# Agency Brief Creator — Plan

## Context

The existing app (`/`) is a voice-to-brief creator for **Shamal**, BBDO/Omnicom's client. It walks users question-by-question through one of 9 brief types using voice transcription (Whisper) → LLM enhancement (GPT-4o) → `.docx` export.

The agency itself now needs its own internal brief tool, sharing the same codebase but with a different shape:
- **Separate dashboard** at `/agency` (no impact on Shamal flow)
- **4 brief tiers**: Big Idea, Task Brief, Social Brief, Production
- **Bulk-upload-first** workflow: user uploads all relevant docs (multiple PDFs/DOCX) plus optional voice/text notes → LLM parses everything → pre-fills all answers + flags missing/good-to-have items
- **Review wizard**: user reviews each pre-filled answer, can edit inline, ask follow-ups via a **per-question chat panel** grounded on the uploaded docs, or refine with voice/text
- **Submit** → generates the final `.docx`

Intended outcome: agency teams can produce briefs in minutes by dumping their existing materials (decks, transcripts, emails) into the tool, then nudging the AI rather than writing from scratch.

---

## Decisions (locked in)

| Topic | Choice |
|---|---|
| Routing | New `/agency` dashboard, isolated from Shamal `/` |
| Input model | Bulk upload + voice/text intake → LLM pre-fills → wizard review |
| Recommendations | Per-question chat panel grounded on uploaded corpus |
| Questions | **Derived from user-provided brief templates** (same way Shamal configs were built). Configs written *after* templates are supplied — see "Pre-implementation prerequisite" below |
| Storage | Session-only (no persistence). Files held in client state, sent to APIs on demand. Vercel Blob is a future enhancement |
| Branding | Agency briefs drop Shamal logo, keep Omnicom + ImpactProximity |
| LLM — Shamal flow | Unchanged: OpenAI GPT-4o + Whisper-1 via `openai` SDK |
| LLM — Agency flow | **Anthropic Claude** (`@anthropic-ai/sdk`, model `claude-sonnet-4-6` default) for prefill and per-question chat. Whisper-1 still used for transcription since Anthropic has no ASR |

---

## File map

### New files

```
app/agency/
  page.tsx                          # Dashboard listing 4 tiers
  brief/[tier]/page.tsx             # 3-step wizard (Intake → Review → Submit)
app/api/agency/
  prefill/route.ts                  # POST: corpus → pre-filled answers + missing flags
  chat/route.ts                     # POST: per-question follow-up Q&A grounded on corpus
components/agency/
  AgencyIntake.tsx                  # Step 1: multi-file upload + voice/text notes
  AgencyReview.tsx                  # Step 2: wizard over pre-filled answers w/ chat panel
  QuestionChatPanel.tsx             # Per-question grounded chat (uses /api/agency/chat)
  AnswerCard.tsx                    # Single question's answer card (display, edit, status)
lib/questions/agency/
  index.ts                          # Aggregates 4 tier configs, exports AGENCY_BRIEF_TYPES
  big-idea.ts
  task.ts
  social.ts
  production.ts
  types.ts                          # AgencyQuestion extends Question with `required`, `hint`
```

### Touched files

```
app/page.tsx                        # Add a small "Agency Briefs →" link/card at the bottom
app/api/parse-document/route.ts     # Bump size limit 1MB → 5MB; no other changes
app/api/generate-document/route.ts  # Extend getBriefConfig lookup to include agency configs;
                                    #   accept `branding: 'shamal' | 'agency'` to swap header
lib/questions/index.ts              # Re-export agency configs OR keep agency separate (see Design note)
```

### Design note — keep agency configs separate

To preserve full isolation, `lib/questions/index.ts` (used by Shamal `/`) stays untouched. Agency exposes its own `getAgencyBriefConfig()` via `lib/questions/agency/index.ts`. The shared `app/api/generate-document/route.ts` will accept an optional `briefSource: 'shamal' | 'agency'` field and resolve from the correct registry.

---

## Pre-implementation prerequisite — question configs

The 4 tier configs (`big-idea.ts`, `task.ts`, `social.ts`, `production.ts`) are **not drafted in this plan**. They will be authored from the agency's existing brief templates, the same way the Shamal configs were derived from Shamal's templates.

**Process before coding the wizard:**
1. User provides one brief template per tier (PDF or DOCX) — Big Idea, Task Brief, Social Brief, Production
2. Each template is read, sections/questions are identified, and a `BriefConfig` is written for each tier in `lib/questions/agency/*.ts`
3. Each question schema follows the existing shape: `id`, `title`, `prompt`, `placeholder`, optional `allowUpload`. Two new optional fields added in `lib/questions/agency/types.ts`:
   - `hint?: string` — extra extraction guidance passed to the LLM during prefill
   - `required?: boolean` — drives the "missing" badge in the review UI

The wizard, APIs, and dashboard code can be built in parallel without the final question lists; the agency `getAgencyBriefConfig(tier)` registry will compile once configs land.

---

## UI flow

### `/agency` (dashboard)
Mirrors `app/page.tsx` visually — 2×2 grid of 4 cards (Big Idea, Task Brief, Social Brief, Production) with distinct colors/icons. Reuses `Card`, `Image`, color/icon maps from existing landing.

### `/agency/brief/[tier]` (3-step wizard)

Single client component with a step state machine: `'intake' | 'review' | 'submit'`.

**Step 1 — Intake (`AgencyIntake`)**
- Drag-and-drop multi-file uploader (PDF/DOCX, up to 5MB each, up to ~10 files). Built on existing `DocumentUploader` patterns; uses native `<input type="file" multiple>` + drop zone.
- Optional voice recorder (reuses `components/VoiceRecorder.tsx`) → transcribes via `/api/transcribe`
- Optional free-text notes (`<Textarea>`)
- "Process & Pre-fill" button:
  1. Loops files → `/api/parse-document` (one at a time, simple sequential calls; shows per-file progress)
  2. POSTs aggregated corpus + transcript + notes to `/api/agency/prefill`
  3. On success, transitions to Step 2 with `prefilledAnswers` populated

**Step 2 — Review (`AgencyReview`)**
- Reuses the wizard pattern from `app/brief/[type]/page.tsx`: paginated question pills, progress bar, prev/next nav
- Each question renders an `AnswerCard`:
  - Shows LLM-suggested answer with an "AI-suggested" badge
  - Inline edit (textarea), Save/Cancel
  - "Missing" badge if LLM marked the answer as low-confidence or absent
  - "Good to have" callout if LLM flagged an enhancement opportunity
  - **Chat panel toggle** → expands `QuestionChatPanel` (right side on desktop, modal on mobile)
- Voice/text override per question (small "Refine with voice" affordance, reusing `VoiceRecorder` + `/api/chat`)

**Step 3 — Submit**
- Triggers existing `/api/generate-document` with `briefSource: 'agency'` and the agency-branded header
- Same `.docx` download UX as Shamal flow

### `QuestionChatPanel`
- Maintains a per-question message thread in component state
- Each user message POSTs to `/api/agency/chat` with `{ briefType, questionId, currentAnswer, corpus, history, userMessage }`
- Assistant replies render inline; each reply may include a "Suggested update" block with an **Apply** button that overwrites the question's answer
- Reuses message-render shape from the (currently unused) `components/ChatInterface.tsx` — good time to actually wire it up

---

## API design

### `POST /api/agency/prefill`
**Request:** `{ briefType: string, corpus: string, voiceTranscript?: string, textNotes?: string }`
- `corpus` = parsed text from all uploaded docs, joined with `\n\n---\n\n` separators and file headings
- Server fetches the tier's question list via `getAgencyBriefConfig(briefType)`
- Calls **Anthropic Claude** (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` with tool use to force a structured JSON response shaped:
  ```ts
  { answers: Record<questionId, { value: string, confidence: 'high'|'medium'|'low', missing: boolean, suggestion?: string }> }
  ```
- System prompt instructs: extract verbatim from corpus where possible; do not fabricate; mark `missing: true` when corpus has no signal; populate `suggestion` for "good-to-have" recommendations
- Uses **prompt caching** on the corpus block (`cache_control: { type: 'ephemeral' }`) so follow-up agency-chat requests within the same brief reuse the cached corpus and stay cheap

**Response:** the JSON above.

### `POST /api/agency/chat`
**Request:** `{ briefType, questionId, currentAnswer, corpus, history: {role, content}[], userMessage }`
- System prompt: "You are helping refine the answer for question X. Here is the source corpus. Here is the current draft. Be concise, propose concrete updates when asked."
- Anthropic Claude chat completion (`claude-sonnet-4-6`) — same prompt-caching pattern as prefill so the corpus is paid for once per brief
- Response includes the assistant message and an optional `suggestedAnswer` field the UI can offer to apply (extracted from the assistant turn via a lightweight tool-use block: `propose_update(suggestedAnswer)`)

**Response:** `{ message: string, suggestedAnswer?: string }`

### Reused endpoints
- `/api/transcribe` — unchanged
- `/api/parse-document` — limit bumped to **5 MB**
- `/api/generate-document` — extended with `briefSource: 'shamal' | 'agency'` (default `'shamal'`), `agency` header swaps the Omnicom-only branding (no Shamal logo)

---

## Document generation

`app/api/generate-document/route.ts` already iterates `config.questions` dynamically — agency configs slot in cleanly. Changes:

1. Add `briefSource` to request body; resolve via `getAgencyBriefConfig` when `'agency'`
2. Branch on `briefSource` for the header `ImageRun` (omit `shamalLogo` for agency)
3. Reuse all existing `parsePeopleData`, `parseStakeholderData`, `PEOPLE_TABLE_IDS`, `SIGNOFF_TABLE_IDS` machinery — if an agency question uses id `people` or `stakeholders` etc., it gets the table layout for free

---

## Reused components & utilities

| Asset | Path | Reuse |
|---|---|---|
| `VoiceRecorder` | `components/VoiceRecorder.tsx` | Intake voice notes + per-question voice refinement |
| `DocumentUploader` patterns | `components/DocumentUploader.tsx` | Reference for FormData → `/api/parse-document` flow (new multi-file component built on same pattern) |
| `ChatInterface` skeleton | `components/ChatInterface.tsx` | Repurpose for `QuestionChatPanel` |
| `Card`, `Button`, `Textarea`, `Progress`, `Dialog`, `ScrollArea`, `Separator` | `components/ui/*` | shadcn primitives — same components used by Shamal flow |
| Landing color/icon maps | `app/page.tsx` (lines 10–77) | Copy maps for `/agency` dashboard |
| Wizard pagination logic | `app/brief/[type]/page.tsx` (lines 47–51, 142–170) | Same pattern in `AgencyReview` |
| `getBriefConfig` registry pattern | `lib/questions/index.ts` | Mirror exactly for agency configs |
| docx helpers | `app/api/generate-document/route.ts` (lines 8–228) | Unchanged, used as-is |
| `cn`, `Question`, `BriefConfig`, `QuestionResponse` | `lib/utils.ts`, `lib/questions/types.ts` | Imported directly |

---

## Environment & config

- Reuse existing `OPENAI_API_KEY` (still used by `/api/transcribe`, `/api/chat`, and parse → enhance flow for Shamal)
- **Add `ANTHROPIC_API_KEY`** for agency endpoints (`/api/agency/prefill`, `/api/agency/chat`)
- Add `@anthropic-ai/sdk` to `package.json` dependencies
- No `vercel.json` changes needed; default 300 s function timeout is ample for parse+prefill
- Parsing 10 × 5 MB files server-side could exceed default body limits — the wizard parses files **sequentially client-side via `/api/parse-document`**, so each request stays well within limits

---

## Verification

1. **Local dev**
   - Set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in `.env.local`
   - `npm install` (picks up `@anthropic-ai/sdk`)
   - `npm run dev`
   - Visit `/` → confirm Shamal flow still works (smoke test the Strategy brief end-to-end → download docx)
   - Visit `/agency` → confirm 4-tier dashboard renders
2. **Agency happy path — Big Idea**
   - Upload 2 PDFs + 1 DOCX (each <5 MB)
   - Record a 30-second voice note
   - Click "Process & Pre-fill" — confirm wizard opens with answers populated and `missing` badges where appropriate
   - Edit one answer inline, save
   - Open chat panel on another question, ask "make this more punchy", confirm assistant reply and "Apply" button updates the answer
   - Submit → confirm `.docx` downloads with agency header (no Shamal logo) and correct sections
3. **Edge cases**
   - No files uploaded, only text notes → prefill still runs (LLM marks most fields missing)
   - 6 MB file → upload rejected with clear error
   - Question with `people` id in any agency tier → renders as Role/Name table in docx
4. **Regression**
   - Shamal `/brief/strategy` end-to-end still produces the Shamal-branded docx unchanged
5. **Type & lint**
   - `npm run lint` clean
   - `npx tsc --noEmit` clean (if not part of build)

---

## Progress tracker

This plan is the single source of truth for the build. As work progresses, check off items below. Once implementation starts, the plan file will be copied to `docs/AGENCY_BRIEF_PLAN.md` in the repo so it lives next to the code; updates flow to both copies until the work is complete.

### Phase 0 — Prerequisites
- [x] User uploads Big Idea brief template
- [x] User uploads Task Brief template
- [x] User uploads Social Brief template
- [x] User uploads Production brief template (PPTX — parsed)
- [ ] `ANTHROPIC_API_KEY` available in `.env.local` (still pending — required for live runs)

### Phase 1 — Foundations
- [x] Install `@anthropic-ai/sdk`
- [x] Create `lib/questions/agency/types.ts` (extends `Question` with `hint`, `required`)
- [x] Create `lib/questions/agency/index.ts` registry + `getAgencyBriefConfig()`
- [x] Author `lib/questions/agency/big-idea.ts` from template
- [x] Author `lib/questions/agency/task.ts` from template
- [x] Author `lib/questions/agency/social.ts` from template
- [x] Author `lib/questions/agency/production.ts` from template

### Phase 2 — APIs
- [x] Bump `/api/parse-document` size limit 1 MB → 5 MB (also switched to in-memory buffer for mammoth, removed /tmp write)
- [x] Build `/api/agency/prefill/route.ts` (Anthropic, tool-use JSON, prompt caching)
- [x] Build `/api/agency/chat/route.ts` (Anthropic, prompt-cached corpus, optional propose_update tool)
- [x] Extend `/api/generate-document/route.ts` with `briefSource: 'shamal' | 'agency'` + branded header switch

### Phase 3 — UI
- [x] `/agency/page.tsx` dashboard (4-card grid)
- [x] Link to `/agency` from Shamal landing (`app/page.tsx`)
- [x] `/agency/brief/[tier]/page.tsx` wizard (2-step state machine: intake → review)
- [x] `components/agency/AgencyIntake.tsx` (multi-file upload + voice + text + Process button)
- [x] `components/agency/AgencyReview.tsx` (pagination, progress, per-question cards, chat side-panel)
- [x] `components/agency/AnswerCard.tsx` (display/edit/badges/required/missing/good-to-have)
- [x] `components/agency/QuestionChatPanel.tsx` (per-question grounded chat with Apply button)

### Phase 4 — Verification
- [x] `npm run lint` clean (4 pre-existing warnings, none introduced)
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` succeeds; all new routes registered (`/agency`, `/agency/brief/[tier]`, `/api/agency/{prefill,chat}`)
- [ ] Shamal regression: `/brief/strategy` end-to-end still produces unchanged `.docx` (manual)
- [ ] Agency happy path: multi-file upload → prefill → review → chat-refine → submit → branded `.docx` (manual, needs ANTHROPIC_API_KEY)
- [ ] Edge cases: no files / >5 MB file / required-question-missing badge (manual)

### Phase 5 — Polish (optional)
- [ ] Stream agency chat responses
- [ ] Persist drafts (Vercel Blob + session)
- [ ] Auth gate `/agency`

---

## Out of scope (deferred)

- Persistence of uploaded files / drafts (would need Vercel Blob + a session/auth layer)
- Streaming chat responses (current plan uses non-streaming for simplicity)
- AI SDK / AI Gateway migration (existing routes use `openai` SDK directly; keep consistent)
- Auth — both `/` and `/agency` remain open
- Versioning / history of past briefs
