import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function GET(req: Request, { params }: { params: { userId: string } }) {
    try {
        const { userId } = params;

        // Validate userId
        if (!userId || !ObjectId.isValid(userId)) {
            return NextResponse.json({ message: "Invalid user ID" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        const user = await db.collection("users").findOne(
            { _id: new ObjectId(userId) },
            { projection: { password: 0 } } // Exclude password field
        );

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Return user data
        return NextResponse.json({ user }, { status: 200 });

    } catch (error) {
        console.error("Get User API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
