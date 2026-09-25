/**
 * Server-Side GIS & Spatial Intelligence Resolver
 * (src/lib/gisServer.ts)
 *
 * Shared by:
 * - GET /api/gis/health
 * - GET /api/gis/boundaries
 * - GET /api/gis/block-intelligence
 * - GET /api/gis/block/[blockId]
 */

import fs from "fs";
import path from "path";
import { MOCK_BLOCKS } from "@/data/mockData";
import {
  EXPECTED_PRAYAGRAJ_BLOCK_IDS,
  formatUpdatedAgo,
  validateGeoJSON,
} from "@/lib/geo";
import {
  buildLayerRisksAndOverallRisk,
  buildSimulatedOrDemoPredictionForBlock,
  deriveBlockAdvisorySummary,
} from "@/services/gisService";
import {
  BlockGeoJSONCollection,
  BlockHorizonAIPrediction,
  BlockRealObservation,
  BlockSpatialIntelligence,
  GISBatchIntelligenceResponse,
  GISHealthResponse,
} from "@/types/gis";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

const GEOJSON_PATH = path.join(
  process.cwd(),
  "public",
  "gis",
  "prayagraj_blocks.geojson"
);
const POLYGONS_OVERRIDE_PATH = path.join(
  process.cwd(),
  "public",
  "gis",
  "prayagraj_blocks_polygons.geojson"
);
const SPATIAL_PREDICTIONS_PATH = path.join(
  process.cwd(),
  "ml-service",
  "artifacts",
  "block_spatial_predictions.json"
);

const ALL_HORIZONS: ForecastHorizon[] = ["7D", "14D", "21D", "30D"];

/**
 * Loads the normalized WGS84 GeoJSON FeatureCollection from disk.
 * Prefers `prayagraj_blocks_polygons.geojson` if an official polygon boundary file
 * is present; otherwise loads `prayagraj_blocks.geojson` (verified centroids).
 */
