// app/api/signup/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
    try {
        const { username, email, password } = await req.json();
        const client = await clientPromise;
        const db = client.db();

        const existingUser = await db.collection("users").findOne({ email });
        if (existingUser) {
            return NextResponse.json({ message: "User already exists" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await db.collection("users").insertOne({
            username,
            email,
            password: hashedPassword,
        });

        return NextResponse.json({ message: "User created successfully" }, { status: 201 });
    } catch (error) {
        console.error("Signup API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
