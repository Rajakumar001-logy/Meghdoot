"""
Dataset Builder, Chronological Splitter & Data Sufficiency Auditor
(ml-service/app/data/dataset_builder.py)
"""

from typing import Dict, Any, Tuple
import numpy as np
import pandas as pd

from app.config import (
    CLASSIFICATION_TARGETS,
    DATA_CACHE_DIR,
    FORECAST_HORIZONS,
    LSTM_CONFIG,
    SPLIT_CONFIG,
)
from app.data.loader import fetch_or_load_historical_observations
from app.data.feature_engineering import (
    FEATURE_COLUMNS,
    engineer_features_for_block,
    verify_no_data_leakage,
)
from app.data.labels import compute_labels_for_block, get_label_documentation

PROCESSED_DATASET_PATH = DATA_CACHE_DIR / "monsoon_block_date_dataset.parquet.csv"


def check_data_sufficiency(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Requirement 30 & 31: Data Sufficiency Check before training.
    Inspects sample size, positive/negative events per target & horizon,
    missingness, historical coverage, and continuous sequence length.
    """
    total_samples = int(len(df))
    missing_pct = float(df[FEATURE_COLUMNS].isna().mean().mean() * 100.0)
    min_date = str(df["date"].min().date())
    max_date = str(df["date"].max().date())
    years_covered = sorted(df["date"].dt.year.unique().tolist())

    per_block_counts = df.groupby("location_id").size().to_dict()
    min_seq_len = int(min(per_block_counts.values())) if per_block_counts else 0
    lstm_seq_required = int(LSTM_CONFIG["SEQUENCE_LENGTH_DAYS"])
    lstm_sufficient = (
        total_samples >= int(LSTM_CONFIG["MIN_REQUIRED_SAMPLES"])
        and min_seq_len >= lstm_seq_required * 3
    )

    target_event_counts: Dict[str, Dict[str, int]] = {}
    for target in CLASSIFICATION_TARGETS:
        for h in FORECAST_HORIZONS:
            col = f"target_{target}_{h}d"
            if col in df.columns:
                pos = int((df[col] == 1).sum())
                neg = int((df[col] == 0).sum())
                target_event_counts[f"{target}_{h}d"] = {
                    "positive_events": pos,
                    "negative_events": neg,
                    "sufficient": pos >= 10 and neg >= 10,
                }

    return {
        "sufficient_for_xgboost": total_samples >= 200 and missing_pct < 5.0,
        "sufficient_for_lstm": lstm_sufficient,
        "lstm_status_message": (
            "Sufficient historical sequence length for LSTM training."
            if lstm_sufficient
            else "Insufficient historical sequence length for LSTM training."
        ),
        "total_samples": total_samples,
        "missing_data_pct": round(missing_pct, 3),
        "historical_start": min_date,
        "historical_end": max_date,
        "years_covered": years_covered,
        "min_block_sequence_days": min_seq_len,
        "target_event_counts": target_event_counts,
        "prototype_limitation_notice": (
            "Prototype model — limited historical training data (2019–2025 ERA5 & NOAA "
            "block-level archive). Ready to ingest multi-decadal station records."
        ),
    }


def build_training_dataset(force_rebuild: bool = False) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Builds the complete Block x Date dataset from historical observations,
    runs the mathematical data-leakage audit, filters to the extended agricultural
    monsoon window (April 15 – November 15) after computing 30-day causal lags and
    future labels on the continuous daily record, and returns `(dataset_df, report)`.
    """
    raw_df, loader_meta = fetch_or_load_historical_observations(force_refresh=force_rebuild)

    # 1. Verify zero data leakage on raw_df -> feature_engineering
    leakage_free = verify_no_data_leakage(raw_df)
    if not leakage_free:
        raise RuntimeError("CRITICAL: Data leakage detected in feature engineering pipeline!")

    # 2. Compute causal features (t <= T) and future target labels (T+1 ... T+H) per block
    block_datasets = []
    for _, b_group in raw_df.groupby("location_id", sort=False):
        feat_df = engineer_features_for_block(b_group)
        labeled_df = compute_labels_for_block(feat_df)
        # Keep warmup > 30 days from start of record and filter to active Kharif/Monsoon window (Months 5..10)
        labeled_df = labeled_df.iloc[30:].copy()
        active_season = labeled_df[labeled_df["date"].dt.month.isin([5, 6, 7, 8, 9, 10])].copy()
        block_datasets.append(active_season)

    full_dataset = pd.concat(block_datasets, ignore_index=True)
    # Chronological order across all samples
    full_dataset.sort_values(["date", "location_id"], inplace=True)
    full_dataset.reset_index(drop=True, inplace=True)

    full_dataset.to_csv(PROCESSED_DATASET_PATH, index=False)

    sufficiency = check_data_sufficiency(full_dataset)
    report = {
        "loader_meta": loader_meta,
        "leakage_audit_passed": leakage_free,
        "label_definitions": get_label_documentation(),
        "sufficiency": sufficiency,
    }
    return full_dataset, report


def get_chronological_splits(
    df: pd.DataFrame,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, Dict[str, Any]]:
    """
    Splits the dataset strictly chronologically without random shuffling (Requirement 5 & 20):
    - Train: years <= 2022 (2019–2022)
    - Validation / Calibration: year == 2023 (2023)
    - Held-out Test: years >= 2024 (2024–2025)
    """
    years = df["date"].dt.year
    train_end_yr = int(SPLIT_CONFIG["TRAIN_END_YEAR"])
    val_yr = int(SPLIT_CONFIG["VAL_YEAR"])
    test_start_yr = int(SPLIT_CONFIG["TEST_START_YEAR"])

    train_df = df[years <= train_end_yr].copy()
    val_df = df[years == val_yr].copy()
    test_df = df[years >= test_start_yr].copy()

    # Verify strict temporal separation: max(train.date) < min(val.date) < min(test.date)
    assert train_df["date"].max() < val_df["date"].min(), "Chronological violation between Train and Validation!"
    assert val_df["date"].max() < test_df["date"].min(), "Chronological violation between Validation and Test!"

    split_meta = {
        "train_period": f"{train_df['date'].min().date()} to {train_df['date'].max().date()}",
        "train_years": f"{int(train_df['date'].dt.year.min())}–{int(train_df['date'].dt.year.max())}",
        "train_samples": int(len(train_df)),
        "val_period": f"{val_df['date'].min().date()} to {val_df['date'].max().date()}",
        "val_samples": int(len(val_df)),
        "test_period": f"{test_df['date'].min().date()} to {test_df['date'].max().date()}",
        "test_samples": int(len(test_df)),
    }
    return train_df, val_df, test_df, split_meta
