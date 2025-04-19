import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Basic keyword extractor
const extractKeywords = (text: string) => {
    const stopwords = new Set(["the", "is", "in", "at", "of", "and", "a", "to"]);
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(" ")
        .filter(word => !stopwords.has(word) && word.length > 2);
    };

    export async function GET() {
    const transcriptPath = path.join(process.cwd(), "src","whisper","transcripts", "transcript.json");
    const raw = fs.readFileSync(transcriptPath, "utf-8");
    const data: { start: string; end: string; text: string }[] = JSON.parse(raw);

    const keywordMap: Record<string, string[]> = {};

    for (const segment of data) {
        const keywords = extractKeywords(segment.text);
        if (keywords.length === 0) continue;

        const mainKeyword = keywords[0]; // Pick first keyword as main topic
        if (!keywordMap[mainKeyword]) {
        keywordMap[mainKeyword] = [];
        }
        keywordMap[mainKeyword].push(segment.text);
    }

    const mindMap = Object.entries(keywordMap).map(([keyword, texts]) => ({
        id: keyword,
        title: keyword,
        children: texts.map((text, idx) => ({
        id: `${keyword}-${idx}`,
        title: text
        }))
    }));

    return NextResponse.json(mindMap);
    }
