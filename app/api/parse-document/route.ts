import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const MAX_SIZE = 1 * 1024 * 1024; // 1 MB
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'File size exceeds 1 MB limit.' }, { status: 400 });
        }

        const mimeType = file.type;
        const isPdf = mimeType === 'application/pdf';
        const isDocx = mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

        if (!isPdf && !isDocx) {
            return NextResponse.json({ error: 'Unsupported file type. Please upload a PDF or DOCX file.' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const ext = isPdf ? '.pdf' : '.docx';
        const tempFilePath = path.join('/tmp', `${uuidv4()}${ext}`);
        fs.writeFileSync(tempFilePath, buffer);

        let text = '';

        try {
            if (isPdf) {
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                const pdfParse = require('pdf-parse') as (buf: Buffer) => Promise<{ text: string }>;
                const result = await pdfParse(buffer);
                text = result.text;
            } else {
                const mammoth = await import('mammoth');
                const result = await mammoth.extractRawText({ path: tempFilePath });
                text = result.value;
            }
        } finally {
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }

        return NextResponse.json({ text });
    } catch (error) {
        console.error('Document parse error:', error);
        return NextResponse.json({ error: 'Failed to parse document' }, { status: 500 });
    }
}
