import { checkDatabaseConnection } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const health = await checkDatabaseConnection();

        if (health.connected) {
            return NextResponse.json({
                status: "healthy",
                database: "connected",
                timestamp: new Date().toISOString()
            });
        } else {
            return NextResponse.json({
                status: "unhealthy",
                database: "disconnected",
                error: health.error,
                hint: health.hint,
                timestamp: new Date().toISOString()
            }, { status: 503 });
        }
    } catch (error) {
        return NextResponse.json({
            status: "error",
            message: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
