"""
Lightweight Seasonally-Adjusted Feature Drift Monitor
(ml-service/app/evaluation/drift_monitor.py)

Prompt 6 Requirement 12:
Compares recent inference features against the 2019–2022 training distribution
matched by seasonal calendar month (excluding deterministic calendar encodings
`sin_doy`, `cos_doy` so seasonality is not conflated with climate drift):
  - mean_shift (z-score units)
  - std_shift (ratio of recent std to training std)
  - missingness_change
  - Population Stability Index (PSI)
Classifies drift into:
  - NORMAL (PSI < 0.10)
  - WARNING (0.10 <= PSI < 0.25)
  - HIGH DRIFT (PSI >= 0.25)
Does NOT block inference when drift exists; exposes drift status as model health telemetry.
"""

from typing import Dict, Any, List
import joblib
import numpy as np
import pandas as pd

from app.config import ARTIFACTS_DIR
from app.data.feature_engineering import FEATURE_COLUMNS

DRIFT_REF_PATH = ARTIFACTS_DIR / "training_drift_reference.joblib"
METEOROLOGICAL_DRIFT_FEATURES = [
    c for c in FEATURE_COLUMNS if c not in ("sin_doy", "cos_doy")
]


def _compute_psi(train_col: np.ndarray, recent_col: np.ndarray, n_bins: int = 5) -> float:
    """
    Computes Population Stability Index (PSI) between training reference distribution
    and recent observation distribution using Laplace-smoothed quantile bins.
    """
    clean_train = train_col[~np.isnan(train_col)]
    clean_recent = recent_col[~np.isnan(recent_col)]
    if len(clean_train) < 20 or len(clean_recent) < 5:
        return 0.0

    quantiles = np.linspace(0, 100, n_bins + 1)
    bin_edges = np.unique(np.percentile(clean_train, quantiles))
    if len(bin_edges) < 3:
        return 0.0

    bin_edges[0] = -np.inf
    bin_edges[-1] = np.inf

    train_counts, _ = np.histogram(clean_train, bins=bin_edges)
    recent_counts, _ = np.histogram(clean_recent, bins=bin_edges)

    # Laplace smoothing (+0.5 pseudocount per bin) prevents finite-sample zero-bin artifacts on 30-day windows
    n_b = float(len(train_counts))
    p_train = (train_counts + 0.5) / (float(len(clean_train)) + 0.5 * n_b)
    p_recent = (recent_counts + 0.5) / (float(len(clean_recent)) + 0.5 * n_b)

    psi_val = float(np.sum((p_recent - p_train) * np.log(p_recent / p_train)))
    return round(max(0.0, psi_val), 4)


