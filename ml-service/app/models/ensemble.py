"""
Hybrid Weighted Ensemble Model (ml-service/app/models/ensemble.py)

Prompt 6 Requirement 1 & 6:
Combines XGBoost probability (configurable weight 0.6) and LSTM probability (0.4)
into a weighted ensemble, then applies Platt/Isotonic calibration fitted exclusively
on the chronological validation split (2023) to output `calibrated_probability`.

Removes the misleading heuristic `confidence` score (`0.55 * agreement + 0.45 * horizon_penalty`)
and instead returns explicit `raw_ensemble`, `calibrated_probability`, `calibration_method`,
and `inter_model_spread`.
"""

from typing import Dict, Any
import numpy as np
import pandas as pd

from app.config import CLASSIFICATION_TARGETS, ENSEMBLE_CONFIG, FORECAST_HORIZONS
from app.models.xgboost_model import MonsoonXGBoostSuite
from app.models.lstm_model import MonsoonLSTMModel
from app.models.calibration import ProbabilityCalibratorSuite


class MonsoonHybridEnsemble:
    def __init__(
        self,
        xgb_suite: MonsoonXGBoostSuite,
        lstm_model: MonsoonLSTMModel,
        calibrator_suite: ProbabilityCalibratorSuite,
    ) -> None:
        self.xgb_suite = xgb_suite
        self.lstm_model = lstm_model
        self.calibrator_suite = calibrator_suite
        self.w_xgb = float(ENSEMBLE_CONFIG["XGBOOST_WEIGHT"])
        self.w_lstm = float(ENSEMBLE_CONFIG["LSTM_WEIGHT"])

    def fit_calibration(
        self,
        continuous_df: pd.DataFrame,
        val_df: pd.DataFrame,
    ) -> Dict[str, str]:
        """
        Computes blended XGBoost + LSTM probabilities on the chronological validation split
        (2023) and fits the probability calibrators exclusively on validation rows.
        """
        val_reset = val_df.reset_index(drop=True)
        lstm_val_dict = self.lstm_model.predict_proba_dict(continuous_df, val_reset)
        calibration_summary: Dict[str, str] = {}

        for h in FORECAST_HORIZONS:
            for target in CLASSIFICATION_TARGETS:
                key = f"{target}_{h}d"
                p_xgb = self.xgb_suite.predict_proba_matrix(val_reset, target, h)
                if self.lstm_model.is_trained and key in lstm_val_dict:
                    p_lstm = lstm_val_dict[key]
                    raw_blend = self.w_xgb * p_xgb + self.w_lstm * p_lstm
                else:
                    raw_blend = p_xgb

                y_val = val_reset[f"target_{key}"].values.astype(int)
                method = self.calibrator_suite.fit_key(key, raw_blend, y_val)
                calibration_summary[key] = method

        return calibration_summary

    def predict_all_probabilities(
        self,
        continuous_df: pd.DataFrame,
        eval_df: pd.DataFrame,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Returns per `{target}_{horizon}d`:
          - `xgb_prob`: raw XGBoost probability
          - `lstm_prob`: raw LSTM probability
          - `uncalibrated_ensemble`: raw weighted blend (0.6 XGBoost + 0.4 LSTM)
          - `calibrated_probability`: final calibrated ensemble probability
          - `calibration_method`: 'isotonic' or 'platt_sigmoid'
          - `inter_model_spread`: |xgb_prob - lstm_prob| (diagnostic spread, not confidence)
        """
        eval_reset = eval_df.reset_index(drop=True)
        lstm_dict = self.lstm_model.predict_proba_dict(continuous_df, eval_reset)
        results: Dict[str, Dict[str, Any]] = {}

        for h in FORECAST_HORIZONS:
            for target in CLASSIFICATION_TARGETS:
                key = f"{target}_{h}d"
                p_xgb = self.xgb_suite.predict_proba_matrix(eval_reset, target, h)
                p_lstm = lstm_dict.get(key, p_xgb)

                if self.lstm_model.is_trained:
                    raw_ens = self.w_xgb * p_xgb + self.w_lstm * p_lstm
                    spread = np.abs(p_xgb - p_lstm)
                else:
                    raw_ens = p_xgb
                    spread = np.zeros(len(p_xgb), dtype=float)

                cal_prob = self.calibrator_suite.calibrate(key, raw_ens)
                cal_method = self.calibrator_suite.methods.get(key, "isotonic")

                results[key] = {
                    "xgb_prob": p_xgb,
                    "lstm_prob": p_lstm,
                    "uncalibrated_ensemble": raw_ens,
                    "calibrated_probability": cal_prob,
                    "calibration_method": cal_method,
                    "inter_model_spread": spread,
                }
        return results
