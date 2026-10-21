import { NextResponse } from 'next/server';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, resolveFileKind } from '@/lib/uploads/supported-files';
import { extractText } from '@/lib/uploads/extract-text';

// Multipart framing (boundaries, part headers) adds a little on top of the file itself.
const MULTIPART_OVERHEAD_ALLOWANCE = 1024 * 1024;

export async function POST(req: Request) {
    try {
        // Reject on Content-Length before reading the body. Past the proxy buffer
        // limit the body arrives truncated and formData() throws an opaque parse
        // error, so this has to happen first to produce a useful message.
        const declaredLength = Number(req.headers.get('content-length') ?? 0);
        if (declaredLength > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_ALLOWANCE) {
            return NextResponse.json({ error: `File size exceeds ${MAX_UPLOAD_LABEL} limit.` }, { status: 413 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (file.size > MAX_UPLOAD_BYTES) {
            return NextResponse.json({ error: `File size exceeds ${MAX_UPLOAD_LABEL} limit.` }, { status: 400 });
        }

        const resolved = resolveFileKind(file.name ?? '', file.type);
        if (!resolved.ok) {
            return NextResponse.json({ error: resolved.error }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Parsing lives in lib/uploads/extract-text.ts, shared with the public API so both
        // entry points produce identical corpus text from the same file.
        const text = await extractText(buffer, resolved.kind);

        return NextResponse.json({ text });
    } catch (error) {
        console.error('Document parse error:', error);
        return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 });
    }
}
