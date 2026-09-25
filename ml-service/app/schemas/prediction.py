"""
Pydantic Request & Response Schemas for MonsoonPulse AI FastAPI ML Service
(ml-service/app/schemas/prediction.py)

Prompt 6 Requirements 6, 10, 12, 17:
- Explicit separation of `calibrated_probability`, `raw_probability`, `calibration_method`,
  and `prediction_uncertainty` (80% empirical validation residual interval).
- Deterministic SHA-256 hashes (`input_hash`, `feature_hash`, `prediction_hash`).
- Live feature drift status (`drift_status`: NORMAL, WARNING, HIGH DRIFT).
"""

from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    location_id: str = Field(..., description="Block identifier, e.g., 'karchhana'")
    forecast_horizon: int = Field(14, description="Horizon in days: 7, 14, 21, or 30")
    initialization_date: Optional[str] = Field(
        None,
        description="ISO date YYYY-MM-DD up to which causal observations are used",
    )


class PredictResponse(BaseModel):
    location_id: str
    initialization_date: str
    observation_cutoff: str
    forecast_date: str
    horizon_days: int
    issued_at: str

    # Calibrated Probabilities in [0, 1] internal range
    onset_probability: float
    false_onset_probability: float
    dry_spell_probability: float
    heavy_rain_probability: float

    # Raw Uncalibrated Ensemble Probabilities in [0, 1]
    onset_raw_probability: float
    false_onset_raw_probability: float
    dry_spell_raw_probability: float
    heavy_rain_raw_probability: float

    # UI Percentages [0, 100] (Calibrated)
    onset_probability_pct: float
    false_onset_probability_pct: float
    dry_spell_probability_pct: float
    heavy_rain_probability_pct: float

    # UI Percentages [0, 100] (Raw Uncalibrated)
    onset_raw_probability_pct: float
    false_onset_raw_probability_pct: float
    dry_spell_raw_probability_pct: float
    heavy_rain_raw_probability_pct: float

    # Calibration Methods per Target
    onset_calibration_method: str
    false_onset_calibration_method: str
    dry_spell_calibration_method: str
    heavy_rain_calibration_method: str
    calibration_method_summary: str

    # Rainfall regression & empirical residual uncertainty (Requirement 6)
    expected_rainfall: float
    rainfall_anomaly: float
    rainfall_interval_low_mm: float
    rainfall_interval_high_mm: float
    uncertainty_interval_low_mm: float
    uncertainty_interval_high_mm: float
    prediction_uncertainty: str
    uncertainty_note: str

    # Validation & Held-out sample counts
    validation_sample_count: int
    test_sample_count: int

    # Deterministic SHA-256 Hashes (Requirement 10)
    input_hash: str
    feature_hash: str
    prediction_hash: str

    # Feature Drift Monitoring (Requirement 12)
    drift_status: str

    # Target Prevalence & Target-Specific Skill Notes (Requirements 7 & 8)
    target_prevalence: Dict[str, Any]
    model_skill_notes: Dict[str, str]

    # Provenance & versioning
    model_name: str
    model_version: str
    data_version: str
    training_period: str
    data_timestamp: str
    prototype_disclaimer: str
