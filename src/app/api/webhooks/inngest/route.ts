// Deprecated — workflow scheduling is now handled by Temporal.
// This route is kept as a no-op for backward compatibility.
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "deprecated", message: "Use Temporal workflows instead" });
}

export async function POST() {
  return NextResponse.json({ status: "deprecated", message: "Use Temporal workflows instead" });
}
