/**
 * GIS & Block-Level Spatial Intelligence Service
 * (src/services/gisService.ts)
 *
 * Prompt 7 Requirements 2, 7, 8, 9, 10, 11, 14, 18, 19, 20, 25:
 * - Connects WGS84 block GeoJSON features (`block_id`) to Supabase locations,
 *   real observations, horizon-specific `MPAI-ENS-0.1` AI predictions (`7D`, `14D`, `21D`, `30D`),
 *   transparent risk classification (`src/config/riskThresholds.ts`), and crop advisories.
 * - Never silently substitutes simulated predictions when `AI_FORECAST` is active.
 * - Caches static GeoJSON boundaries in memory on the client.
 */

import {
  classifyProbabilityToRiskBand,
  computeOverallAgriculturalRisk,
  OVERALL_AGRICULTURAL_RISK_CONFIG,
} from "@/config/riskThresholds";
import {
  getBlocksForScenarioAndHorizon,
  MOCK_BLOCKS,
} from "@/data/mockData";
import { formatUpdatedAgo, GIS_MAP_LAYERS } from "@/lib/geo";
import {
  BlockGeoJSONCollection,
  BlockGeoJSONFeature,
  BlockHorizonAIPrediction,
  BlockLayerRiskSummary,
  BlockRealObservation,
  BlockSpatialIntelligence,
  GISBatchIntelligenceResponse,
  GISHealthResponse,
  GISMapLayerId,
} from "@/types/gis";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

const ALL_HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

// Client-side static GeoJSON boundary cache (Requirement 20 & 25)
let cachedBoundariesCollection: BlockGeoJSONCollection | null = null;

/**
 * Computes transparent risk classification across all 7 required GIS layers (A–G)
 * for a given block's prediction payload.
 */
