"""
CLI Script 3: Train Temporal LSTM Sequence Model (if sufficient historical sequence data exists)
(ml-service/scripts/train_lstm.py)
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.loader import fetch_or_load_historical_observations
from app.data.feature_engineering import build_all_features
from app.data.dataset_builder import build_training_dataset, get_chronological_splits
from app.models.lstm_model import MonsoonLSTMModel


def main():
    print("=== [3/5] Training Temporal Sequence LSTM Model ===")
    raw_df, _ = fetch_or_load_historical_observations()
    continuous_feat_df = build_all_features(raw_df)
    df, report = build_training_dataset(force_rebuild=False)

    if not report["sufficiency"]["sufficient_for_lstm"]:
        print("Insufficient historical sequence length for LSTM training.")
        lstm = MonsoonLSTMModel()
        lstm.is_trained = False
        lstm.status_message = "Insufficient historical sequence length for LSTM training."
        lstm.save()
        return

    train_df, val_df, _, _ = get_chronological_splits(df)
    lstm = MonsoonLSTMModel()
    summary = lstm.fit(continuous_feat_df, train_df, val_df)
    lstm.save()
    print(summary["message"])


if __name__ == "__main__":
    main()
