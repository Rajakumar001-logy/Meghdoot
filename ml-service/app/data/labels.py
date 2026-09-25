"""
Configurable Operational Target Label Definitions (ml-service/app/data/labels.py)

Constructs future target variables over windows T+1 ... T+H for H in {7, 14, 21, 30}:
- Target A: Monsoon Onset ("Prototype operational definition — requires validation against official/local onset datasets.")
- Target B: False Onset (Significant wet burst followed by prolonged dry spell >= FALSE_ONSET_MIN_DRY_DAYS)
- Target C: Break-Monsoon / Prolonged Dry Spell (Extended dry spell >= BREAK_MIN_DRY_DAYS)
- Target D: Heavy Rainfall (Official IMD threshold >= 64.5 mm/day; preserves Very Heavy >= 115.6 and Extremely Heavy >= 204.5)
- Regression Targets: Expected cumulative rainfall (mm) & rainfall anomaly (%) over T+1 ... T+H.
"""

from typing import Dict, Any, List
import numpy as np
import pandas as pd

from app.config import (
    FORECAST_HORIZONS,
    ONSET_CONFIG,
    FALSE_ONSET_CONFIG,
    BREAK_MONSOON_CONFIG,
    HEAVY_RAIN_CONFIG,
)


def get_label_documentation() -> Dict[str, Any]:
    """
    Returns exact parameters and scientific disclaimers used to generate labels.
    """
    return {
        "onset": ONSET_CONFIG,
        "false_onset": FALSE_ONSET_CONFIG,
        "dry_spell": BREAK_MONSOON_CONFIG,
        "heavy_rain": HEAVY_RAIN_CONFIG,
    }


def _max_consecutive_ones(binary_arr: np.ndarray) -> int:
    """Returns the length of the longest contiguous run of 1s in a 1D binary array."""
    if len(binary_arr) == 0:
        return 0
    max_run = 0
    cur = 0
    for val in binary_arr:
        if val:
            cur += 1
            if cur > max_run:
                max_run = cur
        else:
            cur = 0
    return max_run


