/**
 * GIS & Spatial Intelligence Type Definitions
 * (src/types/gis.ts)
 *
 * Prompt 7 Requirements 2, 4, 7, 9, 10, 17, 20:
 * Defines GeoJSON structures, GIS validation outputs, 7 map layer modes,
 * real observation overlays, horizon-specific AI prediction bindings, and
 * batch block-intelligence payloads.
 */

import { ForecastHorizon } from "@/types/monsoon";
import { GISRiskCategory } from "@/config/riskThresholds";

export type GISMapLayerId =
  | "monsoon_onset"
  | "false_onset"
  | "dry_spell"
  | "heavy_rain"
  | "expected_rainfall"
  | "rainfall_anomaly"
  | "overall_agricultural_risk";

export interface GISMapLayerOption {
  id: GISMapLayerId;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  unit: "%" | "mm";
}

export type GeoJSONGeometryType = "Polygon" | "MultiPolygon" | "Point";

export interface BlockGeoJSONProperties {
  block_id: string;
  block_name: string;
  tehsil_name: string;
  district_name: string;
  state_name: string;
  census_2011_district_code: string;
  lgd_district_code: string;
  admin_level: string;
  centroid_lat: number;
  centroid_lon: number;
  elevation_m: number;
  soil_type: string;
  normal_daily_rain_mm: number;
  geometry_mode: "polygon_boundary" | "centroid_fallback";
  boundary_source: string;
  crs: "EPSG:4326";
}

export interface BlockGeoJSONGeometry {
  type: GeoJSONGeometryType;
  coordinates: number[] | number[][][] | number[][][][];
}

export interface BlockGeoJSONFeature {
  type: "Feature";
  properties: BlockGeoJSONProperties;
  geometry: BlockGeoJSONGeometry;
}

export interface BoundaryProvenanceMetadata {
  dataset_name: string;
  source: string;
  source_url: string;
  administrative_level: string;
  download_date: string;
  license: string;
  crs: "EPSG:4326";
  geometry_mode: "polygon_boundary" | "centroid_fallback";
  status_banner: string;
}

export interface BlockGeoJSONCollection {
  type: "FeatureCollection";
  metadata: BoundaryProvenanceMetadata;
  features: BlockGeoJSONFeature[];
}

export interface GISValidationResult {
  valid: boolean;
  feature_count: number;
  matched_locations: number;
  missing_blocks: string[];
  duplicate_blocks: string[];
  invalid_geometries: string[];
  geometry_mode: "polygon_boundary" | "centroid_fallback" | "unavailable";
  status_message: string;
}

export interface GISHealthResponse {
  status: "healthy" | "degraded" | "unavailable";
  boundary_source: string;
  administrative_level: string;
  crs: string;
  geometry_mode: "polygon_boundary" | "centroid_fallback" | "unavailable";
  feature_count: number;
  matched_locations: number;
  missing_locations: number;
  invalid_geometries: number;
  missing_blocks: string[];
  duplicate_blocks: string[];
  status_banner: string;
  checked_at: string;
}

export interface BlockRealObservation {
  available: boolean;
  label: "REAL OBSERVATION" | "DEMO DATA" | "UNAVAILABLE";
  rainfall_mm: number | null;
  cumulative_7d_rain_mm: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
  pressure_hpa: number | null;
  wind_speed_kmh: number | null;
  observation_timestamp: string | null;
  updated_ago: string;
  source: string;
  quality: string;
}

export interface BlockHorizonAIPrediction {
  available: boolean;
  source_mode: "AI_FORECAST" | "SIMULATED_FORECAST" | "DEMO_DATA" | "UNAVAILABLE";
  status_message: string;
  horizon: ForecastHorizon;
  horizon_days: number;
  model_name: string;
  model_version: string;
  dataset_version: string;
  training_period: string;
  test_period: string;
  initialization_date: string;
  observation_cutoff: string;
  issued_at: string;

  // Calibrated probabilities [0, 1]
  onset_probability: number | null;
  false_onset_probability: number | null;
  dry_spell_probability: number | null;
  heavy_rain_probability: number | null;

  // Raw uncalibrated probabilities [0, 1]
  onset_raw_probability: number | null;
  false_onset_raw_probability: number | null;
  dry_spell_raw_probability: number | null;
  heavy_rain_raw_probability: number | null;

  // Percentages [0, 100]
  onset_probability_pct: number | null;
  false_onset_probability_pct: number | null;
  dry_spell_probability_pct: number | null;
  heavy_rain_probability_pct: number | null;

  // Rainfall regression & empirical 80% validation residual interval
  expected_rainfall_mm: number | null;
  rainfall_anomaly_pct: number | null;
  uncertainty_interval_low_mm: number | null;
  uncertainty_interval_high_mm: number | null;
  calibration_method: string;
  drift_status: string;
  prediction_hash: string | null;
}

export interface BlockLayerRiskSummary {
  layer_id: GISMapLayerId;
  category: GISRiskCategory | "UNAVAILABLE";
  label: string;
  probability: number | null; // [0, 1] for probability layers
  display_value: string;      // e.g. "78.0%" or "94.2 mm"
  hex_color: string;
  border_hex: string;
  icon_symbol: string;
  threshold_range: string;
}

export interface BlockSpatialIntelligence {
  block_id: string;
  block_name: string;
  tehsil_name: string;
  district: string;
  state: string;
  coordinates: [number, number]; // [lat, lon] in WGS84
  elevation_m: number;
  soil_type: string;
  farmers_registered: number;
  cultivated_area_ha: number;
  geometry: BlockGeoJSONGeometry;
  geometry_mode: "polygon_boundary" | "centroid_fallback";
  observation: BlockRealObservation;
  prediction: BlockHorizonAIPrediction;
  all_horizon_predictions?: Record<ForecastHorizon, BlockHorizonAIPrediction>;
  overall_agricultural_risk: {
    probability: number | null;
    percentage: number | null;
    category: GISRiskCategory | "UNAVAILABLE";
    formula: string;
    components: {
      onset_delay: number;
      false_onset: number;
      dry_spell: number;
      heavy_rain: number;
    } | null;
  };
  layer_risks: Record<GISMapLayerId, BlockLayerRiskSummary>;
  advisory_summary: {
    main_issue: string;
    recommended_action: string;
    dominant_crops: string[];
  };
}

export interface GISBatchIntelligenceResponse {
  status: "ok" | "degraded";
  horizon: ForecastHorizon;
  engine_mode: "AI_FORECAST" | "SIMULATED" | "DEMO";
  validation: GISValidationResult;
  provenance: {
    boundaries: BoundaryProvenanceMetadata;
    observations_source: string;
    observations_last_updated: string | null;
    ai_model_name: string;
    ai_model_version: string;
    training_period: string;
    validation_period: string;
    test_period: string;
    scientific_limitations: string[];
  };
  blocks: BlockSpatialIntelligence[];
}
