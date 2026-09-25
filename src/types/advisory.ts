/**
 * MonsoonPulse AI — Crop-Specific AI Advisory & Agricultural Decision Engine Types
 * (src/types/advisory.ts)
 *
 * Prompt 8 Requirements 1–25:
 * Defines crop agronomic profiles, advisory inputs, decision categories (A–J),
 * severity levels, structured WHAT/WHY/WHEN/ACTION explanations, bilingual
 * English/Hindi content, evidence basis traceability, expiration state, and
 * officer/farmer view structures.
 */

import { ForecastHorizon } from "@/types/monsoon";

export type SupportedCropId =
  | "paddy"
  | "maize"
  | "pulses"
  | "soybean"
  | "cotton"
  | "wheat";

export type CropSensitivityLevel = "LOW" | "MODERATE" | "HIGH";

export type CanonicalGrowthStage =
  | "pre_sowing"
  | "germination"
  | "vegetative"
  | "flowering"
  | "grain_filling"
  | "harvest";

/**
 * Section 1: Configurable Crop Metadata
 */
export interface CropProfileMetadata {
  crop_id: SupportedCropId;
  name: string;
  scientific_name: string;
  local_names: {
    en: string;
    hi: string;
  };
  season: "Kharif" | "Rabi";
  sowing_window: {
    months: number[]; // 1-based calendar months (e.g. [6, 7] for June-July)
    label_en: string;
    label_hi: string;
  };
  harvesting_window: {
    months: number[];
    label_en: string;
    label_hi: string;
  };
  water_requirement: string;
  rainfall_requirement: {
    min_mm: number;
    max_mm: number;
    optimal_14d_sowing_rain_mm: number;
    label: string;
  };
  temperature_range: {
    min_c: number;
    max_c: number;
    label: string;
  };
  critical_growth_stages: {
    id: CanonicalGrowthStage;
    label_en: string;
    label_hi: string;
  }[];
  excess_rain_sensitivity: CropSensitivityLevel;
  dry_spell_sensitivity: CropSensitivityLevel;
  waterlogging_sensitivity: CropSensitivityLevel;
  suitable_blocks: string[]; // Prayagraj blocks where this crop is agronomically appropriate
  suitability_note_en: string;
  suitability_note_hi: string;
}

/**
 * Section 4: Required Decision Categories (A–J)
 */
export type DecisionCategory =
  | "SOW_NOW" // A. SOW NOW
  | "DELAY_SOWING" // B. DELAY SOWING
  | "PREPARE_FOR_SOWING" // C. PREPARE FOR SOWING
  | "IRRIGATION_REQUIRED" // D. IRRIGATION REQUIRED
  | "REDUCE_AVOID_IRRIGATION" // E. REDUCE / AVOID IRRIGATION
  | "DRAINAGE_PREPARATION" // F. DRAINAGE PREPARATION
  | "HEAVY_RAIN_PREPARATION" // G. HEAVY RAIN PREPARATION
  | "MONITOR_FALSE_ONSET_RISK" // H. MONITOR FALSE ONSET RISK
  | "MONITOR_DRY_SPELL" // I. MONITOR DRY SPELL
  | "NO_IMMEDIATE_ACTION"; // J. NO IMMEDIATE ACTION

/**
 * Section 11: Advisory Severity Levels
 */
export type AdvisorySeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export type AdvisorySourceMode = "AI" | "SIMULATED" | "DEMO";

/**
 * Section 3: Advisory Engine Inputs
 */
export interface AdvisoryInputs {
  location_id: string;
  block_name?: string;
  district?: string;
  state?: string;
  crop_id: SupportedCropId;
  forecast_horizon: ForecastHorizon;
  horizon_days: 7 | 14 | 21 | 30;
  crop_stage?: CanonicalGrowthStage | string | null;

  // Real or scenario observations
  current_rainfall: number | null;
  recent_rainfall: number | null; // e.g., 7D cumulative rainfall (mm)
  rainfall_anomaly: number | null; // %
  temperature: number | null; // °C
  humidity: number | null; // %
  soil_moisture: number | null; // % — null if unavailable (NEVER fabricated)

  // Calibrated forecast probabilities [0, 1] (or percentages [0, 100], normalized by engine)
  onset_probability: number | null;
  false_onset_probability: number | null;
  dry_spell_probability: number | null;
  heavy_rain_probability: number | null;
  expected_rainfall: number | null; // mm over horizon

