import { NextRequest, NextResponse } from "next/server";
import { resolveBatchBlockIntelligence } from "@/lib/gisServer";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

export const dynamic = "force-dynamic";

const VALID_HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ blockId: string }> }
) {
  const { blockId } = await context.params;
  const cleanId = String(blockId || "").trim().toLowerCase();

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

  const batch = resolveBatchBlockIntelligence({
    horizon,
    engineMode,
    scenario,
  });

  const blockItem = batch.blocks.find((b) => b.block_id === cleanId);
  if (!blockItem) {
    return NextResponse.json(
      {
        error: `Block '${cleanId}' not found in Prayagraj GIS registry.`,
        supported_blocks: batch.blocks.map((b) => b.block_id),
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: "ok",
    horizon,
    engine_mode: engineMode,
    provenance: batch.provenance,
    block: blockItem,
  });
}
