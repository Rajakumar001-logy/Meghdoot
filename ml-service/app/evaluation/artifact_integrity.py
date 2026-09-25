"""
Model Artifact Integrity & Deterministic Inference Validator
(ml-service/app/evaluation/artifact_integrity.py)

Prompt 6 Requirements 9 & 10:
- Validates XGBoost, LSTM, Calibration, and Metadata artifacts
- Verifies exact feature list and ordering equality (`saved_features == FEATURE_COLUMNS`)
- Verifies target x horizon completeness (16 classifiers + 4 regressors)
- Executes deterministic inference verification (`prediction_1 == prediction_2` with SHA-256 hashes)
"""

import hashlib
import json
from typing import Dict, Any, List
import joblib
import numpy as np

from app.config import (
    ARTIFACTS_DIR,
    CLASSIFICATION_TARGETS,
    FORECAST_HORIZONS,
    MODEL_VERSION,
)
from app.data.feature_engineering import FEATURE_COLUMNS
from app.models.xgboost_model import XGB_ARTIFACT_PATH, MonsoonXGBoostSuite
from app.models.lstm_model import LSTM_ARTIFACT_PATH, LSTM_SCALER_PATH, MonsoonLSTMModel
from app.models.calibration import CALIBRATION_ARTIFACT_PATH, ProbabilityCalibratorSuite

METADATA_JSON_PATH = ARTIFACTS_DIR / "model_metadata.json"


def compute_sha256_hex(payload: Any) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()[:16]


def compute_sha256_hash(payload: Any) -> str:
    return compute_sha256_hex(payload)


def validate_artifact_integrity() -> Dict[str, Any]:
    errors: List[str] = []

    xgb_exists = XGB_ARTIFACT_PATH.exists()
    lstm_exists = LSTM_ARTIFACT_PATH.exists() and LSTM_SCALER_PATH.exists()
    cal_exists = CALIBRATION_ARTIFACT_PATH.exists()
    meta_exists = METADATA_JSON_PATH.exists()

    if not xgb_exists:
        errors.append("Missing xgboost_models.joblib")
    if not lstm_exists:
        errors.append("Missing lstm_model.pt or lstm_scaler.joblib")
    if not cal_exists:
        errors.append("Missing calibrators.joblib")
    if not meta_exists:
        errors.append("Missing model_metadata.json")

    xgb_loaded = False
    lstm_loaded = False
    cal_loaded = False
    version_matches = False
    feature_list_matches = False
    feature_ordering_identical = False
    targets_horizons_complete = False

    expected_keys = [
        f"{t}_{h}d" for h in FORECAST_HORIZONS for t in CLASSIFICATION_TARGETS
    ]

    if xgb_exists:
        try:
            raw_xgb = joblib.load(XGB_ARTIFACT_PATH)
            saved_cols = list(raw_xgb.get("feature_columns", []))
            feature_list_matches = set(saved_cols) == set(FEATURE_COLUMNS)
            feature_ordering_identical = saved_cols == FEATURE_COLUMNS
            if not feature_ordering_identical:
                errors.append("Feature ordering mismatch between XGBoost artifact and FEATURE_COLUMNS")

            xgb_suite = MonsoonXGBoostSuite.load()
            xgb_loaded = True

            has_all_clf = all(k in xgb_suite.classifiers for k in expected_keys)
            has_all_reg = all(h in xgb_suite.regressors for h in FORECAST_HORIZONS)
            targets_horizons_complete = has_all_clf and has_all_reg
            if not targets_horizons_complete:
                errors.append("Incomplete target x horizon models in XGBoost suite")
        except Exception as exc:
            errors.append(f"XGBoost load error: {exc}")

    if lstm_exists:
        try:
            lstm_model = MonsoonLSTMModel.load()
            lstm_loaded = bool(lstm_model.is_trained and lstm_model.net is not None)
            if not lstm_loaded:
                errors.append("LSTM net failed to initialize")
        except Exception as exc:
            errors.append(f"LSTM load error: {exc}")

    if cal_exists:
        try:
            cal_suite = ProbabilityCalibratorSuite.load()
            cal_loaded = all(k in cal_suite.calibrators for k in expected_keys)
            if not cal_loaded:
                errors.append("Incomplete calibrators in calibrators.joblib")
        except Exception as exc:
            errors.append(f"Calibration load error: {exc}")

    if meta_exists:
        try:
            with open(METADATA_JSON_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)
            version_matches = meta.get("model_version") == MODEL_VERSION
            if not version_matches:
                errors.append(
                    f"Metadata version {meta.get('model_version')} != {MODEL_VERSION}"
                )
            if meta.get("features") != FEATURE_COLUMNS:
                feature_ordering_identical = False
                errors.append("Metadata features list does not match FEATURE_COLUMNS ordering")
        except Exception as exc:
            errors.append(f"Metadata load error: {exc}")

    valid = (
        xgb_loaded
        and lstm_loaded
        and cal_loaded
        and version_matches
        and feature_list_matches
        and feature_ordering_identical
        and targets_horizons_complete
        and len(errors) == 0
    )

    return {
        "valid": bool(valid),
        "artifact_integrity_passed": bool(valid),
        "model_version": MODEL_VERSION,
        "xgboost_loaded": xgb_loaded,
        "lstm_loaded": lstm_loaded,
        "calibration_loaded": cal_loaded,
        "calibrators_loaded": cal_loaded,
        "version_matches": version_matches,
        "feature_list_matches": feature_list_matches,
        "feature_ordering_identical": feature_ordering_identical,
        "targets_horizons_complete": targets_horizons_complete,
        "expected_classifiers_count": len(expected_keys),
        "expected_regressors_count": len(FORECAST_HORIZONS),
        "errors": errors,
    }


def verify_inference_determinism(
    predictor: Any,
    location_id: str = "karchhana",
    forecast_horizon: int = 14,
    initialization_date: str = "2025-08-31",
) -> Dict[str, Any]:
    """
    Requirement 10: Runs inference twice on the exact same observation snapshot
    and verifies `prediction_1 == prediction_2` within floating-point tolerance (< 1e-12).
    """
    pred_1 = predictor.predict(
        location_id=location_id,
        forecast_horizon=forecast_horizon,
        initialization_date=initialization_date,
    )
    pred_2 = predictor.predict(
        location_id=location_id,
        forecast_horizon=forecast_horizon,
        initialization_date=initialization_date,
    )

    numeric_keys = [
        "onset_probability",
        "false_onset_probability",
        "dry_spell_probability",
        "heavy_rain_probability",
        "expected_rainfall",
        "rainfall_anomaly",
    ]
    diffs = [abs(float(pred_1[k]) - float(pred_2[k])) for k in numeric_keys]
    max_diff = float(np.max(diffs))
    hashes_identical = bool(
        pred_1["input_hash"] == pred_2["input_hash"]
        and pred_1["feature_hash"] == pred_2["feature_hash"]
        and pred_1["prediction_hash"] == pred_2["prediction_hash"]
    )
    deterministic = bool(max_diff < 1e-12 and hashes_identical)

    return {
        "passed": deterministic,
        "deterministic": deterministic,
        "hashes_identical": hashes_identical,
        "location_id": location_id,
        "horizon_days": forecast_horizon,
        "initialization_date": initialization_date,
        "model_version": pred_1["model_version"],
        "input_hash": pred_1["input_hash"],
        "feature_hash": pred_1["feature_hash"],
        "prediction_hash": pred_1["prediction_hash"],
        "max_floating_point_diff": max_diff,
        "max_probability_diff": max_diff,
    }
