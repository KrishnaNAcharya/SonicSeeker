import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs';

const execPromise = promisify(exec);

// Increase response limit for larger translations
export const config = {
  api: {
    responseLimit: '10mb',
  },
};

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const data = await request.json();
    const { text, targetLanguage } = data;

    if (!text) {
      return NextResponse.json({ error: 'No text provided for translation' }, { status: 400 });
    }

    if (!targetLanguage) {
      return NextResponse.json({ error: 'No target language specified' }, { status: 400 });
    }

    // Find the correct Python executable using environment variables first
    let pythonPath = 'python3'; // Default for non-Windows
    
    if (process.platform === 'win32') {
      // Try to use the path from environment variable first
      const envPythonPath = process.env.PYTHON_PATH_WIN;
      if (envPythonPath) {
        // Replace ~ with the user's home directory if present
        const resolvedPath = envPythonPath.replace(/^~/, os.homedir());
        
        try {
          await execPromise(`"${resolvedPath}" --version`);
          pythonPath = resolvedPath;
          console.log(`Using Python from PYTHON_PATH_WIN: ${pythonPath}`);
        } catch (e) {
          console.warn(`Python at PYTHON_PATH_WIN (${resolvedPath}) not found or not working, falling back to alternatives`);
        }
      }
      
      // If environment variable path doesn't work, try alternatives
      if (pythonPath === 'python3') {
        const alternatives = [
          path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'WindowsApps', 'python3.12.exe'),
          'python',
          'python3',
          path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Python', 'Python312', 'python.exe'),
          'C:\\Python312\\python.exe',
          'C:\\Python311\\python.exe',
          'C:\\Python310\\python.exe',
          'C:\\Python39\\python.exe',
        ];
        
        for (const alt of alternatives) {
          try {
            await execPromise(`"${alt}" --version`);
            pythonPath = alt;
            console.log(`Found Python at alternative path: ${alt}`);
            break;
          } catch (e) {
            // Try next alternative
          }
        }
      }
    }

    // Path to the translation script
    const scriptPath = path.join(process.cwd(), 'src', 'whisper', 'translate.py');

    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.error(`Translation script not found at: ${scriptPath}`);
      return NextResponse.json({ error: 'Translation script not found' }, { status: 500 });
    }

    // Encode text to avoid command-line issues - base64 encoding is safer for command-line
    const encodedText = Buffer.from(text).toString('base64');
    
    // Create a temporary file for output
    const tempDir = path.join(os.tmpdir(), 'translations');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const outputFile = path.join(tempDir, `translation-${Date.now()}.txt`);

    // Use a command that writes to file instead of stdout to avoid encoding issues
    const command = `"${pythonPath}" "${scriptPath}" --text "${encodedText}" --target "${targetLanguage}" --base64 --output-file "${outputFile}"`;
    
    console.log(`Executing translation command (text length: ${text.length} chars)`);
    console.log(`Command: ${pythonPath} ${scriptPath} --base64 [text hidden] --target ${targetLanguage} --output-file ${outputFile}`);
    
    try {
      // Execute with a generous timeout for larger texts
      const { stdout, stderr } = await execPromise(command, {
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large translations
        timeout: 180000 // 3 minute timeout
      });

      // Log any errors but don't necessarily fail because of them
      if (stderr) {
        console.log('Translation stderr (info):', stderr);
      }

      // Check if the output file exists
      if (!fs.existsSync(outputFile)) {
        console.error('Output file was not created');
        return NextResponse.json({ 
          error: 'Translation output file was not created',
          details: stderr || 'No additional error information available' 
        }, { status: 500 });
      }

      // Read the translated text from file
      const translatedText = fs.readFileSync(outputFile, { encoding: 'utf-8' });

      // Clean up the temporary file
      try {
        fs.unlinkSync(outputFile);
      } catch (cleanupError) {
        console.warn('Error cleaning up temporary file:', cleanupError);
      }

      // Check if the text indicates an error
      if (translatedText.startsWith('ERROR:')) {
        console.error('Translation script error:', translatedText);
        return NextResponse.json({ 
          error: translatedText.trim()
        }, { status: 500 });
      }

      // Return successful translation
      return NextResponse.json({ translatedText: translatedText.trim() });
    } catch (execError) {
      console.error('Error executing translation command:', execError);
      
      // Try to read from output file if it exists, even though there was an exec error
      if (fs.existsSync(outputFile)) {
        try {
          const translatedText = fs.readFileSync(outputFile, { encoding: 'utf-8' });
          
          // Clean up the temporary file
          try {
            fs.unlinkSync(outputFile);
          } catch (cleanupError) {
            console.warn('Error cleaning up temporary file:', cleanupError);
          }
          
          if (!translatedText.startsWith('ERROR:')) {
            return NextResponse.json({ translatedText: translatedText.trim() });
          }
        } catch (readError) {
          console.error('Error reading output file:', readError);
        }
      }
      
      return NextResponse.json({ 
        error: 'Failed to execute translation command: ' + 
               (execError instanceof Error ? execError.message : String(execError)),
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Translation API error:', error);
    return NextResponse.json({ 
      error: 'Translation error: ' + (error instanceof Error ? error.message : String(error)) 
    }, { status: 500 });
  }
}
