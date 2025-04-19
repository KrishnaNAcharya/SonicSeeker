import { writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Ensure the data is valid
    if (!Array.isArray(data)) {
      return NextResponse.json({ success: false, error: 'Invalid data format. Expected array.' }, { status: 400 });
    }
    
    // Save the transcript data to file
    const filePath = path.join(process.cwd(), 'src', 'whisper', 'transcripts', 'transcript.json');
    await writeFile(filePath, JSON.stringify(data, null, 2));
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving transcript:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
