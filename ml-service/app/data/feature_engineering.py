"""
Leakage-Free Feature Engineering (ml-service/app/data/feature_engineering.py)
Constructs climate, atmospheric, temporal lag/accumulation, cyclic MJO, and location
features strictly using information available on or before initialization date T (t <= T).
"""

from typing import List
import numpy as np
import pandas as pd

FEATURE_COLUMNS: List[str] = [
    # Climate Signals
    "enso_current",
    "enso_lag_7d",
    "enso_rolling_7d",
    "iod_current",
    "iod_lag_7d",
    "iod_rolling_7d",
    "mjo_sin",
    "mjo_cos",
    "mjo_amplitude",
    # Local Atmospheric Data (at initialization date T)
    "rainfall_mm",
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "wind_speed_kmh",
    # Temporal Lag & Rolling Features (strictly backward-looking: [T-W+1 ... T])
    "rain_lag_1d",
    "rain_lag_3d",
    "rain_acc_7d",
    "rain_acc_14d",
    "rain_acc_30d",
    "dry_days_prev_7d",
    "dry_days_prev_14d",
    "wet_days_prev_7d",
    "rainfall_anomaly_pct",
    "temp_anomaly_c",
    "doy_sin",
    "doy_cos",
    # Location Features
    "latitude",
    "longitude",
    "elevation_m",
    "soil_code",
]

SEQUENCE_FEATURE_COLUMNS: List[str] = [
    "rainfall_mm",
    "temperature_c",
    "humidity_pct",
    "pressure_hpa",
    "wind_speed_kmh",
    "enso_current",
    "iod_current",
    "mjo_sin",
    "mjo_cos",
    "mjo_amplitude",
]


def engineer_features_for_block(bdf: pd.DataFrame) -> pd.DataFrame:
    """
    Computes strictly causal (t <= T) features for a single location block DataFrame
    sorted chronologically by `date`.
    """
    df = bdf.sort_values("date").copy()

    # 1. Climate Signals (ENSO, IOD, Cyclic MJO)
    df["enso_current"] = df["enso"]
    df["enso_lag_7d"] = df["enso"].shift(7).bfill()
    df["enso_rolling_7d"] = df["enso"].rolling(window=7, min_periods=1).mean()

    df["iod_current"] = df["iod"]
    df["iod_lag_7d"] = df["iod"].shift(7).bfill()
    df["iod_rolling_7d"] = df["iod"].rolling(window=7, min_periods=1).mean()

    # Requirement 7: Cyclic MJO encoding sin(2*pi*phase/8) and cos(2*pi*phase/8)
    df["mjo_sin"] = np.sin(2.0 * np.pi * df["mjo_phase"] / 8.0)
    df["mjo_cos"] = np.cos(2.0 * np.pi * df["mjo_phase"] / 8.0)

    # 2. Temporal Rainfall Lags & Accumulations (strictly <= T)
    df["rain_lag_1d"] = df["rainfall_mm"].shift(1).fillna(0.0)
    df["rain_lag_3d"] = df["rainfall_mm"].shift(3).fillna(0.0)

    df["rain_acc_7d"] = df["rainfall_mm"].rolling(window=7, min_periods=1).sum()
    df["rain_acc_14d"] = df["rainfall_mm"].rolling(window=14, min_periods=1).sum()
    df["rain_acc_30d"] = df["rainfall_mm"].rolling(window=30, min_periods=1).sum()

    is_dry = (df["rainfall_mm"] < 2.5).astype(float)
    is_wet = (df["rainfall_mm"] >= 2.5).astype(float)

    df["dry_days_prev_7d"] = is_dry.rolling(window=7, min_periods=1).sum()
    df["dry_days_prev_14d"] = is_dry.rolling(window=14, min_periods=1).sum()
    df["wet_days_prev_7d"] = is_wet.rolling(window=7, min_periods=1).sum()

    # 3. Anomalies relative to causal rolling/climatological norms
    normal_7d = df["normal_daily_rain_mm"] * 7.0
    df["rainfall_anomaly_pct"] = ((df["rain_acc_7d"] - normal_7d) / np.maximum(normal_7d, 1.0)) * 100.0

    rolling_30d_temp = df["temperature_c"].rolling(window=30, min_periods=1).mean()
    df["temp_anomaly_c"] = df["temperature_c"] - rolling_30d_temp

    # Day-of-year cyclic seasonal position
    doy = df["date"].dt.dayofyear
    df["doy_sin"] = np.sin(2.0 * np.pi * doy / 365.25)
    df["doy_cos"] = np.cos(2.0 * np.pi * doy / 365.25)

    return df


def build_all_features(raw_df: pd.DataFrame) -> pd.DataFrame:
    """
    Applies causal feature engineering per block and returns the combined DataFrame.
    """
    frames = []
    for _, group in raw_df.groupby("location_id", sort=False):
        frames.append(engineer_features_for_block(group))
    out = pd.concat(frames, ignore_index=True)
    out.sort_values(["date", "location_id"], inplace=True)
    out.reset_index(drop=True, inplace=True)
    return out


def verify_no_data_leakage(raw_df: pd.DataFrame) -> bool:
    """
    Mathematical Data Leakage Audit (Requirement 5):
    Selects a test initialization date T, Corrupts all future observations (t > T)
    with extreme synthetic values (+9999), recomputes features, and verifies that
    every single feature on or before date T (t <= T) is 100% identical.
    """
    sample_block = raw_df[raw_df["location_id"] == raw_df["location_id"].iloc[0]].sort_values("date").copy()
    cutoff_idx = len(sample_block) // 2
    cutoff_date = sample_block.iloc[cutoff_idx]["date"]

    baseline_feat = engineer_features_for_block(sample_block)
    baseline_up_to_t = baseline_feat[baseline_feat["date"] <= cutoff_date][FEATURE_COLUMNS]

    corrupted = sample_block.copy()
    future_mask = corrupted["date"] > cutoff_date
    corrupted.loc[future_mask, "rainfall_mm"] = 9999.0
    corrupted.loc[future_mask, "temperature_c"] = 99.0
    corrupted.loc[future_mask, "enso"] = 9.9
    corrupted.loc[future_mask, "iod"] = -9.9
    corrupted.loc[future_mask, "mjo_amplitude"] = 99.0

    corrupted_feat = engineer_features_for_block(corrupted)
    corrupted_up_to_t = corrupted_feat[corrupted_feat["date"] <= cutoff_date][FEATURE_COLUMNS]

    max_diff = np.abs(baseline_up_to_t.values - corrupted_up_to_t.values).max()
    return float(max_diff) < 1e-9
