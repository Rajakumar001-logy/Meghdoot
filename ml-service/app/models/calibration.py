"""
Probability Calibration Layer (ml-service/app/models/calibration.py)

Requirement 18:
Uses IsotonicRegression (when validation positive sample count >= 30) or Platt
Scaling / Logistic Calibration on log-odds (when sample count is smaller) to transform
raw ensemble probabilities into calibrated probabilities (`calibrated_probability`).
Never simply multiplies probabilities by a constant.
"""

from typing import Dict, Any
import joblib
import numpy as np
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression

from app.config import ARTIFACTS_DIR

CALIBRATION_ARTIFACT_PATH = ARTIFACTS_DIR / "calibrators.joblib"


def _to_logit(p: np.ndarray) -> np.ndarray:
    p_clip = np.clip(p, 1e-4, 1.0 - 1e-4)
    return np.log(p_clip / (1.0 - p_clip)).reshape(-1, 1)


class ProbabilityCalibratorSuite:
    def __init__(self) -> None:
        self.calibrators: Dict[str, Any] = {}
        self.methods: Dict[str, str] = {}

    def fit_key(self, key: str, raw_val_probs: np.ndarray, y_val: np.ndarray) -> str:
        pos_count = int(np.sum(y_val == 1))
        neg_count = int(np.sum(y_val == 0))

        if pos_count < 3 or neg_count < 3:
            self.calibrators[key] = None
            self.methods[key] = "identity_insufficient_val_events"
            return self.methods[key]

        if pos_count >= 35 and len(y_val) >= 200:
            iso = IsotonicRegression(out_of_bounds="clip", y_min=0.01, y_max=0.99)
            iso.fit(raw_val_probs, y_val.astype(float))
            self.calibrators[key] = iso
            self.methods[key] = "isotonic_regression"
        else:
            platt = LogisticRegression(C=1.0, solver="lbfgs")
            platt.fit(_to_logit(raw_val_probs), y_val.astype(int))
            self.calibrators[key] = platt
            self.methods[key] = "platt_logistic_scaling"

        return self.methods[key]

    def calibrate(self, key: str, raw_probs: np.ndarray) -> np.ndarray:
        cal = self.calibrators.get(key)
        method = self.methods.get(key, "none")
        if cal is None:
            return np.clip(raw_probs, 0.01, 0.99)
        if method == "isotonic_regression":
            return np.clip(cal.predict(raw_probs), 0.01, 0.99)
        if method == "platt_logistic_scaling":
            return np.clip(cal.predict_proba(_to_logit(raw_probs))[:, 1], 0.01, 0.99)
        return np.clip(raw_probs, 0.01, 0.99)

    def save(self, path=CALIBRATION_ARTIFACT_PATH) -> None:
        joblib.dump({"calibrators": self.calibrators, "methods": self.methods}, path)

    @classmethod
    def load(cls, path=CALIBRATION_ARTIFACT_PATH) -> "ProbabilityCalibratorSuite":
        inst = cls()
        if path.exists():
            data = joblib.load(path)
            inst.calibrators = data.get("calibrators", {})
            inst.methods = data.get("methods", {})
        return inst
