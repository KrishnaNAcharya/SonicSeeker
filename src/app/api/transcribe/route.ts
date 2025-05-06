import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';
import { writeFile, readFile, unlink } from 'fs/promises';

const execPromise = promisify(exec);

// Increase limits if needed
export const config = {
  api: {
    bodyParser: false, // Required for FormData
    responseLimit: '10mb',
  },
};

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
      } catch (e) {
        // Ignore and try next candidate
      }
    }
    console.error("Could not find Python executable.");
    throw new Error("Python executable not found.");
}


export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;
  let outputJsonPath: string | null = null;
  const apiRequestStartTime = Date.now(); // Record API request start time

  try {
    const formData = await request.formData();
    const mediaFile = formData.get('mediaFile') as File | null;
    const diarize = formData.get('diarize') === 'true'; // Get diarization flag
    console.log(`Diarization requested: ${diarize}`); // Log if diarization is requested

    if (!mediaFile) {
      return NextResponse.json({ error: 'No media file uploaded' }, { status: 400 });
    }

    // --- Get Hugging Face Token (use HF_TOKEN consistently) ---
    const hfToken = process.env.HF_TOKEN; // Read HF_TOKEN from .env
    if (diarize) {
        if (!hfToken) {
            console.warn("Diarization requested, but HF_TOKEN environment variable is not set.");
        } else {
            console.log("HF_TOKEN found for diarization.");
        }
    }

    // Create a temporary directory for uploads if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'whisper-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Save the uploaded file temporarily
    const fileBuffer = Buffer.from(await mediaFile.arrayBuffer());
    tempFilePath = path.join(tempDir, `${Date.now()}-${mediaFile.name}`);
    await writeFile(tempFilePath, fileBuffer);
    console.log(`Temporary file saved to: ${tempFilePath}`);

    // Define path for the output JSON
    outputJsonPath = path.join(tempDir, `${path.basename(tempFilePath, path.extname(tempFilePath))}.json`);

    // Find Python executable
    const pythonPath = await findPythonExecutable();

    // Path to the transcription script
    const scriptPath = path.join(process.cwd(), 'src', 'whisper', 'transcribe.py');
    if (!fs.existsSync(scriptPath)) {
      console.error(`Transcription script not found at: ${scriptPath}`);
      return NextResponse.json({ error: 'Transcription script not found on server' }, { status: 500 });
    }

    // Construct the command
    const commandParts = [
      `"${pythonPath}"`,
      `"${scriptPath}"`,
      `--input "${tempFilePath}"`,
      `--output-json "${outputJsonPath}"`,
    ];

    if (diarize) {
      commandParts.push('--diarize');
      if (hfToken) {
        // Pass token securely (consider if direct command line is okay, or use env var within python script only)
        // Here we pass it as an argument, ensure your python script handles it
         commandParts.push(`--hf-token "${hfToken}"`);
         console.log("Passing --diarize and --hf-token flags to script.");
      } else {
         console.log("Passing --diarize flag without --hf-token to script.");
      }
    }
    // Add other Whisper args if needed (e.g., --model)

    const command = commandParts.join(' ');

    console.log(`Executing command: ${command.replace(hfToken ?? "dummy-token", "[HF_TOKEN_HIDDEN]")}`); // Hide token in logs

    // Execute the Python script
    const scriptStartTime = Date.now(); // Record script execution start time
    try {
        const { stdout, stderr } = await execPromise(command, {
            timeout: 600000, // 10 minute timeout
            maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        });
        const scriptEndTime = Date.now(); // Record script execution end time
        const scriptDuration = ((scriptEndTime - scriptStartTime) / 1000).toFixed(2); // Calculate duration in seconds

        if (stderr) {
            console.warn('Python script stderr:', stderr); // Log stderr as warning
        }
        console.log('Python script stdout:', stdout);

        // Check if the output JSON file was created
        if (!fs.existsSync(outputJsonPath)) {
            console.error('Output JSON file was not created by the script.');
            console.error('Script stderr:', stderr); // Log stderr again on error
            return NextResponse.json({ error: 'Transcription failed: Output file not generated.', details: stderr || stdout }, { status: 500 });
        }

        // Read the transcription result from the JSON file
        const transcriptionResult = await readFile(outputJsonPath, 'utf-8');
        const resultData = JSON.parse(transcriptionResult); // Parse the whole object

        // Add script execution time to metrics
        const executionTimeMetric = `Total Script Execution Time: ${scriptDuration} seconds`;
        if (resultData.metrics && Array.isArray(resultData.metrics)) {
            resultData.metrics.push(executionTimeMetric);
        } else {
            resultData.metrics = [executionTimeMetric];
        }

        // Check if the script wrote an error into the JSON
        if (resultData.error) {
            console.error('Transcription script reported an error:', resultData.error);
            return NextResponse.json({ error: `Transcription failed: ${resultData.error}`, metrics: resultData.metrics || [] }, { status: 500 });
        }

        // Return the full data (including transcription and metrics)
        return NextResponse.json(resultData); // Return the whole object { transcription: [...], metrics: [...] }

    } catch (execError: any) {
        const scriptEndTime = Date.now(); // Record script execution end time even on error
        const scriptDuration = ((scriptEndTime - scriptStartTime) / 1000).toFixed(2);
        console.error('Error executing Python script:', execError);
        // Try to read output JSON even if exec failed, might contain partial results or error info
        let errorDetails = execError.stderr || execError.stdout || execError.message || 'Unknown execution error';
        let metricsOnError: string[] = [];
        if (fs.existsSync(outputJsonPath)) {
             try {
                 const partialResultJson = await readFile(outputJsonPath, 'utf-8');
                 const partialResultData = JSON.parse(partialResultJson);
                 errorDetails += `\nPartial output: ${JSON.stringify(partialResultData.transcription || partialResultJson)}`;
                 metricsOnError = partialResultData.metrics || []; // Get metrics even on error
             } catch (readErr) { /* ignore read error */ }
        }
        // Add script execution time to metrics even on error
        metricsOnError.push(`Total Script Execution Time: ${scriptDuration} seconds (Failed)`);
        return NextResponse.json({ error: 'Failed to execute transcription script.', details: errorDetails, metrics: metricsOnError }, { status: 500 });
    }

  } catch (error: any) {
    console.error('API Error:', error);
    const apiRequestEndTime = Date.now();
    const apiDuration = ((apiRequestEndTime - apiRequestStartTime) / 1000).toFixed(2);
    return NextResponse.json({ error: 'An unexpected error occurred.', details: error.message || String(error), metrics: [`API Request Duration: ${apiDuration} seconds (Failed)`] }, { status: 500 });
  } finally {
    // Clean up temporary files
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        await unlink(tempFilePath);
        console.log(`Cleaned up temporary input file: ${tempFilePath}`);
      } catch (e) {
        console.error(`Error cleaning up temporary input file ${tempFilePath}:`, e);
      }
    }
    if (outputJsonPath && fs.existsSync(outputJsonPath)) {
      try {
        await unlink(outputJsonPath);
        console.log(`Cleaned up temporary output file: ${outputJsonPath}`);
      } catch (e) {
        console.error(`Error cleaning up temporary output file ${outputJsonPath}:`, e);
      }
    }
  }
}
