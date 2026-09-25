import { NextRequest, NextResponse } from "next/server";
import { resolveBatchBlockIntelligence } from "@/lib/gisServer";
import { evaluateCropAdvisories } from "@/services/advisoryEngine";
import {
  AdvisorySourceMode,
  SupportedCropId,
} from "@/types/advisory";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";
import { getBlocksForScenarioAndHorizon } from "@/data/mockData";

function parseHorizon(horizonDaysOrStr: number | string | undefined): {
  horizon: ForecastHorizon;
  days: 7 | 14 | 21 | 30;
} {
  const num =
    typeof horizonDaysOrStr === "number"
      ? horizonDaysOrStr
      : parseInt(String(horizonDaysOrStr || "14").replace("D", ""), 10);
  if (num === 7) return { horizon: "7D", days: 7 };
  if (num === 21) return { horizon: "21D", days: 21 };
  if (num === 30) return { horizon: "30D", days: 30 };
  return { horizon: "14D", days: 14 };
}

function normalizeMode(modeInput?: string): AdvisorySourceMode {
  const m = (modeInput || "AI").toUpperCase();
  if (m === "SIMULATED" || m === "SIMULATED_FORECAST") return "SIMULATED";
  if (m === "DEMO" || m === "DEMO_MODE") return "DEMO";
  return "AI";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locationId = String(body.location_id || "karchhana").toLowerCase();
    const cropId = String(body.crop_id || "paddy").toLowerCase() as SupportedCropId;
    const { horizon, days } = parseHorizon(body.horizon_days || body.horizon);
    const mode = normalizeMode(body.mode);
    const cropStage = body.crop_stage ?? null;
    const language: "English" | "Hindi" =
      String(body.language || "English").toLowerCase().startsWith("hi")
        ? "Hindi"
        : "English";
    const scenario: DemoScenarioId = body.scenario || "scenario_b";

    // Retrieve spatial + observation + AI prediction telemetry for the block
    const engineModeForGis =
      mode === "AI" ? "AI_FORECAST" : mode === "SIMULATED" ? "SIMULATED" : "DEMO";
    const batch = resolveBatchBlockIntelligence({
      horizon,
      engineMode: engineModeForGis,
      scenario,
    });
    const spatialBlock = batch.blocks.find((b) => b.block_id === locationId) || null;

    const mockBlocks = getBlocksForScenarioAndHorizon(scenario, horizon);
    const fallbackBlock =
      mockBlocks.find((b) => b.id === locationId) || mockBlocks[0];

    const pred = spatialBlock?.prediction;
    const obs = spatialBlock?.observation;

    // In AI mode, do NOT fabricate soil moisture if no real soil moisture sensor exists
    const soilMoisture =
      mode === "AI"
        ? body.soil_moisture !== undefined
          ? body.soil_moisture
          : null
        : body.soil_moisture !== undefined
        ? body.soil_moisture
        : fallbackBlock.soilMoisture;

    const bundle = evaluateCropAdvisories({
      location_id: locationId,
      block_name: spatialBlock?.block_name || fallbackBlock.name,
      district: spatialBlock?.district || fallbackBlock.district,
      state: spatialBlock?.state || fallbackBlock.state,
      crop_id: cropId,
      forecast_horizon: horizon,
      horizon_days: days,
      crop_stage: cropStage,
      current_rainfall: obs?.rainfall_mm ?? 18.5,
      recent_rainfall: obs?.cumulative_7d_rain_mm ?? 52.0,
      rainfall_anomaly: pred?.rainfall_anomaly_pct ?? fallbackBlock.rainfallAnomaly,
      temperature: obs?.temperature_c ?? 30.0,
      humidity: obs?.humidity_pct ?? 80.0,
      soil_moisture: soilMoisture,
      onset_probability:
        pred?.onset_probability ?? fallbackBlock.onsetProbability / 100.0,
      false_onset_probability:
        pred?.false_onset_probability ??
        fallbackBlock.falseOnsetProbability / 100.0,
      dry_spell_probability:
        pred?.dry_spell_probability ?? fallbackBlock.drySpellProbability / 100.0,
      heavy_rain_probability:
        pred?.heavy_rain_probability ?? fallbackBlock.heavyRainProbability / 100.0,
      expected_rainfall:
        pred?.expected_rainfall_mm ?? fallbackBlock.expectedRainfall,
      model_version:
        mode === "AI"
          ? pred?.model_version || "MPAI-ENS-0.1"
          : mode === "SIMULATED"
          ? "SIM-PROTO-v1"
          : "DEMO-SCENARIO-v1",
      observation_cutoff:
        pred?.observation_cutoff || obs?.observation_timestamp || "2025-08-31",
      prediction_issued_at: pred?.issued_at,
      prediction_valid_until: body.valid_until,
      reference_timestamp: body.reference_timestamp,
      evaluation_month: body.evaluation_month ?? 6,
      source_mode: mode,
    });

    // Format exact Section 25 response shape alongside the full bundle
    const advisoriesFormatted = bundle.active_advisories.map((item) => {
      const locText = language === "Hindi" ? item.hi : item.en;
      return {
        rule_id: item.rule_id,
        type: item.decision_category,
        decision_code: item.decision_code,
        severity: item.severity,
        priority_rank: item.priority_rank,
        title: locText.title,
        what: locText.what,
        why: locText.why,
        when: locText.when,
        message: locText.message,
        action: locText.action,
        reason: locText.reason,
        en: item.en,
        hi: item.hi,
        created_at: item.created_at,
        valid_until: item.valid_until,
        status: item.status,
        evidence: item.evidence,
      };
    });

    return NextResponse.json({
      location: bundle.location_id,
      block_name: bundle.block_name,
      crop: bundle.crop_id,
      horizon: bundle.horizon_days,
      mode: bundle.source_mode,
      language,
      advisories: advisoriesFormatted,
      model_version: bundle.model_version,
      observation_cutoff: bundle.observation_cutoff,
      soil_moisture_status:
        language === "Hindi"
          ? bundle.soil_moisture_status_hi
          : bundle.soil_moisture_status_en,
      crop_stage_status:
        language === "Hindi"
          ? bundle.crop_stage_status_hi
          : bundle.crop_stage_status_en,
      bundle,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "Failed to generate crop advisory",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mockReq = new NextRequest(request.url, {
    method: "POST",
    body: JSON.stringify({
      location_id: searchParams.get("location_id") || "karchhana",
      crop_id: searchParams.get("crop_id") || "paddy",
      horizon_days: Number(searchParams.get("horizon_days") || 14),
      mode: searchParams.get("mode") || "AI",
      crop_stage: searchParams.get("crop_stage") || null,
      language: searchParams.get("language") || "English",
    }),
  });
  return POST(mockReq);
}
