import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

// Update your /api/transcription route:
export async function POST(req: Request) {
    try {
        const formData = await req.formData();

        const userId = formData.get("userId")?.toString();
        const fileName = formData.get("fileName")?.toString();
        const fileType = formData.get("fileType")?.toString();
        const transcriptRaw = formData.get("transcript")?.toString();
        const mediaFile = formData.get("mediaFile") as File;

        if (!userId || !fileType || !mediaFile || !transcriptRaw) {
            return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
        }

        const transcript = JSON.parse(transcriptRaw);
        
        // Generate a unique file ID
        const fileId = new ObjectId();
        
        // Here you would normally upload the file to external storage
        // For this example, we'll simulate by creating a URL that would point to the file
        const mediaUrl = `/api/media/${fileId}`; // This would be a real URL in production
        
        const client = await clientPromise;
        const db = client.db();

        const transcription = {
            userId: new ObjectId(userId),
            fileName: fileName || mediaFile.name,
            fileType,
            mimeType: mediaFile.type,
            mediaFileId: fileId, // Store just the ID reference
            // mediaBase64: removed to avoid size issues
            uploadDate: new Date(),
            transcript,
        };

        await db.collection("transcriptions").insertOne(transcription);
        
        // Now store the actual file in a separate collection or service
        // This is simplified - in a real app you might use AWS S3, Azure Blob, etc.
        await db.collection("mediaFiles").insertOne({
            _id: fileId,
            file: Buffer.from(await mediaFile.arrayBuffer()).toString("base64"),
            mimeType: mediaFile.type,
            uploadDate: new Date()
        });

        return NextResponse.json({ message: "Transcription saved successfully" }, { status: 201 });
    } catch (error) {
        console.error("Transcription API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}