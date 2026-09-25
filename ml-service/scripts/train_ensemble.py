"""
CLI Script 4: Fit Hybrid Weighted Ensemble & Probability Calibrators
(ml-service/scripts/train_ensemble.py)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.loader import fetch_or_load_historical_observations
from app.data.feature_engineering import build_all_features
from app.data.dataset_builder import build_training_dataset, get_chronological_splits
from app.models.xgboost_model import MonsoonXGBoostSuite
from app.models.lstm_model import MonsoonLSTMModel
from app.models.calibration import ProbabilityCalibratorSuite
from app.models.ensemble import MonsoonHybridEnsemble


def main():
    print("=== [4/5] Fitting Weighted Ensemble & Platt/Isotonic Probability Calibration ===")
    raw_df, _ = fetch_or_load_historical_observations()
    continuous_feat_df = build_all_features(raw_df)
    df, _ = build_training_dataset(force_rebuild=False)
    _, val_df, _, _ = get_chronological_splits(df)

    xgb_suite = MonsoonXGBoostSuite.load()
    lstm_model = MonsoonLSTMModel.load()
    calibrators = ProbabilityCalibratorSuite()

    ensemble = MonsoonHybridEnsemble(xgb_suite, lstm_model, calibrators)
    methods = ensemble.fit_calibration(continuous_feat_df, val_df)
    calibrators.save()

    print("Calibration methods fitted on Validation Split (2023):")
    for k, m in list(methods.items())[:8]:
        print(f"  - {k}: {m}")


if __name__ == "__main__":
    main()