export function buildLayerRisksAndOverallRisk(
  prediction: BlockHorizonAIPrediction
): {
  overall_agricultural_risk: BlockSpatialIntelligence["overall_agricultural_risk"];
  layer_risks: Record<GISMapLayerId, BlockLayerRiskSummary>;
} {
  if (
    !prediction.available ||
    prediction.onset_probability === null ||
    prediction.false_onset_probability === null ||
    prediction.dry_spell_probability === null ||
    prediction.heavy_rain_probability === null
  ) {
    const unavailableMap = {} as Record<GISMapLayerId, BlockLayerRiskSummary>;
    for (const layer of GIS_MAP_LAYERS) {
      unavailableMap[layer.id] = {
        layer_id: layer.id,
        category: "UNAVAILABLE",
        label: "AI prediction unavailable",
        probability: null,
        display_value: "AI prediction unavailable",
        hex_color: "#64748B",
        border_hex: "#334155",
        icon_symbol: "○",
        threshold_range: "Unavailable",
      };
    }
    return {
      overall_agricultural_risk: {
        probability: null,
        percentage: null,
        category: "UNAVAILABLE",
        formula: OVERALL_AGRICULTURAL_RISK_CONFIG.formulaDisplay,
        components: null,
      },
      layer_risks: unavailableMap,
    };
  }

  const pOnset = prediction.onset_probability;
  const pFalse = prediction.false_onset_probability;
  const pDry = prediction.dry_spell_probability;
  const pHeavy = prediction.heavy_rain_probability;
  const expRain = prediction.expected_rainfall_mm ?? 0;
  const anomPct = prediction.rainfall_anomaly_pct ?? 0;

  // A. Monsoon Onset Risk: displays calibrated onset probability, classifies risk by onset delay (1 - P_onset)
  const onsetDelayRiskProb = Number((1.0 - pOnset).toFixed(4));
  const onsetBand = classifyProbabilityToRiskBand(onsetDelayRiskProb);

  // B. False Onset Risk
  const falseBand = classifyProbabilityToRiskBand(pFalse);

  // C. Dry Spell Risk
  const dryBand = classifyProbabilityToRiskBand(pDry);

  // D. Heavy Rain Risk
  const heavyBand = classifyProbabilityToRiskBand(pHeavy);

  // E. Expected Rainfall (mm) — risk scaled by deficit or extreme excess magnitude
  const rainRiskProb = Math.min(1.0, Math.max(0.0, Math.abs(anomPct) / 50.0));
  const rainBand = classifyProbabilityToRiskBand(rainRiskProb);

  // F. Rainfall Anomaly (%) — risk scaled by departure from climatological normal
  const anomRiskProb = Math.min(
    1.0,
    Math.max(0.0, anomPct < 0 ? Math.abs(anomPct) / 40.0 : anomPct / 60.0)
  );
  const anomBand = classifyProbabilityToRiskBand(anomRiskProb);

  // G. Overall Agricultural Risk (Explicit weighted combination - Requirement 7)
  const overall = computeOverallAgriculturalRisk({
    onsetProbability: pOnset,
    falseOnsetProbability: pFalse,
    drySpellProbability: pDry,
    heavyRainProbability: pHeavy,
  });

  const layerRisks: Record<GISMapLayerId, BlockLayerRiskSummary> = {
    monsoon_onset: {
      layer_id: "monsoon_onset",
      category: onsetBand.category,
      label: `${onsetBand.category} (${(pOnset * 100).toFixed(1)}% Onset)`,
      probability: onsetDelayRiskProb,
      display_value: `${(pOnset * 100).toFixed(1)}%`,
      hex_color: onsetBand.hexColor,
      border_hex: onsetBand.borderHex,
      icon_symbol: onsetBand.iconSymbol,
      threshold_range: onsetBand.rangeText,
    },
    false_onset: {
      layer_id: "false_onset",
      category: falseBand.category,
      label: `${falseBand.category} (${(pFalse * 100).toFixed(1)}%)`,
      probability: pFalse,
      display_value: `${(pFalse * 100).toFixed(1)}%`,
      hex_color: falseBand.hexColor,
      border_hex: falseBand.borderHex,
      icon_symbol: falseBand.iconSymbol,
      threshold_range: falseBand.rangeText,
    },
    dry_spell: {
      layer_id: "dry_spell",
      category: dryBand.category,
      label: `${dryBand.category} (${(pDry * 100).toFixed(1)}%)`,
      probability: pDry,
      display_value: `${(pDry * 100).toFixed(1)}%`,
      hex_color: dryBand.hexColor,
      border_hex: dryBand.borderHex,
      icon_symbol: dryBand.iconSymbol,
      threshold_range: dryBand.rangeText,
    },
    heavy_rain: {
      layer_id: "heavy_rain",
      category: heavyBand.category,
      label: `${heavyBand.category} (${(pHeavy * 100).toFixed(1)}%)`,
      probability: pHeavy,
      display_value: `${(pHeavy * 100).toFixed(1)}%`,
      hex_color: heavyBand.hexColor,
      border_hex: heavyBand.borderHex,
      icon_symbol: heavyBand.iconSymbol,
      threshold_range: heavyBand.rangeText,
    },
    expected_rainfall: {
      layer_id: "expected_rainfall",
      category: rainBand.category,
      label: `${expRain.toFixed(1)} mm (${rainBand.category})`,
      probability: rainRiskProb,
      display_value: `${expRain.toFixed(1)} mm`,
      hex_color: rainBand.hexColor,
      border_hex: rainBand.borderHex,
      icon_symbol: rainBand.iconSymbol,
      threshold_range: rainBand.rangeText,
    },
    rainfall_anomaly: {
      layer_id: "rainfall_anomaly",
      category: anomBand.category,
      label: `${anomPct > 0 ? `+${anomPct.toFixed(1)}` : anomPct.toFixed(1)}% (${anomBand.category})`,
      probability: anomRiskProb,
      display_value: `${anomPct > 0 ? `+${anomPct.toFixed(1)}` : anomPct.toFixed(1)}%`,
      hex_color: anomBand.hexColor,
      border_hex: anomBand.borderHex,
      icon_symbol: anomBand.iconSymbol,
      threshold_range: anomBand.rangeText,
    },
    overall_agricultural_risk: {
      layer_id: "overall_agricultural_risk",
      category: overall.band.category,
      label: `${overall.band.category} (${overall.overallRiskPct}%)`,
      probability: overall.overallRiskProbability,
      display_value: `${overall.overallRiskPct}%`,
      hex_color: overall.band.hexColor,
      border_hex: overall.band.borderHex,
      icon_symbol: overall.band.iconSymbol,
      threshold_range: overall.band.rangeText,
    },
  };

  return {
    overall_agricultural_risk: {
      probability: overall.overallRiskProbability,
      percentage: overall.overallRiskPct,
      category: overall.band.category,
      formula: OVERALL_AGRICULTURAL_RISK_CONFIG.formulaDisplay,
      components: {
        onset_delay: overall.onsetDelayComponent,
        false_onset: overall.falseOnsetComponent,
        dry_spell: overall.drySpellComponent,
        heavy_rain: overall.heavyRainComponent,
      },
    },
    layer_risks: layerRisks,
  };
}

