import { NextRequest, NextResponse } from "next/server";
import { resolveBatchBlockIntelligence } from "@/lib/gisServer";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

export const dynamic = "force-dynamic";

const VALID_HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawHorizon = (searchParams.get("horizon") || "14D").toUpperCase();
  const horizon: ForecastHorizon = VALID_HORIZONS.includes(
    rawHorizon as ForecastHorizon
  )
    ? (rawHorizon as ForecastHorizon)
    : "14D";

  const rawMode = (searchParams.get("mode") || "AI_FORECAST").toUpperCase();
  const engineMode: "AI_FORECAST" | "SIMULATED" | "DEMO" =
    rawMode === "DEMO"
      ? "DEMO"
      : rawMode === "SIMULATED"
      ? "SIMULATED"
      : "AI_FORECAST";

  const scenario = (searchParams.get("scenario") ||
    "scenario_b") as DemoScenarioId;

  const simulateAiFailure = searchParams.get("simulate_ai_failure") === "true";
  const simulateObsFailure =
    searchParams.get("simulate_obs_failure") === "true";
  const simulateBoundaryFailure =
    searchParams.get("simulate_boundary_failure") === "true";

  const payload = resolveBatchBlockIntelligence({
    horizon,
    engineMode,
    scenario,
    simulateAiFailure,
    simulateObsFailure,
    simulateBoundaryFailure,
  });

  return NextResponse.json(payload);
}
