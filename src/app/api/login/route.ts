// app/api/login/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import clientPromise from "@/lib/mongodb";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ message: "Username and password are required" }, { status: 400 });
        }

        const client = await clientPromise;
        const db = client.db();

        // Find the user by username
        const user = await db.collection("users").findOne({ username });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Compare the hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json({ message: "Invalid credentials" }, { status: 401 });
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, username: user.username },
            process.env.JWT_SECRET!, // Make sure JWT_SECRET is set in your .env
            { expiresIn: "10m" }
        );

        return NextResponse.json(
            {
                message: "Login successful",
                user: { username: user.username, email: user.email },
                token,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Login API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
