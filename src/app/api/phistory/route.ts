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
        
        // Get key fields from transcriptions, including mediaFileId or mediaBase64
        const history = await db.collection("transcriptions")
            .find({ userId: new ObjectId(userId) })
            .project({
                fileName: 1,
                fileType: 1,
                mimeType: 1,
                uploadDate: 1,
                transcript: 1,
                mediaFileId: 1,  // Include mediaFileId for API-based media retrieval
                mediaBase64: 1   // Include mediaBase64 for legacy/fallback approach
            })
            .sort({ uploadDate: -1 }) // latest first
            .toArray();

        console.log(`Found ${history.length} transcription records`);
        
        // Process and check each entry for mediaFileId or mediaBase64
        const transformed = history.map(entry => {
            // Check if we have mediaFileId reference
            if (entry.mediaFileId) {
                console.log(`Entry ${entry._id}: Has mediaFileId reference`);
            } 
            // Check if we have mediaBase64 data
            else if (entry.mediaBase64) {
                // First 20 chars only for logging purposes
                console.log(`Entry ${entry._id}: Has mediaBase64 data (${entry.mediaBase64.substring(0, 20)}...)`);
            } 
            // No media information
            else {
                console.log(`Entry ${entry._id}: Missing both mediaFileId and mediaBase64`);
            }
            
            return {
                ...entry,
                _id: entry._id?.toString() || null,
                userId: entry.userId?.toString() || null,
                mediaFileId: entry.mediaFileId?.toString() || null,
            };
        });

        return NextResponse.json({ history: transformed }, { status: 200 });
    } catch (err) {
        console.error("History API error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}