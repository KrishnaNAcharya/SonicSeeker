// src/utils/decodeToken.ts
import jwtDecode from "jwt-decode";

interface DecodedToken {
    userId: string;
    username: string;
    exp: number;
    iat: number;
}

export function getUserFromToken(): DecodedToken | null {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const decoded = jwtDecode<DecodedToken>(token);
        return decoded;
    } catch (error) {
        console.error("Invalid token:", error);
        return null;
    }
}