def compute_labels_for_block(
    bdf: pd.DataFrame,
    horizons: List[int] = FORECAST_HORIZONS,
) -> pd.DataFrame:
    """
    Computes multi-horizon binary classification labels and continuous rainfall targets
    for a single location block DataFrame sorted chronologically by `date`.
    Only uses future observations (T+1 ... T+H) to construct labels; drops tail rows
    where T+30 exceeds the end of the historical record.
    """
    df = bdf.sort_values("date").reset_index(drop=True).copy()
    rain = df["rainfall_mm"].values
    normal_daily = df["normal_daily_rain_mm"].values
    n = len(df)
    max_lookahead = max(horizons) + 10

    onset_thresh = float(ONSET_CONFIG["ONSET_RAIN_THRESHOLD_MM"])
    onset_win = int(ONSET_CONFIG["ONSET_WINDOW_DAYS"])
    onset_cum_mm = float(ONSET_CONFIG["ONSET_CUMULATIVE_RAIN_MM"])
    max_allowed_dry = int(ONSET_CONFIG["MAX_ALLOWED_DRY_DAYS"])

    fo_wet_days = int(FALSE_ONSET_CONFIG["INITIAL_WET_WINDOW_DAYS"])
    fo_wet_mm = float(FALSE_ONSET_CONFIG["INITIAL_WET_MIN_RAIN_MM"])
    fo_min_dry = int(FALSE_ONSET_CONFIG["FALSE_ONSET_MIN_DRY_DAYS"])
    dry_thresh = float(BREAK_MONSOON_CONFIG["DRY_DAY_THRESHOLD_MM"])
    break_min_dry = int(BREAK_MONSOON_CONFIG["BREAK_MIN_DRY_DAYS"])

    heavy_thresh = float(HEAVY_RAIN_CONFIG["HEAVY_RAIN_THRESHOLD_MM"])
    very_heavy_thresh = float(HEAVY_RAIN_CONFIG["VERY_HEAVY_RAIN_THRESHOLD_MM"])
    extremely_heavy_thresh = float(HEAVY_RAIN_CONFIG["EXTREMELY_HEAVY_RAIN_THRESHOLD_MM"])

    for h in horizons:
        onset_col = np.zeros(n, dtype=int)
        false_onset_col = np.zeros(n, dtype=int)
        break_col = np.zeros(n, dtype=int)
        heavy_col = np.zeros(n, dtype=int)
        imd_cat_col = np.zeros(n, dtype=int)
        cum_rain_col = np.zeros(n, dtype=float)
        anom_col = np.zeros(n, dtype=float)

        for i in range(n - max_lookahead):
            future_slice = rain[i + 1 : i + 1 + h]
            extended_slice = rain[i + 1 : i + 1 + h + fo_min_dry]

            # Regression targets over T+1 ... T+h
            cum_mm = float(np.sum(future_slice))
            norm_mm = float(normal_daily[i] * h)
            cum_rain_col[i] = round(cum_mm, 2)
            anom_col[i] = round(((cum_mm - norm_mm) / max(norm_mm, 1.0)) * 100.0, 2)

            # Target D: Official IMD Heavy Rainfall (>= 64.5 mm/day)
            max_daily = float(np.max(future_slice))
            if max_daily >= heavy_thresh:
                heavy_col[i] = 1
            if max_daily >= extremely_heavy_thresh:
                imd_cat_col[i] = 3
            elif max_daily >= very_heavy_thresh:
                imd_cat_col[i] = 2
            elif max_daily >= heavy_thresh:
                imd_cat_col[i] = 1

            # Target C: Break-Monsoon / Prolonged Dry Spell
            # For 7D horizon, a 6-7 day contiguous dry stretch inside T+1..T+7 counts as prolonged break
            effective_break_days = min(break_min_dry, h - 1) if h <= 7 else break_min_dry
            dry_flags = (future_slice < dry_thresh).astype(int)
            if _max_consecutive_ones(dry_flags) >= effective_break_days:
                break_col[i] = 1

            # Target A: Prototype Monsoon Onset
            # Sustained wet condition event within T+1..T+h followed by continued moisture
            has_sustained_onset = 0
            for w_start in range(max(1, len(future_slice) - onset_win + 1)):
                sub_win = extended_slice[w_start : w_start + onset_win]
                follow_win = extended_slice[w_start + onset_win : w_start + onset_win + 5]
                if (
                    np.sum(sub_win) >= onset_cum_mm
                    and np.sum(sub_win >= onset_thresh) >= 2
                    and np.sum(follow_win < dry_thresh) <= max_allowed_dry + 1
                ):
                    has_sustained_onset = 1
                    break
            onset_col[i] = has_sustained_onset

            # Target B: False Onset
            # Initial wet burst (>= fo_wet_mm over fo_wet_days) followed by prolonged dry spell (>= fo_min_dry days)
            has_false_onset = 0
            for w_start in range(max(1, len(future_slice) - fo_wet_days + 1)):
                burst = extended_slice[w_start : w_start + fo_wet_days]
                after_burst = extended_slice[w_start + fo_wet_days : w_start + fo_wet_days + fo_min_dry]
                if (
                    np.sum(burst) >= fo_wet_mm
                    and len(after_burst) >= fo_min_dry
                    and np.sum(after_burst < dry_thresh) >= (fo_min_dry - 1)
                ):
                    has_false_onset = 1
                    break
            false_onset_col[i] = has_false_onset

        df[f"target_onset_{h}d"] = onset_col
        df[f"target_false_onset_{h}d"] = false_onset_col
        df[f"target_dry_spell_{h}d"] = break_col
        df[f"target_heavy_rain_{h}d"] = heavy_col
        df[f"imd_heavy_category_{h}d"] = imd_cat_col
        df[f"target_rainfall_mm_{h}d"] = cum_rain_col
        df[f"target_anomaly_pct_{h}d"] = anom_col

    # Trim tail rows where full lookahead window was not available
    valid_df = df.iloc[: n - max_lookahead].copy()
    return valid_df
