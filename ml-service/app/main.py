"""
FastAPI Backend for MonsoonPulse AI Real ML Prediction Engine (MPAI-ENS-0.1)
(ml-service/app/main.py)

Prompt 6 Requirement 16 Endpoints:
- GET /health
- GET /readiness
- GET /model-metrics
- POST /predict
- POST /audit
- POST /drift
"""

from typing import Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.inference.predictor import MonsoonPredictor
from app.schemas.prediction import PredictRequest, PredictResponse


class DriftRequest(BaseModel):
    location_id: str = "karchhana"
    initialization_date: Optional[str] = None


app = FastAPI(
    title="MonsoonPulse AI — ML Prediction Service",
    version="0.1.0",
    description=(
        "Scientifically defensible prototype ML pipeline (XGBoost + Temporal LSTM + "
        "Platt/Isotonic Calibration) for block-level monsoon onset, false onset, "
        "break-monsoon, and heavy rainfall probabilities."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

predictor = MonsoonPredictor()


@app.get("/health")
def get_health():
    """
    Returns model status, dataset status, model version, and training coverage.
    """
    return predictor.get_health()


@app.get("/readiness")
def get_readiness():
    """
    Prompt 6 Requirement 16:
    Returns artifact status, split status, leakage audit status, calibration status,
    and ready_for_inference boolean.
    """
    return predictor.get_readiness()


@app.get("/model-metrics")
def get_model_metrics():
    """
    Returns evaluation metrics computed on the unseen chronological test split,
    6-model baseline comparisons (Climatology, Persistence, XGBoost, LSTM,
    Uncalibrated Ensemble, Calibrated Ensemble), target prevalence, calibration curves,
    sequence leakage audit, and XGBoost feature importances.
    """
    return predictor.get_metrics()


@app.post("/predict", response_model=PredictResponse)
def post_predict(req: PredictRequest):
    """
    Generates leakage-free calibrated ensemble probabilities and expected rainfall
    for a given location_id, forecast_horizon (7/14/21/30), and initialization_date.
    Fails loudly (HTTP 400) on invalid horizon, invalid location, or missing features.
    """
    try:
        result = predictor.predict(
            location_id=req.location_id,
            forecast_horizon=req.forecast_horizon,
            initialization_date=req.initialization_date,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.post("/audit")
def post_audit():
    """
    Prompt 6 Requirement 16:
    Executes and returns the full LSTM Sequence Leakage Audit, Scaler Isolation Audit,
    Calibration Isolation Audit, Artifact Integrity Check, and Inference Determinism Verification.
    """
    return predictor.run_audit()


@app.post("/drift")
def post_drift(req: Optional[DriftRequest] = None):
    """
    Prompt 6 Requirement 12 & 16:
    Computes live feature drift (PSI, Mean Shift Z, Std Ratio, Missingness Change)
    against the 2019–2022 training distribution.
    """
    try:
        loc_id = req.location_id if req else "karchhana"
        init_date = req.initialization_date if req else None
        return predictor.run_drift_check(location_id=loc_id, initialization_date=init_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
