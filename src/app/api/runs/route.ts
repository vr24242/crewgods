// Deprecated — runs are now tracked as workflow_runs via Temporal.
// Use /api/workflows/:id/status for run details.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Runs API deprecated. Use /api/workflows/:id/status instead.",
  });
}
