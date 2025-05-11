import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    try {
        // Access params properly in an async function by using await
        const id = await params.id;
        
        if (!id || !ObjectId.isValid(id)) {
            console.error("Invalid media ID:", id);
            return NextResponse.json({ error: "Invalid media file ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();
        
        console.log(`Fetching media file with ID: ${id}`);
        const mediaFile = await db.collection("mediaFiles").findOne({
            _id: new ObjectId(id)
        });
        
        if (!mediaFile) {
            console.error(`Media file not found: ${id}`);
            return NextResponse.json({ error: "Media file not found" }, { status: 404 });
        }
        
        // Add more detailed logging to debug content-type issues
        console.log(`Found media file: ${id}, type: ${mediaFile.mimeType}, size: ${mediaFile.file.length} bytes`);
        
        // Ensure we have a valid content type for videos
        const contentType = mediaFile.mimeType || 
            (mediaFile.fileType === 'video' ? 'video/mp4' : 
             mediaFile.fileType === 'audio' ? 'audio/mpeg' : 
             'application/octet-stream');
        
        // Convert base64 to binary
        const binaryData = Buffer.from(mediaFile.file, 'base64');
        
        console.log(`Serving media with content-type: ${contentType}`);
        
        // Return the file with appropriate content type
        return new NextResponse(binaryData, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': 'inline',
                'Content-Length': binaryData.length.toString(),
                'Accept-Ranges': 'bytes', // Add support for range requests (streaming)
                'Cache-Control': 'public, max-age=86400' // Cache for 1 day
            }
        });
    } catch (error) {
        console.error("Media API error:", error);
        return NextResponse.json({ error: "Failed to fetch media file" }, { status: 500 });
    }
}

// Add support for range requests (needed for video streaming in some browsers)
export async function HEAD(req: Request, { params }: { params: { id: string } }) {
    // Handle HEAD requests the same as GET but without the response body
    try {
        // Access params properly in an async function by using await
        const id = await params.id;
        
        if (!id || !ObjectId.isValid(id)) {
            return NextResponse.json({ error: "Invalid media file ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();
        
        const mediaFile = await db.collection("mediaFiles").findOne({
            _id: new ObjectId(id)
        });
        
        if (!mediaFile) {
            return NextResponse.json({ error: "Media file not found" }, { status: 404 });
        }
        
        const contentType = mediaFile.mimeType || 
            (mediaFile.fileType === 'video' ? 'video/mp4' : 
             mediaFile.fileType === 'audio' ? 'audio/mpeg' : 
             'application/octet-stream');
        
        // Return just headers for HEAD request
        return new NextResponse(null, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': 'inline',
                'Content-Length': Buffer.from(mediaFile.file, 'base64').length.toString(),
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400'
            }
        });
    } catch (error) {
        console.error("Media HEAD API error:", error);
        return NextResponse.json({ error: "Failed to fetch media file info" }, { status: 500 });
    }
}