export function loadServerGeoJSONCollection(
  simulateFailure = false
): BlockGeoJSONCollection | null {
  if (simulateFailure) return null;
  try {
    if (fs.existsSync(POLYGONS_OVERRIDE_PATH)) {
      const rawPoly = fs.readFileSync(POLYGONS_OVERRIDE_PATH, "utf-8");
      return JSON.parse(rawPoly) as BlockGeoJSONCollection;
    }
    if (fs.existsSync(GEOJSON_PATH)) {
      const raw = fs.readFileSync(GEOJSON_PATH, "utf-8");
      return JSON.parse(raw) as BlockGeoJSONCollection;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Computes the GIS Health check response (`GET /api/gis/health`).
 */
export function computeServerGISHealth(simulateFailure = false): GISHealthResponse {
  const collection = loadServerGeoJSONCollection(simulateFailure);
  const validation = validateGeoJSON(collection, EXPECTED_PRAYAGRAJ_BLOCK_IDS);

  const status: GISHealthResponse["status"] = !validation.valid
    ? "unavailable"
    : validation.geometry_mode === "polygon_boundary"
    ? "healthy"
    : "healthy";

  return {
    status,
    boundary_source:
      collection?.metadata?.source ||
      "Government of India LGD District 130 & Census 2011 District 175 Verified Centroids (WGS84)",
    administrative_level:
      collection?.metadata?.administrative_level ||
      "Sub-District (Tehsil) & Community Development (CD) Block",
    crs: collection?.metadata?.crs || "EPSG:4326",
    geometry_mode: validation.geometry_mode,
    feature_count: validation.feature_count,
    matched_locations: validation.matched_locations,
    missing_locations: validation.missing_blocks.length,
    invalid_geometries: validation.invalid_geometries.length,
    missing_blocks: validation.missing_blocks,
    duplicate_blocks: validation.duplicate_blocks,
    status_banner: validation.status_message,
    checked_at: new Date().toISOString(),
  };
}

interface RawSpatialExportFile {
  generated_at: string;
  model_name: string;
  model_version: string;
  dataset_version: string;
  training_period: string;
  validation_period: string;
  test_period: string;
  blocks: Record<
    string,
    {
      observation: {
        available: boolean;
        label: "REAL OBSERVATION";
        rainfall_mm: number;
        cumulative_7d_rain_mm: number;
        temperature_c: number;
        humidity_pct: number;
        pressure_hpa: number;
        wind_speed_kmh: number;
        observation_timestamp: string;
        source: string;
        quality: string;
      };
      predictions_by_horizon: Record<string, Record<string, any>>;
    }
  >;
}

function loadExportedSpatialArtifact(): RawSpatialExportFile | null {
  try {
    if (!fs.existsSync(SPATIAL_PREDICTIONS_PATH)) return null;
    const raw = fs.readFileSync(SPATIAL_PREDICTIONS_PATH, "utf-8");
    return JSON.parse(raw) as RawSpatialExportFile;
  } catch {
    return null;
  }
}

function mapRawAIPredToHorizonPrediction(
  rawPred: Record<string, any> | undefined,
  horizon: ForecastHorizon,
  simulateAiFailure: boolean
): BlockHorizonAIPrediction {
  const hDays = parseInt(horizon.replace("D", ""), 10) || 14;
  if (simulateAiFailure || !rawPred) {
    return {
      available: false,
      source_mode: "UNAVAILABLE",
      status_message: "AI prediction unavailable",
      horizon,
      horizon_days: hDays,
      model_name: "MonsoonPulse Ensemble",
      model_version: "MPAI-ENS-0.1",
      dataset_version: "PRAYAGRAJ-ERA5-HIST-2019-2025-v1",
      training_period: "2019–2022",
      test_period: "2024–2025",
      initialization_date: "Unavailable",
      observation_cutoff: "Unavailable",
      issued_at: new Date().toISOString(),
      onset_probability: null,
      false_onset_probability: null,
      dry_spell_probability: null,
      heavy_rain_probability: null,
      onset_raw_probability: null,
      false_onset_raw_probability: null,
      dry_spell_raw_probability: null,
      heavy_rain_raw_probability: null,
      onset_probability_pct: null,
      false_onset_probability_pct: null,
      dry_spell_probability_pct: null,
      heavy_rain_probability_pct: null,
      expected_rainfall_mm: null,
      rainfall_anomaly_pct: null,
      uncertainty_interval_low_mm: null,
      uncertainty_interval_high_mm: null,
      calibration_method: "unavailable",
      drift_status: "UNAVAILABLE",
      prediction_hash: null,
    };
  }

  return {
    available: true,
    source_mode: "AI_FORECAST",
    status_message: "Real MPAI-ENS-0.1 Calibrated Ensemble Prediction",
    horizon,
    horizon_days: hDays,
    model_name: rawPred.model_name || "MonsoonPulse Ensemble",
    model_version: rawPred.model_version || "MPAI-ENS-0.1",
    dataset_version: rawPred.data_version || "PRAYAGRAJ-ERA5-HIST-2019-2025-v1",
    training_period: rawPred.training_period || "2019–2022",
    test_period: "2024–2025",
    initialization_date: rawPred.initialization_date,
    observation_cutoff: rawPred.observation_cutoff || rawPred.initialization_date,
    issued_at: rawPred.issued_at || rawPred.data_timestamp,
    onset_probability: Number(rawPred.onset_probability),
    false_onset_probability: Number(rawPred.false_onset_probability),
    dry_spell_probability: Number(rawPred.dry_spell_probability),
    heavy_rain_probability: Number(rawPred.heavy_rain_probability),
    onset_raw_probability: Number(rawPred.onset_raw_probability ?? rawPred.onset_probability),
    false_onset_raw_probability: Number(
      rawPred.false_onset_raw_probability ?? rawPred.false_onset_probability
    ),
    dry_spell_raw_probability: Number(
      rawPred.dry_spell_raw_probability ?? rawPred.dry_spell_probability
    ),
    heavy_rain_raw_probability: Number(
      rawPred.heavy_rain_raw_probability ?? rawPred.heavy_rain_probability
    ),
    onset_probability_pct: Number(rawPred.onset_probability_pct),
    false_onset_probability_pct: Number(rawPred.false_onset_probability_pct),
    dry_spell_probability_pct: Number(rawPred.dry_spell_probability_pct),
    heavy_rain_probability_pct: Number(rawPred.heavy_rain_probability_pct),
    expected_rainfall_mm: Number(rawPred.expected_rainfall),
    rainfall_anomaly_pct: Number(rawPred.rainfall_anomaly),
    uncertainty_interval_low_mm: Number(
      rawPred.uncertainty_interval_low_mm ?? rawPred.rainfall_interval_low_mm
    ),
    uncertainty_interval_high_mm: Number(
      rawPred.uncertainty_interval_high_mm ?? rawPred.rainfall_interval_high_mm
    ),
    calibration_method: String(rawPred.false_onset_calibration_method || "isotonic"),
    drift_status: String(rawPred.drift_status || "NORMAL"),
    prediction_hash: rawPred.prediction_hash || null,
  };
}

/**
 * Resolves the full batch spatial intelligence for all 8 Prayagraj blocks.
 */
export function resolveBatchBlockIntelligence(params: {
  horizon: ForecastHorizon;
  engineMode: "AI_FORECAST" | "SIMULATED" | "DEMO";
  scenario?: DemoScenarioId;
  simulateAiFailure?: boolean;
  simulateObsFailure?: boolean;
  simulateBoundaryFailure?: boolean;
}): GISBatchIntelligenceResponse {
  const collection = loadServerGeoJSONCollection(Boolean(params.simulateBoundaryFailure));
  const validation = validateGeoJSON(collection, EXPECTED_PRAYAGRAJ_BLOCK_IDS);
  const spatialArtifact = loadExportedSpatialArtifact();
  const scenario = params.scenario || "scenario_b";

  const blocksOutput: BlockSpatialIntelligence[] = [];
  const featuresList = collection?.features || [];

  for (const blockId of EXPECTED_PRAYAGRAJ_BLOCK_IDS) {
    const feat = featuresList.find(
      (f) => f.properties.block_id.toLowerCase() === blockId
    );
    const mockMeta =
      MOCK_BLOCKS.find((b) => b.id === blockId) || MOCK_BLOCKS[0];
    const artifactBlock = spatialArtifact?.blocks?.[blockId];

    // 1. Resolve Real Observation vs Demo Observation vs Unavailable Observation
    let observation: BlockRealObservation;
    if (params.simulateObsFailure) {
      observation = {
        available: false,
        label: "UNAVAILABLE",
        rainfall_mm: null,
        cumulative_7d_rain_mm: null,
        temperature_c: null,
        humidity_pct: null,
        pressure_hpa: null,
        wind_speed_kmh: null,
        observation_timestamp: null,
        updated_ago: "Latest observation unavailable.",
        source: "Provider unreachable",
        quality: "missing",
      };
    } else if (params.engineMode === "DEMO") {
      const demoTs = new Date().toISOString();
      observation = {
        available: true,
        label: "DEMO DATA",
        rainfall_mm: 14.2,
        cumulative_7d_rain_mm: 48.5,
        temperature_c: 33.4,
        humidity_pct: 74.0,
        pressure_hpa: 1001.8,
        wind_speed_kmh: 16.5,
        observation_timestamp: demoTs,
        updated_ago: "DEMO DATA (Simulated Telemetry)",
        source: "Demo Scenario Telemetry Engine (DEMO DATA)",
        quality: "valid",
      };
    } else if (artifactBlock?.observation) {
      const obs = artifactBlock.observation;
      observation = {
        available: true,
        label: "REAL OBSERVATION",
        rainfall_mm: obs.rainfall_mm,
        cumulative_7d_rain_mm: obs.cumulative_7d_rain_mm,
        temperature_c: obs.temperature_c,
        humidity_pct: obs.humidity_pct,
        pressure_hpa: obs.pressure_hpa,
        wind_speed_kmh: obs.wind_speed_kmh,
        observation_timestamp: obs.observation_timestamp,
        updated_ago: formatUpdatedAgo(obs.observation_timestamp),
        source: obs.source,
        quality: obs.quality,
      };
    } else {
      observation = {
        available: false,
        label: "UNAVAILABLE",
        rainfall_mm: null,
        cumulative_7d_rain_mm: null,
        temperature_c: null,
        humidity_pct: null,
        pressure_hpa: null,
        wind_speed_kmh: null,
        observation_timestamp: null,
        updated_ago: "Latest observation unavailable.",
        source: "Observation cache missing",
        quality: "missing",
      };
    }

    // 2. Resolve All 4 Horizon Predictions (7D, 14D, 21D, 30D) without rescaling
    const allHorizonPredictions = {} as Record<
      ForecastHorizon,
      BlockHorizonAIPrediction
    >;
    for (const h of ALL_HORIZONS) {
      if (params.engineMode === "AI_FORECAST") {
        const rawH = artifactBlock?.predictions_by_horizon?.[h];
        allHorizonPredictions[h] = mapRawAIPredToHorizonPrediction(
          rawH,
          h,
          Boolean(params.simulateAiFailure)
        );
      } else {
        allHorizonPredictions[h] = buildSimulatedOrDemoPredictionForBlock(
          blockId,
          h,
          params.engineMode,
          scenario
        );
      }
    }

    const activePrediction = allHorizonPredictions[params.horizon];
    const { overall_agricultural_risk, layer_risks } =
      buildLayerRisksAndOverallRisk(activePrediction);
    const advisory_summary = deriveBlockAdvisorySummary(
      blockId,
      activePrediction
    );

    const lat = feat?.properties.centroid_lat ?? mockMeta.coordinates[0];
    const lon = feat?.properties.centroid_lon ?? mockMeta.coordinates[1];

    blocksOutput.push({
      block_id: blockId,
      block_name: feat?.properties.block_name || mockMeta.name.replace(" Block", ""),
      tehsil_name: feat?.properties.tehsil_name || mockMeta.name.replace(" Block", ""),
      district: feat?.properties.district_name || "Prayagraj",
      state: feat?.properties.state_name || "Uttar Pradesh",
      coordinates: [lat, lon],
      elevation_m: feat?.properties.elevation_m ?? 96.0,
      soil_type: feat?.properties.soil_type || mockMeta.soilType,
      farmers_registered: mockMeta.farmersRegistered,
      cultivated_area_ha: mockMeta.cultivatedAreaHa,
      geometry: feat?.geometry || {
        type: "Point",
        coordinates: [lon, lat],
      },
      geometry_mode:
        feat?.properties.geometry_mode || "centroid_fallback",
      observation,
      prediction: activePrediction,
      all_horizon_predictions: allHorizonPredictions,
      overall_agricultural_risk,
      layer_risks,
      advisory_summary,
    });
  }

  const firstObsTs =
    blocksOutput.find((b) => b.observation.observation_timestamp)?.observation
      .observation_timestamp || null;

  return {
    status: validation.valid ? "ok" : "degraded",
    horizon: params.horizon,
    engine_mode: params.engineMode,
    validation,
    provenance: {
      boundaries: collection?.metadata || {
        dataset_name:
          "Prayagraj District Administrative Sub-Districts & CD Blocks Spatial Registry",
        source:
          "Government of India LGD District 130 & Census of India 2011 District 175",
        source_url: "https://lgdirectory.gov.in / https://censusindia.gov.in",
        administrative_level:
          "Sub-District (Tehsil) & Community Development (CD) Block",
        download_date: "2026-09-25",
        license: "GODL-India",
        crs: "EPSG:4326",
        geometry_mode: "centroid_fallback",
        status_banner: validation.status_message,
      },
      observations_source:
        params.engineMode === "DEMO"
          ? "Demo Scenario Telemetry Engine (DEMO DATA)"
          : "Open-Meteo ERA5 Historical / Prayagraj Block Grid Archive (REAL OBSERVATION)",
      observations_last_updated: firstObsTs,
      ai_model_name:
        params.engineMode === "AI_FORECAST"
          ? "MonsoonPulse Ensemble"
          : params.engineMode === "DEMO"
          ? "Demo Scenario Engine"
          : "Simulated Prototype Engine",
      ai_model_version:
        params.engineMode === "AI_FORECAST"
          ? "MPAI-ENS-0.1"
          : params.engineMode === "DEMO"
          ? "DEMO-SCENARIO-v1"
          : "SIM-PROTO-v1",
      training_period: "2019–2022",
      validation_period: "2023",
      test_period: "2024–2025",
      scientific_limitations: [
        "Current spatial predictions are evaluated for temporal generalization within the available Prayagraj block dataset. Spatial generalization beyond the trained block set has not been established.",
        "Risk categories are prototype decision-support classifications and are not official government warnings.",
      ],
    },
    blocks: blocksOutput,
  };
}
