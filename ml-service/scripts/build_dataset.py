"""
CLI Script 1: Build Historical Block x Date Dataset & Audit Leakage
(ml-service/scripts/build_dataset.py)
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import ARTIFACTS_DIR
from app.data.dataset_builder import build_training_dataset, get_chronological_splits


def main():
    print("=== [1/5] Building Historical Block x Date Dataset ===")
    df, report = build_training_dataset(force_rebuild=False)
    train_df, val_df, test_df, split_meta = get_chronological_splits(df)

    report["splits"] = split_meta
    dataset_report_path = ARTIFACTS_DIR / "dataset_report.json"
    with open(dataset_report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"Leakage Audit Passed: {report['leakage_audit_passed']}")
    print(f"Total Monsoon Samples: {len(df)} across 8 Prayagraj blocks")
    print(f"Chronological Splits -> Train: {len(train_df)} | Val: {len(val_df)} | Test: {len(test_df)}")
    print(f"Saved dataset report to: {dataset_report_path}")


if __name__ == "__main__":
    main()
