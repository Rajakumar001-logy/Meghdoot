import { NextRequest, NextResponse } from "next/server";
import { loadServerGeoJSONCollection } from "@/lib/gisServer";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const simulateFailure =
    searchParams.get("simulate_boundary_failure") === "true";
  const collection = loadServerGeoJSONCollection(simulateFailure);
  if (!collection) {
    return NextResponse.json(
      {
        error: "Boundary data unavailable.",
      },
      { status: 503 }
    );
  }
  return NextResponse.json(collection, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
