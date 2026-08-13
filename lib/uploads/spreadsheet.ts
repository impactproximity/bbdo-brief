/**
 * Server-side spreadsheet -> plain text extraction.
 *
 * The output feeds an LLM prompt, so it is flattened to delimited rows grouped
 * by sheet, and hard-capped: an upload-sized workbook can hold millions of cells, which
 * would otherwise blow past the model's context window.
 */

const MAX_ROWS_PER_SHEET = 1000;
const MAX_COLUMNS = 60;
const MAX_OUTPUT_CHARS = 100_000;
const CELL_SEPARATOR = ' | ';

/** Excel serial dates and rich text need coercing; everything else stringifies cleanly. */
function cellToText(value: unknown): string {
  if (value === null || value === undefined) return '';

  if (value instanceof Date) return value.toISOString().slice(0, 10);

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;

    // Rich text: { richText: [{ text }, ...] }
    if (Array.isArray(obj.richText)) {
      return (obj.richText as Array<{ text?: string }>).map((r) => r.text ?? '').join('');
    }
    // Formula: { formula, result } — the computed result is what matters.
    if ('result' in obj) return cellToText(obj.result);
    if ('formula' in obj) return '';
    // Hyperlink: { text, hyperlink }
    if ('text' in obj) return cellToText(obj.text);
    // Error cell: { error: '#DIV/0!' }
    if ('error' in obj) return String(obj.error);

    return '';
  }

  return String(value);
}

/** Collapse whitespace and escape the delimiter so rows stay parseable. */
function sanitizeCell(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();
}

function joinRow(cells: string[]): string {
  // Drop trailing empties so sparse sheets don't emit long tails of separators.
  let end = cells.length;
  while (end > 0 && cells[end - 1] === '') end--;
  return cells.slice(0, end).join(CELL_SEPARATOR);
}

function assemble(sections: string[]): string {
  const text = sections.join('\n\n');
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n\n[Truncated — spreadsheet exceeded the ${MAX_OUTPUT_CHARS.toLocaleString()} character extraction limit.]`;
}

export async function parseXlsx(buffer: Buffer): Promise<string> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sections: string[] = [];

  workbook.eachSheet((sheet) => {
    const lines: string[] = [];
    let truncated = false;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber > MAX_ROWS_PER_SHEET) {
        truncated = true;
        return;
      }

      // row.values is 1-indexed with a leading hole; slice it off.
      const raw = Array.isArray(row.values) ? row.values.slice(1, MAX_COLUMNS + 1) : [];
      const cells = raw.map((v) => sanitizeCell(cellToText(v)));
      const line = joinRow(cells);
      if (line) lines.push(line);
    });

    if (lines.length === 0) return;

    if (truncated) {
      lines.push(`[Truncated — only the first ${MAX_ROWS_PER_SHEET} rows of this sheet were read.]`);
    }

    sections.push(`## Sheet: ${sheet.name}\n${lines.join('\n')}`);
  });

  return assemble(sections);
}

/** Pick the delimiter that yields the most consistent column count on the first lines. */
function detectDelimiter(sample: string): string {
  const candidates = [',', ';', '\t', '|'];
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? '';

  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    // Count only delimiters outside quoted spans.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const char = firstLine[i];
      if (char === '"') inQuotes = !inQuotes;
      else if (char === candidate && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/** RFC 4180 parser — handles quoted fields containing delimiters, newlines and escaped quotes. */
function parseDelimited(input: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseCsv(raw: string): string {
  // Strip the UTF-8 BOM Excel writes on export, or it contaminates the first header.
  const input = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  if (!input.trim()) return '';

  const delimiter = detectDelimiter(input);
  const rows = parseDelimited(input, delimiter);

  const lines: string[] = [];
  let truncated = false;

  for (const cells of rows) {
    if (lines.length >= MAX_ROWS_PER_SHEET) {
      truncated = true;
      break;
    }
    const line = joinRow(cells.slice(0, MAX_COLUMNS).map((c) => sanitizeCell(c)));
    if (line) lines.push(line);
  }

  if (truncated) {
    lines.push(`[Truncated — only the first ${MAX_ROWS_PER_SHEET} rows were read.]`);
  }

  return assemble(lines.length ? [lines.join('\n')] : []);
}
