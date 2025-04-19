import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { transcript } = await req.json();

        // Log the incoming request body
        console.log("Received request:", transcript);

        const truncatedText = transcript.slice(0, 10000);
        console.log("Truncated text:", truncatedText);

        const hfToken = process.env.HUGGINGFACE_API_KEY;
        if (!hfToken) {
            console.error("Missing Hugging Face API token");
            return NextResponse.json(
                { error: "Missing Hugging Face API token" },
                { status: 500 }
            );
        }

        // Fetch from Hugging Face API
        const response = await fetch(
            "https://api-inference.huggingface.co/models/facebook/bart-large-cnn",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${hfToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ inputs: truncatedText }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error("Hugging Face error:", error);
            return NextResponse.json({ error }, { status: response.status });
        }

        const result = await response.json();
        console.log("Hugging Face API response:", result);

        if (result && result[0] && result[0].summary_text) {
            return NextResponse.json({ summary: result[0].summary_text });
        }

        console.error("No summary returned by Hugging Face.");
        return NextResponse.json({ error: "No summary returned by Hugging Face" }, { status: 500 });
    } catch (error) {
        console.error("Unexpected error in POST handler:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}