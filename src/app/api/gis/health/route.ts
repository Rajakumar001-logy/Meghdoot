import { NextRequest, NextResponse } from "next/server";
import { computeServerGISHealth } from "@/lib/gisServer";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const simulateFailure =
    searchParams.get("simulate_boundary_failure") === "true";
  const health = computeServerGISHealth(simulateFailure);
  return NextResponse.json(health);
}
