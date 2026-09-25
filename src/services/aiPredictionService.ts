/**
 * Next.js AI Prediction Service (src/services/aiPredictionService.ts)
 * Prompt 6 Hardened:
 * Exposes:
 *   - getAIPrediction(locationId, horizon, initializationDate)
 *   - getModelHealth()
 *   - getModelReadiness()
 *   - getModelMetrics()
 *   - getModelAudit()
 *   - getModelDrift(locationId)
 * Persists real AI predictions into the Supabase `ai_predictions` table without
 * overwriting the existing simulated `forecast_predictions` table.
 */

import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { AIPredictionRow } from "@/types/database";
import { ForecastHorizon } from "@/types/monsoon";

const LOCAL_AI_PRED_CACHE_KEY = "monsoonpulse_ai_predictions_v2";

export interface ModelHealthStatus {
  ready_for_ai_forecast: boolean;
  model_status: string;
  dataset_status: string;
  model_name: string;
  model_version: string;
  data_version?: string;
  training_period?: string;
  lstm_active?: boolean;
  lstm_message?: string;
  prototype_limitation?: string;
  message?: string;
}

export interface ModelReadinessStatus {
  ready_for_inference: boolean;
  artifact_status: "PASSED" | "FAILED";
  split_status: "PASSED" | "FAILED";
  leakage_audit_status: "PASSED" | "FAILED";
  calibration_status: "PASSED" | "FAILED";
  model_version: string;
  dataset_version?: string;
  artifact_details?: Record<string, unknown>;
  leakage_summary?: {
    sequence_checked?: number;
    future_contamination_count?: number;
    cross_split_contamination?: number;
    scaler_fitted_exclusively_on_train?: boolean;
    calibration_fitted_exclusively_on_validation?: boolean;
  };
}

export interface CompactModelMetric {
  brier: number | null;
  log_loss: number | null;
  roc_auc: number | null;
  pr_auc: number | null;
  ece: number | null;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  positive_samples: number;
  negative_samples: number;
  positive_rate: number;
  calibration_status: string;
}

export interface SixModelComparisonEntry {
  climatology: CompactModelMetric;
  persistence: CompactModelMetric;
  xgboost: CompactModelMetric;
  lstm: CompactModelMetric;
  ensemble: CompactModelMetric;
  calibrated_ensemble: CompactModelMetric;
}

export interface BaselineComparisonItem {
  target: string;
  horizon: string;
  test_samples: number;
  positive_events: number;
  negative_events?: number;
  positive_rate?: number;
  climatology_brier: number | null;
  persistence_brier: number | null;
  xgboost_brier: number | null;
  lstm_brier: number | null;
  uncalibrated_ensemble_brier?: number | null;
  ensemble_brier: number | null;
  climatology_log_loss?: number | null;
  persistence_log_loss?: number | null;
  xgboost_log_loss?: number | null;
  lstm_log_loss?: number | null;
  uncalibrated_ensemble_log_loss?: number | null;
  ensemble_log_loss?: number | null;
  xgboost_roc_auc?: number | null;
  lstm_roc_auc?: number | null;
  uncalibrated_ensemble_roc_auc?: number | null;
  ensemble_roc_auc: number | null;
  xgboost_pr_auc?: number | null;
  lstm_pr_auc?: number | null;
  uncalibrated_ensemble_pr_auc?: number | null;
  ensemble_pr_auc: number | null;
  xgboost_ece?: number | null;
  lstm_ece?: number | null;
  uncalibrated_ensemble_ece?: number | null;
  ensemble_ece?: number | null;
  calibration_method: string;
  ensemble_beats_climatology: boolean;
}

export interface RegressionMetricItem {
  horizon: string;
  test_samples: number;
  mae_mm: number;
  rmse_mm: number;
  bias_mm: number;
  climatology_mae_mm: number;
  climatology_rmse_mm: number;
  persistence_mae_mm: number;
  persistence_rmse_mm: number;
  beats_climatology: boolean;
}

export interface FeatureImportanceItem {
  feature: string;
  importance: number;
}