/**
 * Generates crop-specific advisory text driven by the block's actual prediction probabilities.
 */
export function deriveBlockAdvisorySummary(
  blockId: string,
  prediction: BlockHorizonAIPrediction
): {
  main_issue: string;
  recommended_action: string;
  dominant_crops: string[];
} {
  const mockBlock =
    MOCK_BLOCKS.find((b) => b.id === blockId) || MOCK_BLOCKS[0];
  const dominantCrops =
    mockBlock.panchayats.length > 0
      ? Array.from(new Set(mockBlock.panchayats.map((p) => p.dominantCrop)))
      : ["Paddy", "Pigeon Pea (Arhar)"];

  if (!prediction.available) {
    return {
      main_issue: "AI prediction unavailable — switch to SIMULATED FORECAST for prototype guidance.",
      recommended_action: "Verify real observation telemetry before scheduling sowing or irrigation.",
      dominant_crops: dominantCrops,
    };
  }

  const pFalse = prediction.false_onset_probability ?? 0;
  const pDry = prediction.dry_spell_probability ?? 0;
  const pHeavy = prediction.heavy_rain_probability ?? 0;
  const pOnset = prediction.onset_probability ?? 0;

  if (pFalse >= 0.5) {
    return {
      main_issue: `Elevated False Onset Risk (${(pFalse * 100).toFixed(1)}%) over ${prediction.horizon} window`,
      recommended_action:
        "Delay direct rainfed paddy sowing by 5–7 days; retain nursery moisture and prepare supplemental borewell/canal irrigation.",
      dominant_crops: dominantCrops,
    };
  }
  if (pDry >= 0.5) {
    return {
      main_issue: `Break-Monsoon / Dry Spell Risk (${(pDry * 100).toFixed(1)}%) over ${prediction.horizon}`,
      recommended_action:
        "Apply mulching in pulses/oilseeds, withhold top-dressing urea until soil moisture recovers, and schedule life-saving irrigation.",
      dominant_crops: dominantCrops,
    };
  }
  if (pHeavy >= 0.5) {
    return {
      main_issue: `Heavy Downpour Risk (${(pHeavy * 100).toFixed(1)}%) — Expected ${prediction.expected_rainfall_mm} mm`,
      recommended_action:
        "Clear bund drainage channels in low-lying paddy plots and postpone foliar spray/fertilizer application.",
      dominant_crops: dominantCrops,
    };
  }
  if (pOnset >= 0.7) {
    return {
      main_issue: `Favorable Sustained Monsoon Onset (${(pOnset * 100).toFixed(1)}%) — Expected ${prediction.expected_rainfall_mm} mm`,
      recommended_action:
        "Proceed with kharif nursery preparation, bunding, and timely transplanting across alluvial plots.",
      dominant_crops: dominantCrops,
    };
  }

  return {
    main_issue: `Transitional Monsoon Regime (${(pOnset * 100).toFixed(1)}% Onset, ${(pFalse * 100).toFixed(1)}% False Onset)`,
    recommended_action:
      "Monitor cumulative 3-day rainfall (>22 mm) before committing full seedbeds.",
    dominant_crops: dominantCrops,
  };
}

/**
 * Builds a Simulated or Demo prediction object for a block and horizon when the user
 * explicitly selects SIMULATED FORECAST or DEMO MODE.
 */
