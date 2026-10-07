import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSession } from '@/lib/auth';
import { recordUsage } from '@/lib/usage/record';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as Blob;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            // Mock response if no key is present for testing UI
            console.warn("No OPENAI_API_KEY found, using mock transcription.");
            return NextResponse.json({ text: "This is a mock transcription because no API key was found. I am talking about project Alpha." });
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Convert Blob to File-like object (buffer) for OpenAI
        const buffer = Buffer.from(await file.arrayBuffer());

        // We need to write to a temporary file because OpenAI SDK expects a file path or a read stream with path metadata often
        // or we can use the 'file' object directly if we are careful. 
        // Easier for Node environment: write to tmp
        const tempFilePath = path.join('/tmp', `${uuidv4()}.webm`);
        fs.writeFileSync(tempFilePath, buffer);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: 'whisper-1',
        });

        // Count the invocation without costing it.
        //
        // whisper-1 bills per minute of audio and returns no usage object, so there is no
        // billable quantity in the response. Obtaining one would mean switching this call to
        // response_format: 'verbose_json' for its `duration` field — a change to a working
        // route purely for telemetry, which was explicitly ruled out. audio_seconds stays
        // null, which the report renders as "unpriced" rather than as free.
        recordUsage({
            route: 'transcribe',
            provider: 'openai',
            model: 'whisper-1',
            session: await getSession(),
        });

        // Cleanup
        fs.unlinkSync(tempFilePath);

        return NextResponse.json({ text: transcription.text });
    } catch (error) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }
}
