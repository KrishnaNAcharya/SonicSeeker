import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';

const execPromise = promisify(exec);

// Helper to find Python
async function findPythonExecutable(): Promise<string> {
    const candidates = process.platform === 'win32'
      ? [
          path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'python3.12.exe'),
          path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'python3.exe'),
          'python',
          'python3',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
          'C:\\Python312\\python.exe',
          'C:\\Python311\\python.exe',
          'C:\\Python310\\python.exe',
        ]
      : ['python3', 'python'];

    for (const cmd of candidates) {
      try {
        await execPromise(`"${cmd}" --version`);
        console.log(`Found Python at: ${cmd}`);
        return cmd;
      } catch (e) { /* Ignore */ }
    }
    throw new Error("Python executable not found.");
}

export async function POST(request: NextRequest) {
  try {
    const { youtubeUrl } = await request.json();

    if (!youtubeUrl || typeof youtubeUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid YouTube URL provided' }, { status: 400 });
    }

    // Validate URL format (basic check)
    try {
      new URL(youtubeUrl);
    } catch (_) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Find Python executable
    const pythonPath = await findPythonExecutable();

    // Path to the youtubeapi script
    const scriptPath = path.join(process.cwd(), 'src', 'whisper', 'youtubeapi.py');
    if (!fs.existsSync(scriptPath)) {
      console.error(`YouTube API script not found at: ${scriptPath}`);
      return NextResponse.json({ error: 'YouTube API script not found on server' }, { status: 500 });
    }

    // Construct the command
    const command = `"${pythonPath}" "${scriptPath}" --url "${youtubeUrl}"`;

    console.log(`Executing command: ${command}`);

    // Execute the Python script
    try {
      const { stdout, stderr } = await execPromise(command, {
        timeout: 60000, // 1 minute timeout
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      // Check stderr first for errors reported by the script
      if (stderr && stderr.includes("ERROR:")) {
        console.error('Python script error:', stderr);
        // Extract the first line of the error
        const errorMsg = stderr.split('\n').find(line => line.startsWith("ERROR:")) || 'Failed to fetch transcript';
        return NextResponse.json({ error: errorMsg.replace("ERROR: ", "") }, { status: 500 });
      }
       if (stderr) {
           console.warn('Python script stderr (info):', stderr); // Log non-error stderr
       }

      // Try parsing the stdout as JSON
      try {
        const transcriptData = JSON.parse(stdout);
        return NextResponse.json({ transcription: transcriptData });
      } catch (parseError) {
        console.error('Failed to parse script output:', parseError);
        console.error('Script stdout:', stdout);
        return NextResponse.json({ error: 'Failed to parse transcript data from script.', details: stdout }, { status: 500 });
      }

    } catch (execError: any) {
      console.error('Error executing Python script:', execError);
      const errorMsg = execError.stderr || execError.stdout || execError.message || 'Unknown execution error';
      // Check if the error message from stderr indicates a known issue
      if (errorMsg.includes("No transcript found") || errorMsg.includes("Transcripts are disabled")) {
         return NextResponse.json({ error: errorMsg.split('\n').find((line: string) => line.includes("ERROR:"))?.replace("ERROR: ", "") || "Transcript not available for this video." }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to execute YouTube transcript script.', details: errorMsg }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message || String(error) }, { status: 500 });
  }
}