export function buildSimulatedOrDemoPredictionForBlock(
  blockId: string,
  horizon: ForecastHorizon,
  mode: "SIMULATED" | "DEMO",
  scenario: DemoScenarioId = "scenario_b"
): BlockHorizonAIPrediction {
  const blocksForHorizon = getBlocksForScenarioAndHorizon(scenario, horizon);
  const b =
    blocksForHorizon.find((item) => item.id === blockId) || blocksForHorizon[0];
  const hDays = parseInt(horizon.replace("D", ""), 10) || 14;
  const nowIso = new Date().toISOString();

  return {
    available: true,
    source_mode: mode === "DEMO" ? "DEMO_DATA" : "SIMULATED_FORECAST",
    status_message:
      mode === "DEMO"
        ? "DEMO DATA — Simulated scenario telemetry"
        : "SIMULATED FORECAST — Prototype rule-based scenario engine",
    horizon,
    horizon_days: hDays,
    model_name:
      mode === "DEMO" ? "Demo Scenario Engine" : "Simulated Prototype Engine",
    model_version: mode === "DEMO" ? "DEMO-SCENARIO-v1" : "SIM-PROTO-v1",
    dataset_version: "DEMO-SYNTHETIC-v1",
    training_period: "N/A (Simulated)",
    test_period: "N/A (Simulated)",
    initialization_date: nowIso.slice(0, 10),
    observation_cutoff: nowIso.slice(0, 10),
    issued_at: nowIso,
    onset_probability: Number((b.onsetProbability / 100).toFixed(4)),
    false_onset_probability: Number((b.falseOnsetProbability / 100).toFixed(4)),
    dry_spell_probability: Number((b.drySpellProbability / 100).toFixed(4)),
    heavy_rain_probability: Number((b.heavyRainProbability / 100).toFixed(4)),
    onset_raw_probability: Number((b.onsetProbability / 100).toFixed(4)),
    false_onset_raw_probability: Number((b.falseOnsetProbability / 100).toFixed(4)),
    dry_spell_raw_probability: Number((b.drySpellProbability / 100).toFixed(4)),
    heavy_rain_raw_probability: Number((b.heavyRainProbability / 100).toFixed(4)),
    onset_probability_pct: b.onsetProbability,
    false_onset_probability_pct: b.falseOnsetProbability,
    dry_spell_probability_pct: b.drySpellProbability,
    heavy_rain_probability_pct: b.heavyRainProbability,
    expected_rainfall_mm: b.expectedRainfall,
    rainfall_anomaly_pct: b.rainfallAnomaly,
    uncertainty_interval_low_mm: Math.max(0, Math.round(b.expectedRainfall * 0.78)),
    uncertainty_interval_high_mm: Math.round(b.expectedRainfall * 1.22),
    calibration_method: mode === "DEMO" ? "demo_scenario" : "simulated_rule",
    drift_status: "NORMAL",
    prediction_hash: null,
  };
}

/**
 * Client-side helper to fetch and cache GeoJSON boundaries (`GET /api/gis/boundaries`).
 */
export async function fetchGISBoundaries(): Promise<BlockGeoJSONCollection | null> {
  if (cachedBoundariesCollection) {
    return cachedBoundariesCollection;
  }
  try {
    const res = await fetch("/api/gis/boundaries", { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as BlockGeoJSONCollection;
    if (data && data.type === "FeatureCollection") {
      cachedBoundariesCollection = data;
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Client-side helper to fetch GIS health status (`GET /api/gis/health`).
 */
export async function fetchGISHealth(): Promise<GISHealthResponse | null> {
  try {
    const res = await fetch("/api/gis/health", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as GISHealthResponse;
  } catch {
    return null;
  }
}

/**
 * Client-side helper to fetch batch spatial intelligence for all 8 blocks in a single call
 * (`GET /api/gis/block-intelligence`).
 */
export async function fetchGISBlockIntelligence(params: {
  horizon: ForecastHorizon;
  engineMode: "AI_FORECAST" | "SIMULATED" | "DEMO";
  scenario?: DemoScenarioId;
  simulateAiFailure?: boolean;
  simulateObsFailure?: boolean;
  simulateBoundaryFailure?: boolean;
}): Promise<GISBatchIntelligenceResponse | null> {
  try {
    const qs = new URLSearchParams({
      horizon: params.horizon,
      mode: params.engineMode,
      scenario: params.scenario || "scenario_b",
    });
    if (params.simulateAiFailure) qs.set("simulate_ai_failure", "true");
    if (params.simulateObsFailure) qs.set("simulate_obs_failure", "true");
    if (params.simulateBoundaryFailure) qs.set("simulate_boundary_failure", "true");

    const res = await fetch(`/api/gis/block-intelligence?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as GISBatchIntelligenceResponse;
  } catch {
    return null;
  }
}

export { ALL_HORIZONS, formatUpdatedAgo };
export type { BlockGeoJSONFeature, BlockRealObservation };
