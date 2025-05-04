import { ObjectId } from "mongodb";

export interface TranscriptSegment {
    start: string;
    end: string;
    text: string;
}

export interface Transcription {
    _id?: ObjectId; // Optional since MongoDB will auto-generate this
    userId: ObjectId; // Reference to User
    fileName?: string;
    fileType: "audio" | "video";
    mimeType?: string; // for easier preview later
    file?: Buffer;
    uploadDate?: Date;
    transcript?: TranscriptSegment[];
}
