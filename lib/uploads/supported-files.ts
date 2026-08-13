/**
 * Single source of truth for which files the uploaders accept.
 * Shared by the client pickers and /api/parse-document so they can never drift.
 */

export type SupportedKind = 'pdf' | 'docx' | 'xlsx' | 'csv';

/**
 * Browsers are unreliable about spreadsheet MIME types — a .csv can arrive as
 * text/csv, application/vnd.ms-excel or an empty string depending on the OS and
 * which apps are installed. Extension is the primary signal; MIME is a fallback
 * for drag-and-drop cases where the name is missing.
 */
const KIND_BY_EXTENSION: Record<string, SupportedKind> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.xlsm': 'xlsx',
  '.csv': 'csv',
  '.tsv': 'csv',
};

const KIND_BY_MIME: Record<string, SupportedKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel.sheet.macroenabled.12': 'xlsx',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
};

/** Legacy binary formats we deliberately reject, with advice instead of a generic error. */
const LEGACY_EXTENSIONS: Record<string, string> = {
  '.doc': 'Legacy .doc files are not supported. Please re-save the file as .docx.',
  '.xls': 'Legacy .xls files are not supported. Please re-save the file as .xlsx or .csv.',
};

export const SUPPORTED_EXTENSIONS = Object.keys(KIND_BY_EXTENSION);

/** Value for an <input type="file"> accept attribute. */
export const FILE_ACCEPT_ATTR = [
  ...SUPPORTED_EXTENSIONS,
  ...Object.keys(KIND_BY_MIME),
].join(',');

/** Human-readable list for UI copy. */
export const SUPPORTED_FORMATS_LABEL = 'PDF, DOCX, XLSX or CSV';

/**
 * Upload ceiling, per file. Kept here so every entry point enforces the same
 * number. Well under the 100 MB Vercel Functions request-body limit; the real
 * constraint is the model context window the extracted text ends up in.
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '15 MB';

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot === -1 ? '' : fileName.slice(dot).toLowerCase();
}

export type FileKindResult =
  | { ok: true; kind: SupportedKind }
  | { ok: false; error: string };

/**
 * Resolve a file to a parser kind, or explain why it is rejected.
 * Extension wins over MIME because .csv is routinely reported as an Excel type.
 */
export function resolveFileKind(fileName: string, mimeType?: string): FileKindResult {
  const ext = extensionOf(fileName);

  const byExtension = KIND_BY_EXTENSION[ext];
  if (byExtension) return { ok: true, kind: byExtension };

  const legacy = LEGACY_EXTENSIONS[ext];
  if (legacy) return { ok: false, error: legacy };

  const byMime = mimeType ? KIND_BY_MIME[mimeType.toLowerCase()] : undefined;
  if (byMime) return { ok: true, kind: byMime };

  return { ok: false, error: `Unsupported file type. Please upload a ${SUPPORTED_FORMATS_LABEL} file.` };
}