export interface DriftFeatureReport {
  feature: string;
  train_mean: number;
  recent_mean: number;
  mean_shift_z: number;
  std_shift_ratio: number;
  missingness_change: number;
  psi: number;
  status: "NORMAL" | "WARNING" | "HIGH DRIFT";
}

export interface DriftMonitorPayload {
  overall_status: "NORMAL" | "WARNING" | "HIGH DRIFT";
  mean_psi: number;
  max_psi: number;
  evaluated_rows: number;
  top_drifted_features: DriftFeatureReport[];
  all_features?: DriftFeatureReport[];
}

export interface ModelMetricsPayload {
  ready: boolean;
  model_name: string;
  model_version: string;
  dataset_version: string;
  training_date: string;
  training_start: string;
  training_end: string;
  training_years: string;
  splits: {
    train_period: string;
    train_years: string;
    train_samples: number;
    val_period: string;
    val_samples: number;
    test_period: string;
    test_samples: number;
  };
  lstm_status: {
    trained: boolean;
    message: string;
  };
  feature_importance: FeatureImportanceItem[];
  model_comparison?: Record<string, Record<string, SixModelComparisonEntry>>;
  target_prevalence?: Record<
    string,
    Record<
      string,
      {
        train: { total_samples: number; positive_samples: number; negative_samples: number; positive_rate: number };
        validation: { total_samples: number; positive_samples: number; negative_samples: number; positive_rate: number };
        test: { total_samples: number; positive_samples: number; negative_samples: number; positive_rate: number };
      }
    >
  >;
  target_skill_summary?: Record<string, string>;
  baseline_comparisons: BaselineComparisonItem[];
  regression_metrics: RegressionMetricItem[];
  backtesting_folds: Array<{
    target: string;
    horizon: string;
    train_years: string;
    test_years: string;
    train_samples: number;
    test_samples: number;
    model_brier: number;
    climatology_brier: number;
    roc_auc: number;
  }>;
  reliability_curve: Array<{
    bin_predicted: number;
    bin_observed: number;
  }>;
  sequence_leakage_audit?: {
    passed: boolean;
    overall_leakage_free: boolean;
    chronological_split_passed: boolean;
    audited_sequences: number;
    sequence_window_days: number;
    train_future_contamination: number;
    validation_future_contamination: number;
    test_future_contamination: number;
    cross_split_contamination: number;
    exact_window_violations: number;
    scaler_leakage: boolean;
    calibration_isolation_valid: boolean;
    details: string[];
  };
  artifact_integrity?: {
    valid: boolean;
    artifact_integrity_passed: boolean;
    model_version: string;
    xgboost_loaded: boolean;
    lstm_loaded: boolean;
    calibration_loaded: boolean;
    version_matches: boolean;
    feature_list_matches: boolean;
    feature_ordering_identical: boolean;
    targets_horizons_complete: boolean;
    expected_classifiers_count: number;
    expected_regressors_count: number;
    errors: string[];
  };
  inference_determinism?: {
    passed: boolean;
    deterministic: boolean;
    hashes_identical: boolean;
    location_id: string;
    horizon_days: number;
    initialization_date: string;
    model_version: string;
    input_hash: string;
    feature_hash: string;
    prediction_hash: string;
    max_floating_point_diff: number;
  };
  drift_monitoring?: {
    training_years: string;
    training_samples: number;
    held_out_test_drift: DriftMonitorPayload;
  };
  prototype_disclaimer: string;
}

function horizonToDays(h: ForecastHorizon | number): number {
  if (typeof h === "number") return h;
  return parseInt(h.replace("D", ""), 10) || 14;
}

