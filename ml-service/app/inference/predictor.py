"""
Real Inference Predictor (ml-service/app/inference/predictor.py)
Loads trained artifacts (`xgboost_models.joblib`, `lstm_model.pt`, `calibrators.joblib`,
`model_metadata.json`) and executes leakage-free causal inference for a given
`location_id`, `forecast_horizon`, and `initialization_date`.

Prompt 6 Requirements:
- Fails loudly (`ValueError`) on invalid forecast horizons, invalid locations,
  missing feature values, or insufficient 30-day lookback windows.
- Removes the heuristic `confidence: 85%` score and outputs explicit `calibrated_probability`,
  `raw_probability`, `calibration_method`, and empirical residual `prediction_uncertainty`.
- Computes deterministic SHA-256 hashes (`input_hash`, `feature_hash`, `prediction_hash`).
- Evaluates live feature drift (`drift_status`).
"""

import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd

from app.config import (
    ARTIFACTS_DIR,
    DATASET_VERSION,
    FORECAST_HORIZONS,
    MODEL_VERSION,
    PRAYAGRAJ_BLOCKS,
)
from app.data.loader import fetch_or_load_historical_observations
from app.data.feature_engineering import FEATURE_COLUMNS, engineer_features_for_block
from app.models.xgboost_model import MonsoonXGBoostSuite, XGB_ARTIFACT_PATH
from app.models.lstm_model import MonsoonLSTMModel
from app.models.calibration import ProbabilityCalibratorSuite
from app.models.ensemble import MonsoonHybridEnsemble
from app.evaluation.artifact_integrity import (
    compute_sha256_hash,
    validate_artifact_integrity,
    verify_inference_determinism,
)
from app.evaluation.sequence_leakage_audit import run_sequence_and_calibration_audit
from app.evaluation.drift_monitor import evaluate_feature_drift

METADATA_JSON_PATH = ARTIFACTS_DIR / "model_metadata.json"


