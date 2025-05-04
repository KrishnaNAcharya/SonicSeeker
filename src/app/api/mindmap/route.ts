// src/app/api/mindmap/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

export async function POST() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'transcripts', 'paragraph.txt');
        console.log('Reading paragraph from:', filePath);

        const transcriptText = await fs.readFile(filePath, 'utf-8');
        console.log('Transcript loaded, length:', transcriptText.length);

        const prompt = `
You are a summarizer and mind map generator.

Given the following transcript text from an audio conversation or talk, extract the core topics and subtopics in a hierarchical mind map format.

- Avoid filler words or generic phrases.
- Focus on semantic relationships.
- Group content by themes or ideas, not timestamps.
- Include a short summary per node (1–2 sentences max).
- Format output as JSON:
{
  "topic": "Main Title",
  "children": [
    {
      "topic": "Subtopic",
      "summary": "Brief explanation...",
      "children": [...]
    }
  ]
}

Transcript: """${transcriptText}"""
`;

        const ollama = spawn('ollama', ['run', 'llama3']);
        let output = '';

        ollama.stdout.on('data', (data) => output += data.toString());
        ollama.stdin.write(prompt);
        ollama.stdin.end();

        return new Promise((resolve) => {
            ollama.on('close', async () => {
                try {
                    const jsonMatch = output.match(/```(?:json)?\s*({[\s\S]*?})\s*```/) || output.match(/{[\s\S]*}/);
                    if (!jsonMatch) {
                        throw new Error("No JSON found in model output.");
                    }

                    let jsonText = jsonMatch[1] || jsonMatch[0];

                    // ✨ Clean up malformed JSON (most common issues)
                    jsonText = jsonText
                        .replace(/,\s*}/g, '}')                         // trailing comma before }
                        .replace(/,\s*]/g, ']')                         // trailing comma before ]
                        .replace(/}\s*(?={\s*"topic")/g, '},')          // missing commas between sibling objects
                        .replace(/"summary":\s*"([^"]*?)"\s*("children"):/g, `"summary":"$1", $2:`); // missing comma between summary and children

                    let mindMap;
                    try {
                        mindMap = JSON.parse(jsonText);
                    } catch (e) {
                        console.error("Cleaned JSON still failed to parse.");
                        await fs.writeFile('public/debug_output_raw.txt', output);
                        await fs.writeFile('public/debug_output_cleaned.json', jsonText);
                        throw e;
                    }

                    await fs.writeFile('public/mindmap.json', JSON.stringify(mindMap, null, 2));
                    console.log('✅ Mind map JSON successfully written.');
                    resolve(NextResponse.json({ mindMap }));
                } catch (err) {
                    console.error('❌ Mind map parsing failed:', err);
                    resolve(NextResponse.json({ error: 'Mind map parsing failed' }, { status: 500 }));
                }
            });
        });
    } catch (err) {
        console.error('❌ Transcript read failed:', err);
        return NextResponse.json({ error: 'Transcript file not found or invalid' }, { status: 500 });
    }
}
