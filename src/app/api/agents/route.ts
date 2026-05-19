// Deprecated — agents are now workflow nodes, not standalone entities.
// This endpoint is kept as a stub for backward compatibility.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    message: "Agents API deprecated. Use /api/workflows and /api/packs instead.",
    docs: "/api/packs",
  });
}
