import { parseCsv, parseXlsx } from './spreadsheet';
import type { SupportedKind } from './supported-files';

/**
 * Turn an uploaded file's bytes into plain text.
 *
 * Extracted verbatim from app/api/parse-document/route.ts so the browser upload path and
 * the public API (which receives base64 instead of multipart) run the same parsers. Format
 * and size validation stays with the callers via resolveFileKind / MAX_UPLOAD_BYTES — this
 * function assumes the kind has already been resolved.
 */
export async function extractText(buffer: Buffer, kind: SupportedKind): Promise<string> {
  switch (kind) {
    case 'pdf': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      return result.text;
    }
    case 'docx': {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case 'xlsx': {
      return await parseXlsx(buffer);
    }
    case 'csv': {
      return parseCsv(buffer.toString('utf8'));
    }
  }
}
