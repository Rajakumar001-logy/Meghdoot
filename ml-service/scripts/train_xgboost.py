"""
CLI Script 2: Train Multi-Horizon XGBoost Models & Extract Feature Importances
(ml-service/scripts/train_xgboost.py)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.dataset_builder import build_training_dataset, get_chronological_splits
from app.models.xgboost_model import MonsoonXGBoostSuite


def main():
    print("=== [2/5] Training Multi-Horizon XGBoost Classifiers & Regressors ===")
    df, report = build_training_dataset(force_rebuild=False)
    if not report["sufficiency"]["sufficient_for_xgboost"]:
        raise RuntimeError("Insufficient historical samples for XGBoost training.")

    train_df, val_df, _, _ = get_chronological_splits(df)
    xgb_suite = MonsoonXGBoostSuite()
    summary = xgb_suite.fit(train_df, val_df)
    xgb_suite.save()

    print(f"Trained {summary['models_trained']} XGBoost models.")
    print("Top Physical & Climate Features:")
    for feat in summary["global_top_features"][:5]:
        print(f"  - {feat['feature']}: {feat['importance']:.4f}")


if __name__ == "__main__":
    main()
