/**
 * TypeScript Interfaces matching the Supabase PostgreSQL tables:
 * Core 8 tables + 4 External Data Ingestion tables:
 * - weather_observations
 * - rainfall_observations
 * - climate_index_observations
 * - data_source_status
 */

export type DataQualityFlag =
  | "valid"
  | "missing"
  | "estimated"
  | "stale"
  | "invalid";

export type DataSourceHealthStatus = "healthy" | "degraded" | "offline";

export interface LocationRow {
  id: string;
  state: string;
  district: string;
  block: string;
  panchayat: string;
  latitude: number;
  longitude: number;
  soil_type: string;
  created_at: string;
}

export interface ClimateIndexRow {
  id: string;
  date: string;
  enso_index: number;
  enso_phase: string;
  iod_index: number;
  iod_phase: string;
  mjo_phase: string;
  mjo_amplitude: number;
  source: string;
  created_at: string;
}

export interface ForecastPredictionRow {
  id: string;
  location_id: string;
  forecast_date: string;
  horizon_days: 7 | 14 | 21 | 30;
  onset_probability: number;
  false_onset_probability: number;
  dry_spell_probability: number;
  heavy_rain_probability: number;
  expected_rainfall: number;
  rainfall_anomaly: number;
  confidence: number;
  risk_level: "Low" | "Moderate" | "High" | "Very High";
  created_at: string;
}

export interface RainfallForecastRow {
  id: string;
  location_id: string;
  forecast_date: string;
  horizon_days: number;
  predicted_rainfall: number;
  historical_average: number;
  p10: number;
  p90: number;
  created_at: string;
}

export interface CropRow {
  id: string;
  name: string;
  scientific_name: string;
  category: string;
  created_at: string;
}

export interface CropAdvisoryRow {
  id: string;
  location_id: string;
  crop_id: string;
  horizon_days: 7 | 14 | 21 | 30;
  risk_condition: string;
  advisory_text: string;
  advisory_text_hi: string;
  confidence: number;
  created_at: string;
}

export interface AlertRow {
  id: string;
  location_id: string;
  alert_type: "Dry Spell" | "False Onset" | "Rainfall Anomaly" | "Heavy Rain";
  severity: "high" | "warning" | "watch";
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface FarmerMessageRow {
  id: string;
  location_id: string;
  crop_id: string;
  language: "Hindi" | "English";
  channel: "WhatsApp" | "SMS" | "Mobile App";
  message: string;
  status: "simulated";
  created_at: string;
}

// ============================================================================
// NEW EXTERNAL DATA INGESTION TABLES (Step 3, 4, 9)
// ============================================================================

export interface WeatherObservationRow {
  id: string;
  location_id: string;
  observation_date: string;
  precipitation_mm: number | null;
  rainfall_mm: number | null;
  temperature_c: number | null;
  humidity: number | null;
  humidity_pct: number | null;
  wind_speed: number | null;
  wind_speed_kmh: number | null;
  pressure: number | null;
  pressure_hpa: number | null;
  weather_condition?: string;
  quality_flag: DataQualityFlag;
  source: string;
  created_at: string;
}

export interface RainfallObservationRow {
  id: string;
  location_id: string;
  observation_date: string;
  rainfall_mm: number | null;
  normal_rainfall_mm?: number | null;
  anomaly_percent?: number | null;
  source: string;
  quality_flag: DataQualityFlag;
  created_at: string;
}

export interface ClimateIndexObservationRow {
  id: string;
  observation_date: string;
  index_name: "ENSO" | "IOD" | "MJO";
  index_value: number | null;
  phase: string;
  amplitude?: number | null;
  quality_flag: DataQualityFlag;
  source: string;
  created_at: string;
}

export interface DataSourceStatusRow {
  id: string;
  source_name: string;
  provider: string;
  provider_name?: string;
  data_type?: "Weather Data" | "Climate Data" | "Rainfall Data";
  last_successful_fetch: string | null;
  last_attempted_fetch: string | null;
  status: DataSourceHealthStatus;
  error_message: string | null;
  created_at?: string;
}

export interface AIPredictionRow {
  id: string;
  location_id: string;
  initialization_date: string;
  observation_cutoff?: string;
  forecast_date: string;
  horizon_days: number;
  issued_at?: string;

  // Calibrated probabilities [0, 1]
  onset_probability: number;
  false_onset_probability: number;
  dry_spell_probability: number;
  heavy_rain_probability: number;

  // Raw uncalibrated ensemble probabilities [0, 1]
  onset_raw_probability?: number;
  false_onset_raw_probability?: number;
  dry_spell_raw_probability?: number;
  heavy_rain_raw_probability?: number;

  // UI Percentages [0, 100] (Calibrated)
  onset_probability_pct?: number;
  false_onset_probability_pct?: number;
  dry_spell_probability_pct?: number;
  heavy_rain_probability_pct?: number;

  // UI Percentages [0, 100] (Raw Uncalibrated)
  onset_raw_probability_pct?: number;
  false_onset_raw_probability_pct?: number;
  dry_spell_raw_probability_pct?: number;
  heavy_rain_raw_probability_pct?: number;

  // Calibration methods
  onset_calibration_method?: string;
  false_onset_calibration_method?: string;
  dry_spell_calibration_method?: string;
  heavy_rain_calibration_method?: string;
  calibration_method_summary?: string;

  // Rainfall regression & empirical 80% validation residual interval
  expected_rainfall: number;
  rainfall_anomaly: number;
  rainfall_interval_low_mm?: number;
  rainfall_interval_high_mm?: number;
  uncertainty_interval_low_mm?: number;
  uncertainty_interval_high_mm?: number;
  prediction_uncertainty?: string;
  uncertainty_note?: string;

  // Validation & held-out test sample counts
  validation_sample_count?: number;
  test_sample_count?: number;

  // Deterministic SHA-256 hashes & drift status
  input_hash?: string;
  feature_hash?: string;
  prediction_hash?: string;
  drift_status?: string;
  target_prevalence?: Record<string, unknown>;
  model_skill_notes?: Record<string, string>;

  model_name?: string;
  model_version: string;
  data_version: string;
  training_period?: string;
  data_timestamp?: string;
  prototype_disclaimer?: string;
  created_at: string;
}

