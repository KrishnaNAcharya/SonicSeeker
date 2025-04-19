// api/media/[id].ts
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        const { id } = params;
        
        if (!id) {
            return NextResponse.json({ error: "File ID is required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();
        
        const mediaFile = await db.collection("mediaFiles").findOne({
            _id: new ObjectId(id)
        });
        
        if (!mediaFile) {
            return NextResponse.json({ error: "File not found" }, { status: 404 });
        }
        
        // Convert base64 to binary
        const binaryData = Buffer.from(mediaFile.file, 'base64');
        
        // Return the file with appropriate content type
        return new NextResponse(binaryData, {
            headers: {
                'Content-Type': mediaFile.mimeType,
                'Content-Disposition': 'inline',
                'Cache-Control': 'public, max-age=86400' // Cache for 1 day
            }
        });
    } catch (error) {
        console.error("Media API error:", error);
        return NextResponse.json({ error: "Failed to fetch media file" }, { status: 500 });
    }
}