import { extractText } from '@/lib/uploads/extract-text';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, resolveFileKind, SUPPORTED_FORMATS_LABEL } from '@/lib/uploads/supported-files';
import { ApiFailure } from './errors';

/**
 * Turn the API's JSON `documents` array into the single `corpus` string the brief
 * generator expects.
 *
 * The joining convention — "# <filename>" headers separated by a horizontal rule — is the
 * same one the browser upload path uses (documented on briefs.corpus in
 * db/supabase/0001_briefs.sql). Matching it matters: the model has only ever been prompted
 * against corpora in that shape.
 */

const SEPARATOR = '\n\n---\n\n';

/** One document, supplied either as base64 bytes to parse or as text already extracted. */
export interface ApiDocumentInput {
  filename?: unknown;
  contentBase64?: unknown;
  text?: unknown;
}

const MAX_DOCUMENTS = 20;

export async function buildCorpusFromDocuments(documents: unknown): Promise<string> {
  if (documents === undefined || documents === null) return '';

  if (!Array.isArray(documents)) {
    throw new ApiFailure('validation_failed', '"documents" must be an array.');
  }
  if (documents.length > MAX_DOCUMENTS) {
    throw new ApiFailure('validation_failed', `Too many documents: ${documents.length}. The maximum is ${MAX_DOCUMENTS}.`);
  }

  const parts: string[] = [];

  for (const [i, raw] of documents.entries()) {
    if (typeof raw !== 'object' || raw === null) {
      throw new ApiFailure('validation_failed', `documents[${i}] must be an object.`);
    }
    const doc = raw as ApiDocumentInput;
    const filename = typeof doc.filename === 'string' && doc.filename.trim() ? doc.filename.trim() : `document-${i + 1}`;

    // Pre-extracted text: trusted as-is, so a caller that already has plain text does not
    // have to base64-encode it just to get it back out again.
    if (typeof doc.text === 'string') {
      if (doc.text.trim()) parts.push(`# ${filename}\n\n${doc.text.trim()}`);
      continue;
    }

    if (typeof doc.contentBase64 !== 'string' || !doc.contentBase64.trim()) {
      throw new ApiFailure('validation_failed', `documents[${i}] needs either "text" or "contentBase64".`);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(doc.contentBase64, 'base64');
    } catch {
      throw new ApiFailure('validation_failed', `documents[${i}].contentBase64 is not valid base64.`);
    }
    if (buffer.length === 0) {
      throw new ApiFailure('validation_failed', `documents[${i}].contentBase64 decoded to zero bytes.`);
    }
    // Same ceiling as the upload UI, so neither path accepts what the other rejects.
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new ApiFailure('payload_too_large', `documents[${i}] (${filename}) exceeds the ${MAX_UPLOAD_LABEL} limit.`);
    }

    const resolved = resolveFileKind(filename);
    if (!resolved.ok) {
      throw new ApiFailure(
        'validation_failed',
        `documents[${i}] (${filename}): unsupported file type. Supported formats are ${SUPPORTED_FORMATS_LABEL}, or send plain text via "text".`,
      );
    }

    let text: string;
    try {
      text = await extractText(buffer, resolved.kind);
    } catch {
      throw new ApiFailure('validation_failed', `documents[${i}] (${filename}) could not be parsed.`);
    }

    if (text.trim()) parts.push(`# ${filename}\n\n${text.trim()}`);
  }

  return parts.join(SEPARATOR);
}
