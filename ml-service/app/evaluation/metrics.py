"""
Held-Out Evaluation Metrics, Reliability Curves, Expected Calibration Error (ECE),
Target Prevalence & Climatology/Persistence Baselines
(ml-service/app/evaluation/metrics.py)

Prompt 6 Requirements 5, 7, 8:
- Classification: Brier Score, Log Loss, ROC-AUC, PR-AUC, Expected Calibration Error (ECE), Precision, Recall, F1
- Target Prevalence: positive_samples, negative_samples, positive_rate
- Probability Quality: Reliability diagram / Calibration curve bins
- Rainfall Regression: MAE, RMSE, Bias vs Climatology & Persistence
- Never hardcode scores; if test positives < 5, report "Insufficient test samples".
"""

from typing import Dict, Any, List
import numpy as np
from sklearn.metrics import (
    roc_auc_score,
    average_precision_score,
    brier_score_loss,
    log_loss,
    precision_score,
    recall_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
)
from sklearn.calibration import calibration_curve


def compute_expected_calibration_error(
    y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 10
) -> float:
    """
    Computes Expected Calibration Error (ECE) across uniform probability bins [0, 1].
    ECE = sum_{b=1..B} (|I_b| / N) * |acc(I_b) - conf(I_b)|
    """
    if len(y_true) == 0:
        return 0.0
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    bin_indices = np.digitize(y_prob, bins[1:-1], right=True)
    ece = 0.0
    n_total = float(len(y_true))
    for b in range(n_bins):
        mask = bin_indices == b
        count = int(np.sum(mask))
        if count > 0:
            avg_prob = float(np.mean(y_prob[mask]))
            avg_true = float(np.mean(y_true[mask]))
            ece += (count / n_total) * abs(avg_true - avg_prob)
    return round(float(ece), 4)


def compute_reliability_curve(
    y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 5
) -> List[Dict[str, float]]:
    """
    Computes reliability diagram bins (mean predicted probability vs empirical frequency).
    """
    if len(np.unique(y_true)) < 2 or len(y_true) < 20:
        return []
    try:
        prob_true, prob_pred = calibration_curve(
            y_true, y_prob, n_bins=n_bins, strategy="uniform"
        )
        return [
            {
                "bin_predicted": round(float(pp), 3),
                "bin_observed": round(float(pt), 3),
            }
            for pp, pt in zip(prob_pred, prob_true)
        ]
    except Exception:
        return []


def compute_target_prevalence(y_true: np.ndarray) -> Dict[str, Any]:
    """
    Requirement 7: Target Prevalence & Class Imbalance Reporting.
    """
    n_total = int(len(y_true))
    n_pos = int(np.sum(y_true == 1))
    n_neg = int(np.sum(y_true == 0))
    pos_rate = round(float(n_pos / max(n_total, 1)), 4)
    return {
        "total_samples": n_total,
        "positive_samples": n_pos,
        "negative_samples": n_neg,
        "positive_rate": pos_rate,
    }


def evaluate_binary_predictions(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    model_name: str,
    target: str,
    horizon: int,
    calibration_status: str = "calibrated",
) -> Dict[str, Any]:
    """
    Computes all required classification & probability quality metrics on held-out test data.
    If positive or negative sample count in test set < 5, explicitly returns
    `status = "Insufficient test samples"` instead of inventing a score.
    """
    prevalence = compute_target_prevalence(y_true)
    n_total = prevalence["total_samples"]
    n_pos = prevalence["positive_samples"]
    n_neg = prevalence["negative_samples"]
    pos_rate = prevalence["positive_rate"]

    if n_pos < 5 or n_neg < 5:
        return {
            "model": model_name,
            "target": target,
            "horizon": f"{horizon}D",
            "status": "Insufficient test samples",
            "test_samples": n_total,
            "positive_events": n_pos,
            "positive_samples": n_pos,
            "negative_samples": n_neg,
            "positive_rate": pos_rate,
            "brier_score": None,
            "roc_auc": None,
            "pr_auc": None,
            "log_loss": None,
            "expected_calibration_error": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "calibration_status": calibration_status,
            "reliability_curve": [],
        }

    probs = np.clip(y_prob, 1e-4, 1.0 - 1e-4)
    preds = (probs >= 0.5).astype(int)

    brier = float(brier_score_loss(y_true, probs))
    roc = float(roc_auc_score(y_true, probs))
    pr_auc = float(average_precision_score(y_true, probs))
    ll = float(log_loss(y_true, probs, labels=[0, 1]))
    ece = compute_expected_calibration_error(y_true, probs)
    prec = float(precision_score(y_true, preds, zero_division=0))
    rec = float(recall_score(y_true, preds, zero_division=0))
    f1 = float(f1_score(y_true, preds, zero_division=0))

    return {
        "model": model_name,
        "target": target,
        "horizon": f"{horizon}D",
        "status": "Evaluated on held-out test split",
        "test_samples": n_total,
        "positive_events": n_pos,
        "positive_samples": n_pos,
        "negative_samples": n_neg,
        "positive_rate": pos_rate,
        "brier_score": round(brier, 4),
        "roc_auc": round(roc, 4),
        "pr_auc": round(pr_auc, 4),
        "log_loss": round(ll, 4),
        "expected_calibration_error": round(ece, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "calibration_status": calibration_status,
        "reliability_curve": compute_reliability_curve(y_true, probs),
    }


def evaluate_rainfall_regression(
    y_true_mm: np.ndarray,
    y_pred_mm: np.ndarray,
    clim_mm: np.ndarray,
    pers_mm: np.ndarray,
    horizon: int,
) -> Dict[str, Any]:
    """
    Computes MAE, RMSE, and Bias for XGBoost Rainfall Regression vs Climatology & Persistence baselines.
    """
    mae = float(mean_absolute_error(y_true_mm, y_pred_mm))
    rmse = float(np.sqrt(mean_squared_error(y_true_mm, y_pred_mm)))
    bias = float(np.mean(y_pred_mm - y_true_mm))

    clim_mae = float(mean_absolute_error(y_true_mm, clim_mm))
    clim_rmse = float(np.sqrt(mean_squared_error(y_true_mm, clim_mm)))

    pers_mae = float(mean_absolute_error(y_true_mm, pers_mm))
    pers_rmse = float(np.sqrt(mean_squared_error(y_true_mm, pers_mm)))

    return {
        "horizon": f"{horizon}D",
        "test_samples": int(len(y_true_mm)),
        "mae_mm": round(mae, 2),
        "rmse_mm": round(rmse, 2),
        "bias_mm": round(bias, 2),
        "climatology_mae_mm": round(clim_mae, 2),
        "climatology_rmse_mm": round(clim_rmse, 2),
        "persistence_mae_mm": round(pers_mae, 2),
        "persistence_rmse_mm": round(pers_rmse, 2),
        "beats_climatology": bool(rmse < clim_rmse),
    }
