import { readFile, writeFile } from 'fs/promises';
import { NextResponse } from 'next/server';

export async function POST() {
    try {
        // 1. Read transcript from new location
        const transcript = await readFile(
            './src/whisper/transcripts/transcript.json',
            'utf-8'
        );

        const data = JSON.parse(transcript);

        // 2. Extract text to paragraph
        const paragraph = data.map((entry: any) => entry.text).join(' ');

        // 3. Save paragraph to public folder
        await writeFile(
            './public/transcripts/paragraph.txt',
            paragraph
        );

        return NextResponse.json({ success: true });

    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to process transcript' },
            { status: 500 }
        );
    }
}
