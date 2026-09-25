"""
Multi-Horizon XGBoost Models & Feature Importance Extractor
(ml-service/app/models/xgboost_model.py)
"""

from typing import Dict, Any, List, Tuple
import joblib
import numpy as np
import pandas as pd
from xgboost import XGBClassifier, XGBRegressor

from app.config import ARTIFACTS_DIR, CLASSIFICATION_TARGETS, FORECAST_HORIZONS
from app.data.feature_engineering import FEATURE_COLUMNS

XGB_ARTIFACT_PATH = ARTIFACTS_DIR / "xgboost_models.joblib"


class MonsoonXGBoostSuite:
    def __init__(self) -> None:
        self.classifiers: Dict[str, XGBClassifier] = {}
        self.regressors: Dict[int, XGBRegressor] = {}
        self.residual_stds: Dict[int, float] = {}
        self.feature_importances: Dict[str, List[Dict[str, Any]]] = {}
        self.global_top_features: List[Dict[str, Any]] = []

    def fit(self, train_df: pd.DataFrame, val_df: pd.DataFrame) -> Dict[str, Any]:
        X_train = train_df[FEATURE_COLUMNS].values
        X_val = val_df[FEATURE_COLUMNS].values

        importance_accumulator = np.zeros(len(FEATURE_COLUMNS), dtype=float)
        trained_count = 0

        for h in FORECAST_HORIZONS:
            # 1. Train Classification Models per target & horizon
            for target in CLASSIFICATION_TARGETS:
                key = f"{target}_{h}d"
                col = f"target_{target}_{h}d"
                y_train = train_df[col].values.astype(int)
                y_val = val_df[col].values.astype(int)

                pos_count = int(np.sum(y_train == 1))
                neg_count = int(np.sum(y_train == 0))
                scale_pos_weight = float(neg_count / max(pos_count, 1))
                scale_pos_weight = float(np.clip(scale_pos_weight, 0.5, 12.0))

                clf = XGBClassifier(
                    n_estimators=120,
                    max_depth=4,
                    learning_rate=0.05,
                    subsample=0.85,
                    colsample_bytree=0.85,
                    scale_pos_weight=scale_pos_weight,
                    eval_metric="logloss",
                    random_state=42 + h,
                    n_jobs=2,
                )
                clf.fit(
                    X_train,
                    y_train,
                    eval_set=[(X_val, y_val)],
                    verbose=False,
                )
                self.classifiers[key] = clf

                imps = clf.feature_importances_
                importance_accumulator += imps
                trained_count += 1

                ranked_idx = np.argsort(imps)[::-1]
                self.feature_importances[key] = [
                    {
                        "feature": FEATURE_COLUMNS[idx],
                        "importance": round(float(imps[idx]), 4),
                    }
                    for idx in ranked_idx[:10]
                ]

            # 2. Train Rainfall Regressor for Horizon H
            reg_col = f"target_rainfall_mm_{h}d"
            y_reg_train = train_df[reg_col].values.astype(float)
            y_reg_val = val_df[reg_col].values.astype(float)

            reg = XGBRegressor(
                n_estimators=130,
                max_depth=4,
                learning_rate=0.05,
                subsample=0.85,
                colsample_bytree=0.85,
                random_state=100 + h,
                n_jobs=2,
            )
            reg.fit(
                X_train,
                y_reg_train,
                eval_set=[(X_val, y_reg_val)],
                verbose=False,
            )
            self.regressors[h] = reg

            val_preds = np.maximum(0.0, reg.predict(X_val))
            res_std = float(np.std(y_reg_val - val_preds))
            self.residual_stds[h] = round(max(res_std, 5.0), 2)

        if trained_count > 0:
            avg_imp = importance_accumulator / float(trained_count)
            top_idx = np.argsort(avg_imp)[::-1]
            self.global_top_features = [
                {
                    "feature": FEATURE_COLUMNS[i],
                    "importance": round(float(avg_imp[i]), 4),
                }
                for i in top_idx[:12]
            ]

        return {
            "models_trained": len(self.classifiers) + len(self.regressors),
            "global_top_features": self.global_top_features[:8],
        }

    def predict_proba_matrix(self, df: pd.DataFrame, target: str, horizon: int) -> np.ndarray:
        key = f"{target}_{horizon}d"
        clf = self.classifiers[key]
        X = df[FEATURE_COLUMNS].values
        probs = clf.predict_proba(X)[:, 1]
        return np.clip(probs, 1e-4, 1.0 - 1e-4)

    def predict_rainfall(self, df: pd.DataFrame, horizon: int) -> Tuple[np.ndarray, float]:
        reg = self.regressors[horizon]
        X = df[FEATURE_COLUMNS].values
        preds = np.maximum(0.0, reg.predict(X))
        std = self.residual_stds.get(horizon, 12.0)
        return preds, std

    def save(self, path=XGB_ARTIFACT_PATH) -> None:
        joblib.dump(
            {
                "classifiers": self.classifiers,
                "regressors": self.regressors,
                "residual_stds": self.residual_stds,
                "feature_importances": self.feature_importances,
                "global_top_features": self.global_top_features,
                "feature_columns": FEATURE_COLUMNS,
            },
            path,
        )

    @classmethod
    def load(cls, path=XGB_ARTIFACT_PATH) -> "MonsoonXGBoostSuite":
        data = joblib.load(path)
        inst = cls()
        inst.classifiers = data["classifiers"]
        inst.regressors = data["regressors"]
        inst.residual_stds = data["residual_stds"]
        inst.feature_importances = data["feature_importances"]
        inst.global_top_features = data["global_top_features"]
        return inst
