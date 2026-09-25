"""
Automated ML Hardening & Data-Leakage Test Suite
(ml-service/tests/test_ml_hardening.py)

Prompt 6 Requirement 18:
Implements all 11 required unit and integration tests verifying:
1. test_no_future_features
2. test_no_future_lstm_sequence
3. test_chronological_split
4. test_scaler_fit_only_on_train
5. test_calibrator_fit_only_on_validation
6. test_deterministic_prediction
7. test_probability_bounds
8. test_invalid_horizon_rejected
9. test_invalid_location_rejected
10. test_missing_feature_rejected
11. test_fallback_when_model_disabled
"""

import sys
import unittest
from pathlib import Path
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.loader import fetch_or_load_historical_observations
from app.data.feature_engineering import (
    FEATURE_COLUMNS,
    build_all_features,
    engineer_features_for_block,
    verify_no_data_leakage,
)
from app.data.dataset_builder import build_training_dataset, get_chronological_splits
from app.evaluation.sequence_leakage_audit import (
    audit_lstm_sequence_leakage,
    audit_scaler_isolation,
    audit_calibration_isolation,
)
from app.evaluation.artifact_integrity import verify_inference_determinism
from app.inference.predictor import MonsoonPredictor


class TestMLHardeningSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw_df, _ = fetch_or_load_historical_observations()
        cls.continuous_df = build_all_features(cls.raw_df)
        cls.dataset_df, _ = build_training_dataset(force_rebuild=False)
        cls.train_df, cls.val_df, cls.test_df, cls.split_meta = get_chronological_splits(
            cls.dataset_df
        )
        cls.predictor = MonsoonPredictor()

    def test_01_no_future_features(self):
        """
        Verifies causal feature engineering at T never uses rows > T.
        Mutating future observations after cutoff T must leave features at T 100% unchanged.
        """
        self.assertTrue(verify_no_data_leakage(self.raw_df))

        bdf = (
            self.raw_df[self.raw_df["location_id"] == "karchhana"]
            .sort_values("date")
            .reset_index(drop=True)
        )
        cutoff_idx = 450
        cutoff_dt = bdf.loc[cutoff_idx, "date"]

        slice_clean = bdf[bdf["date"] <= cutoff_dt].copy()
        feat_clean = engineer_features_for_block(slice_clean).iloc[-1]

        bdf_corrupted = bdf.copy()
        bdf_corrupted.loc[bdf_corrupted["date"] > cutoff_dt, "rainfall_mm"] = 9999.0
        bdf_corrupted.loc[bdf_corrupted["date"] > cutoff_dt, "temperature_c"] = 99.0
        slice_corrupted = bdf_corrupted[bdf_corrupted["date"] <= cutoff_dt].copy()
        feat_corrupted = engineer_features_for_block(slice_corrupted).iloc[-1]

        for col in FEATURE_COLUMNS:
            self.assertAlmostEqual(
                float(feat_clean[col]),
                float(feat_corrupted[col]),
                places=8,
                msg=f"Feature '{col}' leaked future data!",
            )

    def test_02_no_future_lstm_sequence(self):
        """
        Audits all 9,496 LSTM 30-day sequences across Train, Validation, and Test splits.
        Verifies zero future timestamps and zero cross-split window contamination.
        """
        audit = audit_lstm_sequence_leakage(
            self.continuous_df, self.train_df, self.val_df, self.test_df
        )
        self.assertTrue(audit["audit_passed"])
        self.assertEqual(audit["future_contamination_count"], 0)
        self.assertEqual(audit["cross_split_contamination"], 0)
        self.assertGreaterEqual(audit["sequence_checked"], 9496)

    def test_03_chronological_split(self):
        """
        Verifies strict chronological ordering:
        max(train.date) < min(val.date) <= max(val.date) < min(test.date).
        """
        train_max = pd.to_datetime(self.train_df["date"]).max()
        val_min = pd.to_datetime(self.val_df["date"]).min()
        val_max = pd.to_datetime(self.val_df["date"]).max()
        test_min = pd.to_datetime(self.test_df["date"]).min()

        self.assertLess(train_max, val_min)
        self.assertLessEqual(val_min, val_max)
        self.assertLess(val_max, test_min)
        self.assertEqual(str(train_max.date()), "2022-10-31")
        self.assertEqual(str(val_min.date()), "2023-05-01")
        self.assertEqual(str(val_max.date()), "2023-10-31")
        self.assertEqual(str(test_min.date()), "2024-05-01")

    def test_04_scaler_fit_only_on_train(self):
        """
        Verifies `lstm_scaler.joblib` mean/scale match `train_df` (2019–2022) to < 1e-6
        and differ from the combined dataset.
        """
        scaler_audit = audit_scaler_isolation(self.train_df, self.val_df, self.test_df)
        self.assertTrue(scaler_audit["audit_passed"])
        self.assertTrue(scaler_audit["scaler_fitted_exclusively_on_train"])
        self.assertLess(scaler_audit["max_abs_mean_diff_vs_train"], 1e-6)
        self.assertLess(scaler_audit["max_abs_scale_diff_vs_train"], 1e-6)

    def test_05_calibrator_fit_only_on_validation(self):
        """
        Verifies `calibrators.joblib` has all 16 calibrators fitted exclusively on
        `val_df` (2023) with zero test set contamination.
        """
        cal_audit = audit_calibration_isolation(self.val_df, self.test_df)
        self.assertTrue(cal_audit["audit_passed"])
        self.assertTrue(cal_audit["calibration_fitted_exclusively_on_validation"])
        self.assertEqual(cal_audit["calibrated_keys_count"], 16)
        self.assertFalse(cal_audit["test_set_used_for_calibration"])

    def test_06_deterministic_prediction(self):
        """
        Verifies repeated predictions for identical inputs return identical probabilities
        and identical SHA-256 `input_hash`, `feature_hash`, and `prediction_hash`.
        """
        det = verify_inference_determinism(self.predictor)
        self.assertTrue(det["deterministic"])
        self.assertEqual(det["max_probability_diff"], 0.0)
        self.assertTrue(det["hashes_identical"])

    def test_07_probability_bounds(self):
        """
        Verifies all calibrated and raw probabilities lie strictly in [0.0, 1.0]
        and percentages lie in [0.0, 100.0].
        """
        res = self.predictor.predict("karchhana", 14, "2025-06-25")
        for key in (
            "onset_probability",
            "false_onset_probability",
            "dry_spell_probability",
            "heavy_rain_probability",
            "onset_raw_probability",
            "false_onset_raw_probability",
            "dry_spell_raw_probability",
            "heavy_rain_raw_probability",
        ):
            val = float(res[key])
            self.assertGreaterEqual(val, 0.0, f"{key} below 0.0")
            self.assertLessEqual(val, 1.0, f"{key} above 1.0")

        for pct_key in (
            "onset_probability_pct",
            "false_onset_probability_pct",
            "dry_spell_probability_pct",
            "heavy_rain_probability_pct",
        ):
            pct = float(res[pct_key])
            self.assertGreaterEqual(pct, 0.0)
            self.assertLessEqual(pct, 100.0)

    def test_08_invalid_horizon_rejected(self):
        """
        Verifies invalid forecast horizons (e.g. 10, 45, -7) raise ValueError.
        """
        for bad_h in (10, 45, 0, -7):
            with self.subTest(horizon=bad_h):
                with self.assertRaises(ValueError):
                    self.predictor.predict("karchhana", forecast_horizon=bad_h)

    def test_09_invalid_location_rejected(self):
        """
        Verifies unknown location_id raises ValueError instead of silently defaulting.
        """
        with self.assertRaises(ValueError):
            self.predictor.predict("unknown_block_xyz", forecast_horizon=14)

    def test_10_missing_feature_rejected(self):
        """
        Verifies initialization dates with fewer than 30 days of historical lookback
        raise ValueError.
        """
        with self.assertRaises(ValueError):
            # 2019-01-05 has only 5 days of history (< 30 required for 30-day causal window)
            self.predictor.predict("karchhana", forecast_horizon=14, initialization_date="2019-01-05")

    def test_11_fallback_when_model_disabled(self):
        """
        Verifies that when the predictor is disabled / artifacts unavailable,
        predict() raises RuntimeError so the Next.js API cleanly triggers SIMULATED FORECAST fallback.
        """
        dummy_predictor = MonsoonPredictor()
        dummy_predictor.is_ready = False
        dummy_predictor.reload_artifacts = lambda: False  # type: ignore
        with self.assertRaises(RuntimeError):
            dummy_predictor.predict("karchhana", forecast_horizon=14)


if __name__ == "__main__":
    unittest.main()
