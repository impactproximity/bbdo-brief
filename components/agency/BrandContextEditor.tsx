'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AgencyToolbar, TOOLBAR_PILL } from '@/components/agency/AgencyToolbar';
import {
  FILE_ACCEPT_ATTR,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  SUPPORTED_FORMATS_LABEL,
  resolveFileKind,
} from '@/lib/uploads/supported-files';
import { AlertTriangle, ArrowLeft, Check, FileText, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';

/**
 * One synced brand's editable context.
 *
 * Does NO gating of its own — the page redirects a non-admin before this renders, and every
 * route it calls re-checks requireAdmin().
 *
 * It holds real brand prose in browser state, which is the thing CLAUDE.md warns about. That
 * is fine here and only here: the text arrives from an admin-gated route at request time,
 * never from importing @/lib/clients, so it is never baked into a public JS chunk.
 */

interface DocumentRow {
  id: string;
  filename: string;
  kind: string;
  byte_size: number;
  extracted_chars: number;
  distilled_text: string;
  distilled_model: string | null;
  distilled_at: string | null;
  distill_truncated: boolean;
  is_included: boolean;
  uploaded_at: string;
  uploaded_by_email: string | null;
}

interface Detail {
  client: {
    id: string;
    pulseBrandId: string;
    label: string;
    isActive: boolean;
    proposition: string;
    propositionSource: 'pulse' | 'local';
    pulse: { brandGuidelines: string; promptGuidance: string };
    local: {
      brandNotes: string;
      promptNotes: string;
      updatedAt: string | null;
      updatedByEmail: string | null;
    };
    guidelineVersion: number | null;
    syncedAt: string;
    syncedByEmail: string | null;
  };
  documents: DocumentRow[];
  promptPreview: string | null;
  promptPreviewChars: number;
}

function chars(n: number): string {
  return n === 0 ? 'empty' : n < 1000 ? `${n} chars` : `${(n / 1000).toFixed(1)}k chars`;
}

function bytes(n: number): string {
  return n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function when(iso: string | null): string {
  if (!iso) return 'never';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function BrandContextEditor({ brandId }: { brandId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Draft state for the fields the admin types into. Seeded from the server on load and after
  // every save, so what is on screen is always what was actually stored.
  const [brandNotes, setBrandNotes] = useState('');
  const [promptNotes, setPromptNotes] = useState('');
  const [proposition, setProposition] = useState('');
  const [propositionSource, setPropositionSource] = useState<'pulse' | 'local'>('pulse');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [docDrafts, setDocDrafts] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const seed = useCallback((data: Detail) => {
    setDetail(data);
    setBrandNotes(data.client.local.brandNotes);
    setPromptNotes(data.client.local.promptNotes);
    setProposition(data.client.proposition);
    setPropositionSource(data.client.propositionSource);
    setDocDrafts(Object.fromEntries(data.documents.map((d) => [d.id, d.distilled_text])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pulse-brands/${brandId}/detail`);
      if (res.status === 403) throw new Error('You do not have access to this page.');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed to load (${res.status})`);
      }
      seed((await res.json()) as Detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [brandId, seed]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNotes = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pulse-brands/${brandId}/detail`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localBrandNotes: brandNotes,
          localPromptNotes: promptNotes,
          proposition,
          propositionSource,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed to save (${res.status})`);
      }
      seed((await res.json()) as Detail);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    // Checked here as well as server-side, so a 40 MB file is refused instantly instead of
    // after a long upload that the proxy would truncate anyway.
    const resolved = resolveFileKind(file.name, file.type);
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${file.name} exceeds the ${MAX_UPLOAD_LABEL} limit.`);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadStatus(`Reading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      setUploadStatus(`Reading ${file.name} and distilling it — this can take a minute…`);
      const res = await fetch(`/api/admin/pulse-brands/${brandId}/documents`, { method: 'POST', body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Upload failed (${res.status})`);
      }
      const body = await res.json();
      setUploadStatus(
        body.stored?.distilled
          ? `Distilled ${chars(body.stored.extractedChars)} into ${chars(body.stored.distilledChars)}. Review it below, then tick it to use it.`
          : `Stored ${chars(body.stored?.extractedChars ?? 0)} of raw text — no ANTHROPIC_API_KEY, so nothing was distilled.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setUploadStatus(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const patchDoc = async (docId: string, patch: { distilledText?: string; isIncluded?: boolean }) => {
    setBusyDocId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pulse-brands/${brandId}/documents/${docId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyDocId(null);
    }
  };

  const redistil = async (docId: string) => {
    setBusyDocId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pulse-brands/${brandId}/documents/${docId}/redistil`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyDocId(null);
    }
  };

  const removeDoc = async (docId: string) => {
    setBusyDocId(docId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pulse-brands/${brandId}/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || `Failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyDocId(null);
    }
  };

  const notesDirty =
    detail !== null &&
    (brandNotes !== detail.client.local.brandNotes ||
      promptNotes !== detail.client.local.promptNotes ||
      proposition !== detail.client.proposition ||
      propositionSource !== detail.client.propositionSource);

  return (
    <main className="relative flex min-h-screen flex-col items-center p-4 md:p-8 lg:p-12" style={{ backgroundColor: '#d9d8d8' }}>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-6 mb-6 md:mb-8 z-10">
        <Image src="/impact-bbdo-logo.png" alt="IMPACT BBDO" width={315} height={131} priority className="h-[34px] md:h-[52px] w-auto" />
        <div className="flex items-center gap-2 md:gap-3">
          <div className="h-8 md:h-10 w-px bg-slate-400"></div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <p className="text-xs md:text-sm text-slate-700 font-bold tracking-wide">Powered by</p>
            <Image src="/impact-logo.svg" alt="ImpactProximity Logo" width={100} height={24} priority className="drop-shadow-sm w-[70px] md:w-[100px] h-auto" />
          </div>
        </div>
      </div>

      <Card className="w-full max-w-5xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-2 md:border-3 border-slate-300 overflow-hidden rounded-2xl md:rounded-3xl">
        <div className="text-center border-b-2 md:border-b-3 border-slate-300 bg-white pb-4 md:pb-6 pt-6 md:pt-8 px-4 relative">
          <AgencyToolbar
            showPulse={false}
            left={
              <Link href="/agency/admin/pulse" title="Back to Pulse brands" className={TOOLBAR_PILL}>
                <ArrowLeft className="h-3.5 w-3.5 md:h-4 md:w-4" />
                <span className="hidden sm:inline">Pulse brands</span>
              </Link>
            }
          />
          <h1 className="text-2xl md:text-4xl font-bold text-slate-800 mb-2 md:mb-3">
            {detail ? detail.client.label : 'Brand context'}
          </h1>
          <p className="text-sm md:text-lg text-slate-600 max-w-2xl mx-auto font-medium">
            What this brand&rsquo;s briefs are written against. Everything on this page is injected
            into every brief for this client.
          </p>
        </div>

        <CardContent className="p-4 md:p-8 bg-white">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">Loading this brand&rsquo;s context&hellip;</p>
            </div>
          ) : !detail ? (
            <div className="py-10 text-center">
              <p className="font-bold text-red-700 mb-1">Could not load this brand</p>
              <p className="text-sm text-slate-500 max-w-xl mx-auto">{error}</p>
              <Button onClick={() => void load()} className="mt-4 rounded-xl font-bold">
                Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {error && (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* --- From Pulse: read-only --- */}
              <section>
                <SectionHead
                  title="From Pulse"
                  note={`Guideline v${detail.client.guidelineVersion ?? '—'} · pulled ${when(detail.client.syncedAt)}${detail.client.syncedByEmail ? ` by ${detail.client.syncedByEmail}` : ''}`}
                />
                <p className="text-xs text-slate-500 mb-3">
                  Read-only. A Refresh on the dashboard replaces this text wholesale, which is how
                  the brand stays in step with the guidelines Pulse maintains.
                </p>
                <ReadOnlyBlock title="Brand guidelines" body={detail.client.pulse.brandGuidelines} />
                <ReadOnlyBlock title="Prompt guidance" body={detail.client.pulse.promptGuidance} />
              </section>

              {/* --- Proposition --- */}
              <section>
                <SectionHead title="Proposition" note="Its own block in the prompt" />
                <div className="flex flex-wrap gap-3 mb-2 text-xs">
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" checked={propositionSource === 'pulse'} onChange={() => setPropositionSource('pulse')} />
                    Use Pulse&rsquo;s
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input type="radio" checked={propositionSource === 'local'} onChange={() => setPropositionSource('local')} />
                    Write our own (survives every Refresh)
                  </label>
                </div>
                <Textarea
                  value={proposition}
                  onChange={(e) => {
                    setProposition(e.target.value);
                    // Typing IS taking ownership. Leaving the source as 'pulse' while the text
                    // diverges would mean the next Refresh silently discarded what was typed.
                    if (propositionSource !== 'local') setPropositionSource('local');
                  }}
                  rows={3}
                  placeholder="The brand's positioning, in a sentence or two."
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {chars(proposition.length)}
                  {proposition.trim() === '' && ' — Pulse has no proposition for any brand yet, so this is worth writing by hand.'}
                </p>
              </section>

              {/* --- Our additions --- */}
              <section>
                <SectionHead
                  title="Our additions"
                  note={
                    detail.client.local.updatedAt
                      ? `last edited ${when(detail.client.local.updatedAt)}${detail.client.local.updatedByEmail ? ` by ${detail.client.local.updatedByEmail}` : ''}`
                      : 'never edited'
                  }
                />
                <p className="text-xs text-slate-500 mb-3">
                  Appended under Pulse&rsquo;s text inside the same prompt block, under an
                  &ldquo;Our additions&rdquo; heading. <strong>A Refresh never overwrites these.</strong>
                </p>
                <Field label="Added to brand guidelines" hint="Brand facts, corrections, anything Pulse's guidelines do not say.">
                  <Textarea value={brandNotes} onChange={(e) => setBrandNotes(e.target.value)} rows={6} />
                  <p className="text-[11px] text-slate-400">{chars(brandNotes.length)}</p>
                </Field>
                <div className="h-3" />
                <Field label="Added to prompt guidance" hint="How a brief for this brand should be written — tone, structure, what to push on.">
                  <Textarea value={promptNotes} onChange={(e) => setPromptNotes(e.target.value)} rows={6} />
                  <p className="text-[11px] text-slate-400">{chars(promptNotes.length)}</p>
                </Field>

                <div className="mt-4 flex items-center gap-3">
                  <Button onClick={() => void saveNotes()} disabled={saving || !notesDirty} className="rounded-xl font-bold">
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                    Save
                  </Button>
                  {!notesDirty && savedAt && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                      <Check className="h-3.5 w-3.5" /> Saved {when(savedAt)}
                    </span>
                  )}
                  {notesDirty && <span className="text-xs text-amber-700">Unsaved changes</span>}
                </div>
              </section>

              {/* --- Documents --- */}
              <section>
                <SectionHead
                  title="Brand documents"
                  note={`${detail.documents.length} uploaded · ${detail.documents.filter((d) => d.is_included).length} in the prompt`}
                />
                <p className="text-xs text-slate-500 mb-3">
                  Upload a brand toolkit, brand book or proposition deck and it is read and
                  distilled into brand context. <strong>A new document is excluded until you tick
                  it</strong> — the distillation is model-written, so nothing reaches a brief
                  before a person has read it.
                </p>

                <div
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-orange-500');
                  }}
                  onDragLeave={(e) => e.currentTarget.classList.remove('border-orange-500')}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-orange-500');
                    const file = e.dataTransfer.files?.[0];
                    if (file && !uploading) void upload(file);
                  }}
                  className={`border-2 border-dashed border-slate-300 rounded-xl p-6 text-center transition-colors ${uploading ? 'opacity-60' : 'cursor-pointer hover:border-slate-400'}`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      <p className="text-sm text-slate-600">{uploadStatus}</p>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm font-medium text-slate-700">Drop a document, or click to choose</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {SUPPORTED_FORMATS_LABEL} · up to {MAX_UPLOAD_LABEL}
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={FILE_ACCEPT_ATTR}
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void upload(file);
                    }}
                  />
                </div>

                {!uploading && uploadStatus && (
                  <p className="mt-2 text-xs text-slate-600">{uploadStatus}</p>
                )}

                <div className="mt-4 space-y-4">
                  {detail.documents.map((doc) => {
                    const busy = busyDocId === doc.id;
                    const draft = docDrafts[doc.id] ?? doc.distilled_text;
                    const dirty = draft !== doc.distilled_text;
                    return (
                      <div
                        key={doc.id}
                        className={`rounded-xl border-2 p-3 ${doc.is_included ? 'border-green-300 bg-green-50/40' : 'border-slate-200 bg-slate-50'}`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{doc.filename}</span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {doc.kind.toUpperCase()} · {bytes(doc.byte_size)} · read{' '}
                              {chars(doc.extracted_chars)} → {chars(doc.distilled_text.length)} ·{' '}
                              uploaded {when(doc.uploaded_at)}
                              {doc.uploaded_by_email ? ` by ${doc.uploaded_by_email}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl text-slate-500"
                                  title="Re-run the model over the stored text"
                                  onClick={() => void redistil(doc.id)}
                                >
                                  <RefreshCw className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="rounded-xl text-red-600"
                                  title="Delete this document permanently"
                                  onClick={() => void removeDoc(doc.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        {doc.distill_truncated && (
                          <p className="mb-2 flex items-start gap-1.5 text-[11px] text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                            This document was longer than the distiller&rsquo;s input limit, so the
                            text below is drawn from the first part of it only.
                          </p>
                        )}
                        {!doc.distilled_model && (
                          <p className="mb-2 flex items-start gap-1.5 text-[11px] text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
                            Not distilled — this is raw extracted text. Re-distil once
                            ANTHROPIC_API_KEY is configured.
                          </p>
                        )}

                        <Textarea
                          value={draft}
                          onChange={(e) => setDocDrafts((prev) => ({ ...prev, [doc.id]: e.target.value }))}
                          rows={8}
                          className="font-mono text-[11px]"
                        />

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <label className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <input
                              type="checkbox"
                              checked={doc.is_included}
                              disabled={busy || !doc.distilled_text.trim()}
                              onChange={(e) => void patchDoc(doc.id, { isIncluded: e.target.checked })}
                            />
                            Use this in every brief for {detail.client.label}
                          </label>
                          {!doc.is_included && (
                            <span className="text-[11px] text-slate-500">not in the prompt yet</span>
                          )}
                          {dirty && (
                            <Button
                              size="sm"
                              className="rounded-xl font-bold"
                              disabled={busy}
                              onClick={() => void patchDoc(doc.id, { distilledText: draft })}
                            >
                              Save edits
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {detail.documents.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-2">No documents yet.</p>
                  )}
                </div>
              </section>

              {/* --- The actual prompt --- */}
              <section>
                <SectionHead
                  title="What the model will receive"
                  note={detail.promptPreview ? chars(detail.promptPreviewChars) : 'nothing yet'}
                />
                <p className="text-xs text-slate-500 mb-3">
                  Built by the same function the live brief path uses, from what is saved — not a
                  separate rendering of it, so it cannot drift from what actually gets sent. Unsaved
                  edits above are not reflected here until you save.
                </p>
                <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-700 whitespace-pre-wrap max-h-96 overflow-y-auto">
                  {detail.promptPreview ?? '(this client has no brand context at all, so no client block is sent)'}
                </pre>
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function SectionHead({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1 pb-1.5 border-b-2 border-slate-200">
      <h2 className="text-base md:text-lg font-bold text-slate-800">{title}</h2>
      {note && <span className="text-[11px] text-slate-500">{note}</span>}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 leading-snug">{hint}</p>}
    </div>
  );
}

function ReadOnlyBlock({ title, body }: { title: string; body: string }) {
  return (
    <details className="mb-2 rounded-lg border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-2.5 py-2 text-xs font-bold text-slate-700">
        {title} <span className="font-normal text-slate-500">· {chars(body.length)}</span>
      </summary>
      <pre className="px-2.5 pb-2.5 text-[11px] text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
        {body || '(Pulse sent nothing for this field)'}
      </pre>
    </details>
  );
}