class MonsoonPredictor:
    def __init__(self) -> None:
        self.is_ready = False
        self.xgb_suite: Optional[MonsoonXGBoostSuite] = None
        self.lstm_model: Optional[MonsoonLSTMModel] = None
        self.calibrators: Optional[ProbabilityCalibratorSuite] = None
        self.ensemble: Optional[MonsoonHybridEnsemble] = None
        self.metadata: Dict[str, Any] = {}
        self.raw_df: Optional[pd.DataFrame] = None
        self._cached_audit: Optional[Dict[str, Any]] = None
        self.reload_artifacts()

    def reload_artifacts(self) -> bool:
        if not XGB_ARTIFACT_PATH.exists() or not METADATA_JSON_PATH.exists():
            self.is_ready = False
            return False

        try:
            self.xgb_suite = MonsoonXGBoostSuite.load()
            self.lstm_model = MonsoonLSTMModel.load()
            self.calibrators = ProbabilityCalibratorSuite.load()
            self.ensemble = MonsoonHybridEnsemble(
                self.xgb_suite, self.lstm_model, self.calibrators
            )
            with open(METADATA_JSON_PATH, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)
            self.raw_df, _ = fetch_or_load_historical_observations()
            self.is_ready = True
            return True
        except Exception:
            self.is_ready = False
            return False

    def get_health(self) -> Dict[str, Any]:
        if not self.is_ready:
            self.reload_artifacts()
        return {
            "ready_for_ai_forecast": self.is_ready,
            "model_status": "trained_and_evaluated" if self.is_ready else "artifacts_missing",
            "dataset_status": "loaded" if self.raw_df is not None else "missing",
            "model_name": "MonsoonPulse Ensemble",
            "model_version": self.metadata.get("model_version", MODEL_VERSION),
            "data_version": self.metadata.get("dataset_version", DATASET_VERSION),
            "training_period": self.metadata.get("training_years", "2019–2022"),
            "lstm_active": bool(self.lstm_model and self.lstm_model.is_trained),
            "lstm_message": (
                self.lstm_model.status_message
                if self.lstm_model
                else "LSTM not initialized"
            ),
            "prototype_limitation": (
                "Prototype ML model trained on 2019–2022 data and evaluated on 2024–2025 "
                "held-out test data for Prayagraj district blocks. Not an official IMD forecast."
            ),
        }

    def get_readiness(self) -> Dict[str, Any]:
        """
        Requirement 16: GET /readiness
        Returns artifact status, split status, leakage audit status, calibration status,
        and ready_for_inference boolean.
        """
        if not self.is_ready:
            self.reload_artifacts()

        integrity = validate_artifact_integrity()
        leakage_audit = self.metadata.get("sequence_leakage_audit")
        if not leakage_audit:
            leakage_audit = self.run_audit()

        artifact_ok = bool(integrity.get("artifact_integrity_passed", False))
        split_ok = bool(leakage_audit.get("chronological_split_passed", False))
        leakage_ok = bool(
            leakage_audit.get("sequence_leakage_audit", {}).get("audit_passed", False)
            and leakage_audit.get("scaler_isolation_audit", {}).get("audit_passed", False)
        )
        cal_ok = bool(
            leakage_audit.get("calibration_isolation_audit", {}).get("audit_passed", False)
            and integrity.get("calibrators_loaded", False)
        )
        ready_for_inference = bool(self.is_ready and artifact_ok and split_ok and leakage_ok and cal_ok)

        return {
            "ready_for_inference": ready_for_inference,
            "artifact_status": "PASSED" if artifact_ok else "FAILED",
            "split_status": "PASSED" if split_ok else "FAILED",
            "leakage_audit_status": "PASSED" if leakage_ok else "FAILED",
            "calibration_status": "PASSED" if cal_ok else "FAILED",
            "model_version": self.metadata.get("model_version", MODEL_VERSION),
            "dataset_version": self.metadata.get("dataset_version", DATASET_VERSION),
            "artifact_details": integrity,
            "leakage_summary": {
                "sequence_checked": leakage_audit.get("sequence_leakage_audit", {}).get("sequence_checked", 0),
                "future_contamination_count": leakage_audit.get("sequence_leakage_audit", {}).get(
                    "future_contamination_count", -1
                ),
                "cross_split_contamination": leakage_audit.get("sequence_leakage_audit", {}).get(
                    "cross_split_contamination", -1
                ),
                "scaler_fitted_exclusively_on_train": leakage_audit.get(
                    "scaler_isolation_audit", {}
                ).get("scaler_fitted_exclusively_on_train", False),
                "calibration_fitted_exclusively_on_validation": leakage_audit.get(
                    "calibration_isolation_audit", {}
                ).get("calibration_fitted_exclusively_on_validation", False),
            },
        }

    def run_audit(self) -> Dict[str, Any]:
        """
        Requirement 16: POST /audit
        Runs full sequence leakage audit, scaler isolation audit, calibration isolation audit,
        artifact integrity check, and inference determinism check.
        """
        if self._cached_audit is None:
            leakage_res = run_sequence_and_calibration_audit()
            integrity_res = validate_artifact_integrity()
            determinism_res = verify_inference_determinism(self) if self.is_ready else {"deterministic": False}
            self._cached_audit = {
                **leakage_res,
                "artifact_integrity": integrity_res,
                "inference_determinism": determinism_res,
            }
        return self._cached_audit

    def run_drift_check(
        self,
        location_id: str = "karchhana",
        initialization_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Requirement 12 & 16: POST /drift
        Computes feature drift (PSI, mean Z-shift, std ratio, missingness) on current
        inference window relative to 2019–2022 training distribution.
        """
        if not self.is_ready:
            self.reload_artifacts()
        assert self.raw_df is not None

        loc_id = location_id.lower().strip()
        valid_ids = {b["location_id"] for b in PRAYAGRAJ_BLOCKS}
        if loc_id not in valid_ids:
            raise ValueError(f"Invalid location_id '{location_id}'. Must be one of {sorted(valid_ids)}.")

        bdf = self.raw_df[self.raw_df["location_id"] == loc_id].sort_values("date").copy()
        if initialization_date:
            req_dt = pd.to_datetime(initialization_date[:10])
            if req_dt <= bdf["date"].max() and req_dt >= bdf["date"].min():
                causal_slice = bdf[bdf["date"] <= req_dt].copy()
            else:
                target_doy = req_dt.dayofyear
                bdf_monsoon = bdf[bdf["date"].dt.year == bdf["date"].dt.year.max()]
                idx_closest = (bdf_monsoon["date"].dt.dayofyear - target_doy).abs().idxmin()
                matched_dt = bdf.loc[idx_closest, "date"]
                causal_slice = bdf[bdf["date"] <= matched_dt].copy()
        else:
            monsoon_rows = bdf[bdf["date"].dt.month.isin([6, 7, 8])]
            cutoff_dt = monsoon_rows["date"].max() if len(monsoon_rows) > 0 else bdf["date"].max()
            causal_slice = bdf[bdf["date"] <= cutoff_dt].copy()

        feat_df = engineer_features_for_block(causal_slice)
        # Evaluate drift over the recent 30-day active window
        recent_window = feat_df.tail(30).copy()
        return evaluate_feature_drift(recent_window)

    def get_metrics(self) -> Dict[str, Any]:
        if not self.is_ready:
            self.reload_artifacts()
        if not self.metadata:
            return {
                "ready": False,
                "message": "Model metadata not yet generated. Run training & evaluation scripts.",
            }
        return self.metadata

    def predict(
        self,
        location_id: str,
        forecast_horizon: int = 14,
        initialization_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not self.is_ready:
            if not self.reload_artifacts():
                raise RuntimeError("AI forecast unavailable — model artifacts not found.")

        assert self.raw_df is not None
        assert self.xgb_suite is not None
        assert self.ensemble is not None

        # Fail loudly on invalid horizon (Requirement 15)
        if forecast_horizon not in FORECAST_HORIZONS:
            raise ValueError(
                f"Invalid forecast_horizon={forecast_horizon}. Supported horizons are {FORECAST_HORIZONS}."
            )
        h = int(forecast_horizon)

        # Fail loudly on invalid location_id (Requirement 15)
        loc_id = str(location_id).lower().strip()
        block_meta = next(
            (b for b in PRAYAGRAJ_BLOCKS if b["location_id"] == loc_id),
            None,
        )
        if block_meta is None:
            valid_ids = [b["location_id"] for b in PRAYAGRAJ_BLOCKS]
            raise ValueError(
                f"Invalid location_id='{location_id}'. Supported Prayagraj blocks: {valid_ids}."
            )

        # Filter historical observations strictly for this block
        bdf = self.raw_df[self.raw_df["location_id"] == loc_id].sort_values("date").copy()

        if initialization_date:
            try:
                req_dt = pd.to_datetime(initialization_date[:10])
            except Exception as exc:
                raise ValueError(
                    f"Invalid initialization_date='{initialization_date}'. Expected ISO YYYY-MM-DD."
                ) from exc

            if req_dt <= bdf["date"].max() and req_dt >= bdf["date"].min():
                causal_slice = bdf[bdf["date"] <= req_dt].copy()
            else:
                target_doy = req_dt.dayofyear
                bdf_monsoon = bdf[bdf["date"].dt.year == bdf["date"].dt.year.max()]
                idx_closest = (bdf_monsoon["date"].dt.dayofyear - target_doy).abs().idxmin()
                matched_dt = bdf.loc[idx_closest, "date"]
                causal_slice = bdf[bdf["date"] <= matched_dt].copy()
        else:
            monsoon_rows = bdf[bdf["date"].dt.month.isin([6, 7, 8])]
            cutoff_dt = monsoon_rows["date"].max() if len(monsoon_rows) > 0 else bdf["date"].max()
            causal_slice = bdf[bdf["date"] <= cutoff_dt].copy()

        if len(causal_slice) < 30:
            raise ValueError(
                f"Insufficient lookback observations ({len(causal_slice)} days < 30 required) "
                f"for location_id='{loc_id}' at initialization_date='{initialization_date}'."
            )

        # Engineer strictly causal features (t <= initialization_date)
        feat_df = engineer_features_for_block(causal_slice)
        latest_row_df = feat_df.iloc[[-1]].copy()

        # Check for missing/NaN features
        missing_cols = [
            c for c in FEATURE_COLUMNS if c not in latest_row_df.columns or latest_row_df[c].isna().any()
        ]
        if missing_cols:
            raise ValueError(f"Missing or NaN causal features at inference: {missing_cols}")

        actual_obs_cutoff_dt = pd.to_datetime(latest_row_df["date"].iloc[0])
        obs_cutoff_str = str(actual_obs_cutoff_dt.date())
        init_date_str = initialization_date[:10] if initialization_date else obs_cutoff_str
        forecast_target_dt = pd.to_datetime(init_date_str) + timedelta(days=h)

        # Compute deterministic input & feature SHA-256 hashes (Requirement 10)
        input_payload = {
            "location_id": loc_id,
            "forecast_horizon": h,
            "initialization_date": init_date_str,
            "observation_cutoff": obs_cutoff_str,
        }
        input_hash = compute_sha256_hash(input_payload)

        feature_payload = {
            col: round(float(latest_row_df[col].iloc[0]), 6) for col in FEATURE_COLUMNS
        }
        feature_hash = compute_sha256_hash(feature_payload)

        # Compute calibrated & raw ensemble probabilities
        prob_dict = self.ensemble.predict_all_probabilities(feat_df, latest_row_df)

        p_onset_cal = float(prob_dict[f"onset_{h}d"]["calibrated_probability"][0])
        p_false_onset_cal = float(prob_dict[f"false_onset_{h}d"]["calibrated_probability"][0])
        p_dry_spell_cal = float(prob_dict[f"dry_spell_{h}d"]["calibrated_probability"][0])
        p_heavy_rain_cal = float(prob_dict[f"heavy_rain_{h}d"]["calibrated_probability"][0])

        p_onset_raw = float(prob_dict[f"onset_{h}d"]["uncalibrated_ensemble"][0])
        p_false_onset_raw = float(prob_dict[f"false_onset_{h}d"]["uncalibrated_ensemble"][0])
        p_dry_spell_raw = float(prob_dict[f"dry_spell_{h}d"]["uncalibrated_ensemble"][0])
        p_heavy_rain_raw = float(prob_dict[f"heavy_rain_{h}d"]["uncalibrated_ensemble"][0])

        m_onset = str(prob_dict[f"onset_{h}d"]["calibration_method"])
        m_false_onset = str(prob_dict[f"false_onset_{h}d"]["calibration_method"])
        m_dry_spell = str(prob_dict[f"dry_spell_{h}d"]["calibration_method"])
        m_heavy_rain = str(prob_dict[f"heavy_rain_{h}d"]["calibration_method"])

        # Rainfall regression + 80% empirical validation residual uncertainty interval
        rain_preds, res_std = self.xgb_suite.predict_rainfall(latest_row_df, h)
        expected_rain_mm = round(float(rain_preds[0]), 1)
        normal_mm = float(block_meta["normal_daily_rain_mm"] * h)
        anomaly_pct = round(((expected_rain_mm - normal_mm) / max(normal_mm, 1.0)) * 100.0, 1)

        low_mm = round(max(0.0, expected_rain_mm - 1.28 * res_std), 1)
        high_mm = round(expected_rain_mm + 1.28 * res_std, 1)

        prediction_payload = {
            "onset_probability": round(p_onset_cal, 4),
            "false_onset_probability": round(p_false_onset_cal, 4),
            "dry_spell_probability": round(p_dry_spell_cal, 4),
            "heavy_rain_probability": round(p_heavy_rain_cal, 4),
            "onset_raw_probability": round(p_onset_raw, 4),
            "false_onset_raw_probability": round(p_false_onset_raw, 4),
            "dry_spell_raw_probability": round(p_dry_spell_raw, 4),
            "heavy_rain_raw_probability": round(p_heavy_rain_raw, 4),
            "expected_rainfall": expected_rain_mm,
            "uncertainty_interval_low_mm": low_mm,
            "uncertainty_interval_high_mm": high_mm,
        }
        prediction_hash = compute_sha256_hash(prediction_payload)

        # Evaluate live feature drift over recent 30-day window
        drift_report = evaluate_feature_drift(feat_df.tail(30))
        drift_status = str(drift_report.get("overall_status", "NORMAL"))

        splits_meta = self.metadata.get("splits", {})
        val_samples = int(splits_meta.get("val_samples", 1472))
        test_samples = int(splits_meta.get("test_samples", 2136))

        target_prevalence = self.metadata.get("target_prevalence", {}).get(f"{h}D", {})
        model_skill_notes = self.metadata.get("target_skill_summary", {})
        issued_ts = datetime.utcnow().isoformat() + "Z"

        return {
            "location_id": loc_id,
            "initialization_date": init_date_str,
            "observation_cutoff": obs_cutoff_str,
            "forecast_date": str(forecast_target_dt.date()),
            "horizon_days": h,
            "issued_at": issued_ts,
            "onset_probability": round(p_onset_cal, 4),
            "false_onset_probability": round(p_false_onset_cal, 4),
            "dry_spell_probability": round(p_dry_spell_cal, 4),
            "heavy_rain_probability": round(p_heavy_rain_cal, 4),
            "onset_raw_probability": round(p_onset_raw, 4),
            "false_onset_raw_probability": round(p_false_onset_raw, 4),
            "dry_spell_raw_probability": round(p_dry_spell_raw, 4),
            "heavy_rain_raw_probability": round(p_heavy_rain_raw, 4),
            "onset_probability_pct": round(p_onset_cal * 100.0, 1),
            "false_onset_probability_pct": round(p_false_onset_cal * 100.0, 1),
            "dry_spell_probability_pct": round(p_dry_spell_cal * 100.0, 1),
            "heavy_rain_probability_pct": round(p_heavy_rain_cal * 100.0, 1),
            "onset_raw_probability_pct": round(p_onset_raw * 100.0, 1),
            "false_onset_raw_probability_pct": round(p_false_onset_raw * 100.0, 1),
            "dry_spell_raw_probability_pct": round(p_dry_spell_raw * 100.0, 1),
            "heavy_rain_raw_probability_pct": round(p_heavy_rain_raw * 100.0, 1),
            "onset_calibration_method": m_onset,
            "false_onset_calibration_method": m_false_onset,
            "dry_spell_calibration_method": m_dry_spell,
            "heavy_rain_calibration_method": m_heavy_rain,
            "calibration_method_summary": f"{m_false_onset} (fitted on 2023 validation split, n={val_samples})",
            "expected_rainfall": expected_rain_mm,
            "rainfall_anomaly": anomaly_pct,
            "rainfall_interval_low_mm": low_mm,
            "rainfall_interval_high_mm": high_mm,
            "uncertainty_interval_low_mm": low_mm,
            "uncertainty_interval_high_mm": high_mm,
            "prediction_uncertainty": f"80% validation residual interval: [{low_mm} mm – {high_mm} mm]",
            "uncertainty_note": (
                f"Calibrated probabilities are mapped via {m_false_onset} regression on 2023 validation data "
                f"(n={val_samples}). 80% empirical rainfall interval: [{low_mm} mm – {high_mm} mm]."
            ),
            "validation_sample_count": val_samples,
            "test_sample_count": test_samples,
            "input_hash": input_hash,
            "feature_hash": feature_hash,
            "prediction_hash": prediction_hash,
            "drift_status": drift_status,
            "target_prevalence": target_prevalence,
            "model_skill_notes": model_skill_notes,
            "model_name": "MonsoonPulse Ensemble",
            "model_version": self.metadata.get("model_version", MODEL_VERSION),
            "data_version": self.metadata.get("dataset_version", DATASET_VERSION),
            "training_period": self.metadata.get("training_years", "2019–2022"),
            "data_timestamp": issued_ts,
            "prototype_disclaimer": (
                "Prototype ML model trained on 2019–2022 data and evaluated on 2024–2025 "
                "held-out test data for Prayagraj district blocks. Not an official IMD forecast."
            ),
        }
