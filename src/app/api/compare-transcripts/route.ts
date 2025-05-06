import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import { writeFile, readFile, unlink } from 'fs/promises';

const execPromise = promisify(exec);

// Helper to find Python (reuse from transcribe route or define here)
async function findPythonExecutable(): Promise<string> {
    const candidates = process.platform === 'win32'
      ? [
          path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'python3.12.exe'),
          path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'python3.exe'),
          'python',
          'python3',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
          'C:\\Python312\\python.exe', // Add common install paths
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

async function saveTemporaryFile(file: File, tempDir: string): Promise<string> {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const tempFilePath = path.join(tempDir, `${Date.now()}-${file.name}`);
    await writeFile(tempFilePath, fileBuffer);
    console.log(`Temporary file saved to: ${tempFilePath}`);
    return tempFilePath;
}

// Updated function to save text to a temporary file with logging
async function saveTemporaryTextFile(text: string, tempDir: string, prefix: string): Promise<string> {
    const tempFilePath = path.join(tempDir, `${prefix}-${Date.now()}.txt`);
    // --- Add Logging ---
    if (!text || text.trim().length === 0) {
        console.warn(`Attempting to save empty or whitespace-only text to ${tempFilePath} for prefix '${prefix}'.`);
    } else {
        console.log(`Saving text (length: ${text.length}) to ${tempFilePath} for prefix '${prefix}'. First 100 chars: ${text.substring(0,100)}...`);
    }
    // --- End Logging ---
    await writeFile(tempFilePath, text, 'utf-8');
    console.log(`Temporary text file saved to: ${tempFilePath}`);
    return tempFilePath;
}

export async function POST(request: NextRequest) {
  let tempFile1Path: string | null = null;
  let tempFile2Path: string | null = null;
  let outputJsonPath: string | null = null;
  let mode: 'metrics' | 'wer' = 'metrics'; // Default mode

  try {
    const contentType = request.headers.get('content-type') || '';
    let file1: File | null = null;
    let file2: File | null = null;
    let referenceText: string | null = null;
    let hypothesisText: string | null = null;

    // Create a temporary directory
    const tempDir = path.join(os.tmpdir(), 'transcript-compare');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        file1 = formData.get('file1') as File | null;
        file2 = formData.get('file2') as File | null;
        mode = formData.get('mode') === 'wer' ? 'wer' : 'metrics'; // Get mode from form data

        if (!file1 || !file2) {
          return NextResponse.json({ error: 'Two files are required for form-data comparison' }, { status: 400 });
        }
        if (mode === 'metrics' && (file1.type !== 'application/json' || file2.type !== 'application/json')) {
            return NextResponse.json({ error: 'Both uploaded files must be JSON for metrics comparison.' }, { status: 400 });
        }
        // Save uploaded files temporarily
        tempFile1Path = await saveTemporaryFile(file1, tempDir);
        tempFile2Path = await saveTemporaryFile(file2, tempDir);

    } else if (contentType.includes('application/json')) {
        const body = await request.json();
        referenceText = body.referenceText;
        hypothesisText = body.hypothesisText;
        mode = 'wer'; // Assume WER mode for text input

        if (!referenceText || !hypothesisText) {
            // Add more specific logging
            console.error(`Missing text for comparison: Reference provided: ${!!referenceText}, Hypothesis provided: ${!!hypothesisText}`);
            return NextResponse.json({ error: 'referenceText and hypothesisText are required for JSON comparison' }, { status: 400 });
        }
        // Save text to temporary files (logging is now inside saveTemporaryTextFile)
        tempFile1Path = await saveTemporaryTextFile(referenceText, tempDir, 'ref');
        tempFile2Path = await saveTemporaryTextFile(hypothesisText, tempDir, 'hyp');

    } else {
        return NextResponse.json({ error: 'Unsupported Content-Type' }, { status: 415 });
    }


    // Define path for the output metrics JSON
    outputJsonPath = path.join(tempDir, `metrics-${Date.now()}.json`);

    // Find Python executable
    const pythonPath = await findPythonExecutable();

    // Path to the comparison script
    const scriptPath = path.join(process.cwd(), 'src', 'whisper', 'compare_transcripts.py');
    if (!fs.existsSync(scriptPath)) {
      console.error(`Comparison script not found at: ${scriptPath}`);
      return NextResponse.json({ error: 'Comparison script not found on server' }, { status: 500 });
    }

    // Construct the command, adding the mode
    const command = `"${pythonPath}" "${scriptPath}" --file1 "${tempFile1Path}" --file2 "${tempFile2Path}" --output-json "${outputJsonPath}" --mode "${mode}"`;
    console.log(`Executing command: ${command}`);

    // Execute the Python script
    try {
      const { stdout, stderr } = await execPromise(command, {
        timeout: 60000, // 1 minute timeout
        maxBuffer: 1 * 1024 * 1024 // 1MB buffer should be enough for metrics
      });

      if (stderr) {
        console.warn('Python script stderr:', stderr); // Log stderr as warning
      }
      console.log('Python script stdout:', stdout);

      // Check if the output JSON file was created
      if (!fs.existsSync(outputJsonPath)) {
        console.error('Output metrics JSON file was not created by the script.');
        console.error('Script stderr:', stderr);
        return NextResponse.json({ error: 'Comparison failed: Output file not generated.', details: stderr || stdout }, { status: 500 });
      }

      // Read the metrics result from the JSON file
      const metricsResult = await readFile(outputJsonPath, 'utf-8');
      const resultData = JSON.parse(metricsResult);

      // Check if the script wrote an error into the JSON
      if (resultData.error) {
        console.error('Comparison script reported an error:', resultData.error);
        return NextResponse.json({ error: `Comparison failed: ${resultData.error}` }, { status: 500 });
      }

      // Return the metrics
      return NextResponse.json(resultData);

    } catch (execError: any) {
      console.error('Error executing Python script:', execError);
      // Try to read output JSON even if exec failed
      let errorDetails = execError.stderr || execError.stdout || execError.message || 'Unknown execution error';
      if (fs.existsSync(outputJsonPath)) {
           try {
               const partialResultJson = await readFile(outputJsonPath, 'utf-8');
               const partialResultData = JSON.parse(partialResultJson);
               if (partialResultData.error) {
                   errorDetails = partialResultData.error; // Use error from JSON if available
               }
           } catch (readErr) { /* ignore read error */ }
      }
      return NextResponse.json({ error: 'Failed to execute comparison script.', details: errorDetails }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message || String(error) }, { status: 500 });
  } finally {
    // Clean up temporary files
    const cleanupPromises = [tempFile1Path, tempFile2Path, outputJsonPath]
        .filter(Boolean)
        .map(async (filePath) => {
            if (fs.existsSync(filePath!)) {
                try {
                    await unlink(filePath!);
                    console.log(`Cleaned up temporary file: ${filePath}`);
                } catch (e) {
                    console.error(`Error cleaning up temporary file ${filePath}:`, e);
                }
            }
        });
    await Promise.all(cleanupPromises);
  }
}