def fit_and_save_drift_reference(train_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Computes and saves reference distribution statistics strictly from `train_df` (2019–2022),
    both globally and indexed by calendar month for seasonally-matched drift comparison.
    """
    df_copy = train_df.copy()
    df_copy["_month"] = pd.to_datetime(df_copy["date"]).dt.month

    ref_stats: Dict[str, Dict[str, Any]] = {}
    for col in METEOROLOGICAL_DRIFT_FEATURES:
        vals = df_copy[col].values.astype(float)
        missing_rate = float(np.isnan(vals).mean())
        clean = vals[~np.isnan(vals)]

        by_month: Dict[int, Dict[str, Any]] = {}
        for m, grp in df_copy.groupby("_month"):
            m_vals = grp[col].values.astype(float)
            m_clean = m_vals[~np.isnan(m_vals)]
            if len(m_clean) > 0:
                by_month[int(m)] = {
                    "mean": float(np.mean(m_clean)),
                    "std": float(max(np.std(m_clean), 1e-4)),
                    "sample_values": m_clean[::2].copy(),
                }

        ref_stats[col] = {
            "mean": float(np.mean(clean)) if len(clean) > 0 else 0.0,
            "std": float(max(np.std(clean), 1e-4)) if len(clean) > 0 else 1.0,
            "missing_rate": missing_rate,
            "sample_values": clean[::5].copy(),
            "by_month": by_month,
        }

    joblib.dump(ref_stats, DRIFT_REF_PATH)
    return {
        "training_years": "2019–2022",
        "training_samples": int(len(train_df)),
        "features_tracked": len(ref_stats),
        "reference_samples": int(len(train_df)),
    }


def evaluate_feature_drift(recent_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Evaluates feature drift on a recent observation window against the saved 2019–2022
    training reference distribution matched to the same seasonal month(s).
    """
    if not DRIFT_REF_PATH.exists():
        return {
            "overall_status": "NORMAL",
            "mean_psi": 0.0,
            "max_psi": 0.0,
            "features": [],
            "note": "Drift reference baseline not yet generated.",
        }

    ref_stats = joblib.load(DRIFT_REF_PATH)
    feature_reports: List[Dict[str, Any]] = []
    psi_list: List[float] = []

    recent_months: List[int] = []
    if "date" in recent_df.columns:
        recent_months = sorted(
            pd.to_datetime(recent_df["date"]).dt.month.unique().tolist()
        )

    for col in METEOROLOGICAL_DRIFT_FEATURES:
        if col not in recent_df.columns or col not in ref_stats:
            continue
        r_vals = recent_df[col].values.astype(float)
        r_missing = float(np.isnan(r_vals).mean())
        r_clean = r_vals[~np.isnan(r_vals)]

        col_ref = ref_stats[col]
        by_month = col_ref.get("by_month", {})
        matched_samples = [
            by_month[m]["sample_values"] for m in recent_months if m in by_month
        ]
        if matched_samples:
            t_samples = np.concatenate(matched_samples)
            t_mean = float(np.mean(t_samples))
            t_std = float(max(np.std(t_samples), 1e-4))
        else:
            t_mean = float(col_ref["mean"])
            t_std = float(col_ref["std"])
            t_samples = np.array(col_ref["sample_values"], dtype=float)

        t_missing = float(col_ref["missing_rate"])
        r_mean = float(np.mean(r_clean)) if len(r_clean) > 0 else t_mean
        r_std = float(np.std(r_clean)) if len(r_clean) > 1 else t_std

        mean_shift_z = round(abs(r_mean - t_mean) / max(t_std, 1e-4), 3)
        std_shift_ratio = round(r_std / max(t_std, 1e-4), 3)
        missing_change = round(r_missing - t_missing, 4)
        psi = _compute_psi(t_samples, r_clean)
        psi_list.append(psi)

        if psi >= 0.25 or mean_shift_z >= 2.5 or abs(missing_change) > 0.05:
            f_status = "HIGH DRIFT"
        elif psi >= 0.10 or mean_shift_z >= 1.5:
            f_status = "WARNING"
        else:
            f_status = "NORMAL"

        feature_reports.append(
            {
                "feature": col,
                "train_mean": round(t_mean, 3),
                "recent_mean": round(r_mean, 3),
                "mean_shift_z": mean_shift_z,
                "std_shift_ratio": std_shift_ratio,
                "missingness_change": missing_change,
                "psi": psi,
                "status": f_status,
            }
        )

    mean_psi = round(float(np.mean(psi_list)) if psi_list else 0.0, 4)
    max_psi = round(float(np.max(psi_list)) if psi_list else 0.0, 4)

    if mean_psi >= 0.25:
        overall_status = "HIGH DRIFT"
    elif mean_psi >= 0.10:
        overall_status = "WARNING"
    else:
        overall_status = "NORMAL"

    feature_reports.sort(key=lambda x: x["psi"], reverse=True)

    return {
        "overall_status": overall_status,
        "mean_psi": mean_psi,
        "max_psi": max_psi,
        "evaluated_rows": int(len(recent_df)),
        "top_drifted_features": feature_reports[:8],
        "all_features": feature_reports,
    }
