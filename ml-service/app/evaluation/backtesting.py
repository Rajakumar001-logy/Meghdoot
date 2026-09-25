"""
Expanding-Window Chronological Backtesting Engine (ml-service/app/evaluation/backtesting.py)

Requirement 32:
Implements expanding-window chronological backtesting across the historical record
without ever leaking future observations into earlier folds.
"""

from typing import Dict, Any, List
import numpy as np
import pandas as pd
from xgboost import XGBClassifier
from sklearn.metrics import brier_score_loss, roc_auc_score

from app.data.feature_engineering import FEATURE_COLUMNS


def run_expanding_window_backtest(
    df: pd.DataFrame,
    target: str = "false_onset",
    horizon: int = 14,
) -> List[Dict[str, Any]]:
    """
    Runs expanding-window backtesting across actual years present in `df`:
      Fold 1: Train [2019..2021] -> Test [2022]
      Fold 2: Train [2019..2022] -> Test [2023]
      Fold 3: Train [2019..2023] -> Test [2024..2025]
    """
    years = sorted(df["date"].dt.year.unique().tolist())
    if len(years) < 4:
        return []

    col = f"target_{target}_{horizon}d"
    folds_out: List[Dict[str, Any]] = []

    split_points = [2021, 2022, 2023]
    for train_max_yr in split_points:
        if train_max_yr not in years:
            continue
        train_sub = df[df["date"].dt.year <= train_max_yr]
        test_sub = (
            df[df["date"].dt.year == train_max_yr + 1]
            if train_max_yr < 2023
            else df[df["date"].dt.year >= 2024]
        )
        if len(train_sub) < 100 or len(test_sub) < 50:
            continue

        y_tr = train_sub[col].values.astype(int)
        y_te = test_sub[col].values.astype(int)

        if len(np.unique(y_tr)) < 2 or len(np.unique(y_te)) < 2:
            continue

        clf = XGBClassifier(
            n_estimators=80,
            max_depth=4,
            learning_rate=0.05,
            eval_metric="logloss",
            random_state=42,
            n_jobs=2,
        )
        clf.fit(train_sub[FEATURE_COLUMNS].values, y_tr, verbose=False)
        probs = clf.predict_proba(test_sub[FEATURE_COLUMNS].values)[:, 1]
        clim_prob = np.full(len(y_te), float(np.mean(y_tr)))

        brier_model = float(brier_score_loss(y_te, probs))
        brier_clim = float(brier_score_loss(y_te, clim_prob))
        roc = float(roc_auc_score(y_te, probs))

        folds_out.append(
            {
                "target": target,
                "horizon": f"{horizon}D",
                "train_years": f"{int(train_sub['date'].dt.year.min())}–{train_max_yr}",
                "test_years": (
                    str(train_max_yr + 1)
                    if train_max_yr < 2023
                    else f"2024–{int(test_sub['date'].dt.year.max())}"
                ),
                "train_samples": int(len(train_sub)),
                "test_samples": int(len(test_sub)),
                "model_brier": round(brier_model, 4),
                "climatology_brier": round(brier_clim, 4),
                "roc_auc": round(roc, 4),
            }
        )

    return folds_out