export async function getModelHealth(): Promise<ModelHealthStatus> {
  try {
    const res = await fetch("/api/ai-predict?action=health", {
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return (await res.json()) as ModelHealthStatus;
  } catch {
    return {
      ready_for_ai_forecast: false,
      model_status: "unavailable",
      dataset_status: "missing",
      model_name: "MonsoonPulse Ensemble",
      model_version: "MPAI-ENS-0.1",
      message: "AI forecast unavailable — using simulated prototype.",
    };
  }
}

export async function getModelReadiness(): Promise<ModelReadinessStatus> {
  try {
    const res = await fetch("/api/ai-predict?action=readiness", {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as ModelReadinessStatus;
  } catch {
    return {
      ready_for_inference: false,
      artifact_status: "FAILED",
      split_status: "FAILED",
      leakage_audit_status: "FAILED",
      calibration_status: "FAILED",
      model_version: "MPAI-ENS-0.1",
    };
  }
}

export async function getModelMetrics(): Promise<ModelMetricsPayload | null> {
  try {
    const res = await fetch("/api/ai-predict?action=metrics", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.ready === false) return null;
    return data as ModelMetricsPayload;
  } catch {
    return null;
  }
}

export async function getModelDrift(locationId = "karchhana"): Promise<DriftMonitorPayload | null> {
  try {
    const res = await fetch(`/api/ai-predict?action=drift&location_id=${encodeURIComponent(locationId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as DriftMonitorPayload;
  } catch {
    return null;
  }
}

export async function getAIPrediction(
  locationId: string,
  horizon: ForecastHorizon | number = "14D",
  initializationDate?: string
): Promise<AIPredictionRow | null> {
  const horizonDays = horizonToDays(horizon);
  try {
    const res = await fetch("/api/ai-predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: locationId,
        forecast_horizon: horizonDays,
        initialization_date: initializationDate || null,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Predict HTTP ${res.status}`);
    }

    const pred = await res.json();
    if (!pred || pred.error) {
      throw new Error(pred?.error || "Empty prediction response");
    }

    const row: AIPredictionRow = {
      id: `aipred-${pred.location_id}-${pred.initialization_date}-${horizonDays}d-${pred.model_version}`,
      location_id: pred.location_id,
      initialization_date: pred.initialization_date,
      observation_cutoff: pred.observation_cutoff || pred.initialization_date,
      forecast_date: pred.forecast_date,
      horizon_days: horizonDays,
      issued_at: pred.issued_at || pred.data_timestamp || new Date().toISOString(),
      onset_probability: pred.onset_probability,
      false_onset_probability: pred.false_onset_probability,
      dry_spell_probability: pred.dry_spell_probability,
      heavy_rain_probability: pred.heavy_rain_probability,
      onset_raw_probability: pred.onset_raw_probability,
      false_onset_raw_probability: pred.false_onset_raw_probability,
      dry_spell_raw_probability: pred.dry_spell_raw_probability,
      heavy_rain_raw_probability: pred.heavy_rain_raw_probability,
      onset_probability_pct: pred.onset_probability_pct,
      false_onset_probability_pct: pred.false_onset_probability_pct,
      dry_spell_probability_pct: pred.dry_spell_probability_pct,
      heavy_rain_probability_pct: pred.heavy_rain_probability_pct,
      onset_raw_probability_pct: pred.onset_raw_probability_pct,
      false_onset_raw_probability_pct: pred.false_onset_raw_probability_pct,
      dry_spell_raw_probability_pct: pred.dry_spell_raw_probability_pct,
      heavy_rain_raw_probability_pct: pred.heavy_rain_raw_probability_pct,
      onset_calibration_method: pred.onset_calibration_method,
      false_onset_calibration_method: pred.false_onset_calibration_method,
      dry_spell_calibration_method: pred.dry_spell_calibration_method,
      heavy_rain_calibration_method: pred.heavy_rain_calibration_method,
      calibration_method_summary: pred.calibration_method_summary,
      expected_rainfall: pred.expected_rainfall,
      rainfall_anomaly: pred.rainfall_anomaly,
      rainfall_interval_low_mm: pred.rainfall_interval_low_mm,
      rainfall_interval_high_mm: pred.rainfall_interval_high_mm,
      uncertainty_interval_low_mm:
        pred.uncertainty_interval_low_mm ?? pred.rainfall_interval_low_mm,
      uncertainty_interval_high_mm:
        pred.uncertainty_interval_high_mm ?? pred.rainfall_interval_high_mm,
      prediction_uncertainty: pred.prediction_uncertainty,
      uncertainty_note: pred.uncertainty_note,
      validation_sample_count: pred.validation_sample_count ?? 1472,
      test_sample_count: pred.test_sample_count ?? 2136,
      input_hash: pred.input_hash,
      feature_hash: pred.feature_hash,
      prediction_hash: pred.prediction_hash,
      drift_status: pred.drift_status || "NORMAL",
      target_prevalence: pred.target_prevalence,
      model_skill_notes: pred.model_skill_notes,
      model_name: pred.model_name || "MonsoonPulse Ensemble",
      model_version: pred.model_version || "MPAI-ENS-0.1",
      data_version: pred.data_version || "PRAYAGRAJ-ERA5-HIST-2019-2025-v1",
      training_period: pred.training_period || "2019–2022",
      data_timestamp: pred.data_timestamp || new Date().toISOString(),
      prototype_disclaimer:
        pred.prototype_disclaimer ||
        "Prototype ML model trained on 2019–2022 data and evaluated on 2024–2025 held-out test data for Prayagraj district blocks. Not an official IMD forecast.",
      created_at: new Date().toISOString(),
    };

    // Cache locally
    if (typeof window !== "undefined") {
      try {
        const existing = window.localStorage.getItem(LOCAL_AI_PRED_CACHE_KEY);
        const map = existing
          ? (JSON.parse(existing) as Record<string, AIPredictionRow>)
          : {};
        map[`${locationId}_${horizonDays}`] = row;
        window.localStorage.setItem(LOCAL_AI_PRED_CACHE_KEY, JSON.stringify(map));
      } catch {
        // ignore
      }
    }

    // Store in Supabase `ai_predictions` table (Prompt 6 Requirement 17)
    const client = getSupabaseClient();
    if (isSupabaseConfigured() && client) {
      try {
        await client.from("ai_predictions").upsert(
          {
            id: row.id,
            location_id: row.location_id,
            initialization_date: row.initialization_date,
            observation_cutoff: row.observation_cutoff,
            forecast_date: row.forecast_date,
            horizon_days: row.horizon_days,
            issued_at: row.issued_at,
            onset_probability: row.onset_probability,
            false_onset_probability: row.false_onset_probability,
            dry_spell_probability: row.dry_spell_probability,
            heavy_rain_probability: row.heavy_rain_probability,
            onset_raw_probability: row.onset_raw_probability,
            false_onset_raw_probability: row.false_onset_raw_probability,
            dry_spell_raw_probability: row.dry_spell_raw_probability,
            heavy_rain_raw_probability: row.heavy_rain_raw_probability,
            calibration_method: row.false_onset_calibration_method || "isotonic",
            expected_rainfall: row.expected_rainfall,
            rainfall_anomaly: row.rainfall_anomaly,
            uncertainty_interval_low: row.uncertainty_interval_low_mm ?? 0,
            uncertainty_interval_high: row.uncertainty_interval_high_mm ?? 0,
            validation_sample_count: row.validation_sample_count ?? 1472,
            test_sample_count: row.test_sample_count ?? 2136,
            input_hash: row.input_hash,
            feature_hash: row.feature_hash,
            prediction_hash: row.prediction_hash,
            drift_status: row.drift_status || "NORMAL",
            model_version: row.model_version,
            dataset_version: row.data_version,
            data_version: row.data_version,
            created_at: row.created_at,
          },
          {
            onConflict: "location_id,initialization_date,horizon_days,model_version",
          }
        );
      } catch {
        // Non-fatal if migration 003 has not been executed in remote Supabase yet
      }
    }

    return row;
  } catch {
    const client = getSupabaseClient();
    if (isSupabaseConfigured() && client) {
      try {
        const { data } = await client
          .from("ai_predictions")
          .select("*")
          .eq("location_id", locationId)
          .eq("horizon_days", horizonDays)
          .order("initialization_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) return data as AIPredictionRow;
      } catch {
        // ignore
      }
    }
    return null;
  }
}
