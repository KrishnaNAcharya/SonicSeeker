import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();
        if (!userId) {
            return NextResponse.json({ message: "Missing userId" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Log the request for debugging
        console.log(`Fetching history for user: ${userId}`);
        
        // Get all fields from the collection - especially focus on getting mediaBase64
        const history = await db.collection("transcriptions")
            .find({ userId: new ObjectId(userId) })
            .project({
                fileName: 1,
                fileType: 1,
                mimeType: 1,  // Include the MIME type
                uploadDate: 1,
                transcript: 1,
                mediaBase64: 1  // Get mediaBase64 instead of mediaFile
            })
            .sort({ uploadDate: -1 }) // latest first
            .toArray();

        console.log(`Found ${history.length} transcription records`);
        
        // Convert ObjectIds to strings for JSON serialization
        const transformed = history.map(entry => ({
            ...entry,
            _id: entry._id?.toString() || null,
            userId: entry.userId?.toString() || null,
            // Don't need to convert mediaBase64 since it's already in base64 format
        }));

        return NextResponse.json({ history: transformed }, { status: 200 });
    } catch (err) {
        console.error("History API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}