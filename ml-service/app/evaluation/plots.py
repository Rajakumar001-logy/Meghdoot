"""
Diagnostic Plots Generator (ml-service/app/evaluation/plots.py)
Saves reliability diagram and top feature importance charts to ml-service/artifacts/.
"""

from typing import List, Dict, Any
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from app.config import ARTIFACTS_DIR


def save_evaluation_plots(
    reliability_bins: List[Dict[str, float]],
    top_features: List[Dict[str, Any]],
) -> Dict[str, str]:
    paths: Dict[str, str] = {}

    # 1. Reliability Diagram
    if reliability_bins:
        fig, ax = plt.subplots(figsize=(5.5, 4.5), dpi=120)
        xs = [b["bin_predicted"] for b in reliability_bins]
        ys = [b["bin_observed"] for b in reliability_bins]
        ax.plot([0, 1], [0, 1], "--", color="#64748b", label="Perfect Calibration")
        ax.plot(xs, ys, "o-", color="#059669", linewidth=2.2, label="Calibrated Ensemble (14D)")
        ax.set_xlabel("Predicted Probability")
        ax.set_ylabel("Observed Event Frequency")
        ax.set_title("MonsoonPulse Ensemble Reliability Diagram (Held-out Test)")
        ax.legend(loc="upper left")
        ax.grid(True, alpha=0.25)
        rel_path = ARTIFACTS_DIR / "reliability_diagram.png"
        fig.tight_layout()
        fig.savefig(rel_path)
        plt.close(fig)
        paths["reliability_diagram"] = str(rel_path)

    # 2. Feature Importance Bar Chart
    if top_features:
        fig, ax = plt.subplots(figsize=(6.5, 4.5), dpi=120)
        feats = [f["feature"] for f in top_features[:8]][::-1]
        vals = [f["importance"] for f in top_features[:8]][::-1]
        ax.barh(feats, vals, color="#0B3B24")
        ax.set_xlabel("Normalized Gain Importance")
        ax.set_title("XGBoost Top Physical & Climate Features")
        ax.grid(True, axis="x", alpha=0.25)
        fi_path = ARTIFACTS_DIR / "feature_importance.png"
        fig.tight_layout()
        fig.savefig(fi_path)
        plt.close(fig)
        paths["feature_importance"] = str(fi_path)

    return paths
