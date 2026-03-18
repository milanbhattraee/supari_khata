import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs?: number;
      error?: string;
    };
  };
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const startTime = Date.now();
  let dbStatus: HealthStatus["checks"]["database"] = { status: "down" };

  try {
    await dbConnect();

    if (mongoose.connection.readyState === 1) {
      // Ping the database to check actual connectivity
      const pingStart = Date.now();
      await mongoose.connection.db?.admin().ping();
      dbStatus = {
        status: "up",
        latencyMs: Date.now() - pingStart,
      };
    } else {
      dbStatus = {
        status: "down",
        error: "Database not connected",
      };
    }
  } catch (err) {
    dbStatus = {
      status: "down",
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }

  const overallStatus: HealthStatus["status"] =
    dbStatus.status === "up" ? "healthy" : "unhealthy";

  const response: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: dbStatus,
    },
  };

  const statusCode = overallStatus === "healthy" ? 200 : 503;

  return NextResponse.json(response, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "X-Response-Time": `${Date.now() - startTime}ms`,
    },
  });
}