  // Provenance & lifecycle timestamps
  model_version: string;
  observation_cutoff: string;
  prediction_issued_at?: string;
  prediction_valid_until?: string;
  reference_timestamp?: string; // Current evaluation time ISO
  evaluation_month?: number; // 1–12 (defaults to 6/7 Kharif monsoon window)
  source_mode: AdvisorySourceMode;
}

/**
 * Section 12: Traceable Evidence Basis (Never called "AI accuracy")
 */
export interface AdvisoryEvidenceBasis {
  summary_en: string;
  summary_hi: string;
  metrics: {
    label_en: string;
    label_hi: string;
    value: string;
  }[];
  triggered_conditions: string[];
  crop_sensitivity_factor: string;
  forecast_horizon_days: number;
  observation_cutoff: string;
  model_version: string;
  source_mode: AdvisorySourceMode;
}

/**
 * Section 13 & 14: Structured Bilingual Explanation (WHAT / WHY / WHEN / ACTION)
 */
export interface AdvisoryLocalizedContent {
  title: string;
  what: string;
  why: string;
  when: string;
  action: string;
  message: string;
  reason: string;
}

/**
 * Section 15, 16, 17, 21, 22: Generated Advisory Item
 */
export interface GeneratedAdvisoryItem {
  id: string;
  location_id: string;
  crop_id: SupportedCropId;
  rule_id: string;
  decision_category: DecisionCategory;
  decision_code: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
  advisory_type: string;
  severity: AdvisorySeverity;
  priority_rank: number;
  priority_explanation: string;
  forecast_horizon: ForecastHorizon;
  horizon_days: number;
  model_version: string;
  source_mode: AdvisorySourceMode;
  created_at: string;
  valid_until: string;
  status: "ACTIVE" | "EXPIRED";
  en: AdvisoryLocalizedContent;
  hi: AdvisoryLocalizedContent;
  evidence: AdvisoryEvidenceBasis;
}

/**
 * Section 19: Farmer View 4-Pillar Card ("Your Farm Outlook")
 */
export interface FarmerOutlookCard {
  pillar_id: "sowing" | "water" | "heavy_rain" | "dry_spell";
  icon_emoji: "🌱" | "💧" | "🌧️" | "☀️";
  title_en: string;
  title_hi: string;
  severity: AdvisorySeverity;
  risk_label_en: string;
  risk_label_hi: string;
  reason_en: string;
  reason_hi: string;
  action_en: string;
  action_hi: string;
  rule_id: string;
}

/**
 * Full Output Bundle of the Deterministic Advisory Engine
 */
export interface AdvisoryEngineResult {
  location_id: string;
  block_name: string;
  district: string;
  state: string;
  crop_id: SupportedCropId;
  crop_profile: CropProfileMetadata;
  crop_stage_resolved: CanonicalGrowthStage | null;
  crop_stage_status_en: string;
  crop_stage_status_hi: string;
  soil_moisture_status_en: string;
  soil_moisture_status_hi: string;
  horizon: ForecastHorizon;
  horizon_days: number;
  source_mode: AdvisorySourceMode;
  model_version: string;
  observation_cutoff: string;
  created_at: string;
  valid_until: string;
  is_prediction_expired: boolean;
  priority_ordering_explanation: string;
  active_advisories: GeneratedAdvisoryItem[];
  expired_advisories: GeneratedAdvisoryItem[];
  farmer_outlook_cards: FarmerOutlookCard[];
  scientific_disclaimer_en: string;
  scientific_disclaimer_hi: string;
  prototype_rule_disclaimer_en: string;
  prototype_rule_disclaimer_hi: string;
}

/**
 * Section 20: Agricultural / Weather Officer Block Risk & Exposure Row
 */
export interface OfficerBlockAdvisorySummary {
  block_id: string;
  block_name: string;
  onset_probability_pct: number;
  onset_uncertainty_high: boolean;
  false_onset_probability_pct: number;
  dry_spell_probability_pct: number;
  heavy_rain_probability_pct: number;
  expected_rainfall_mm: number;
  rainfall_anomaly_pct: number;
  exposed_crops: string[];
  active_advisory_count: number;
  highest_severity: AdvisorySeverity;
  top_rule_ids: string[];
  top_actions_en: string[];
}
