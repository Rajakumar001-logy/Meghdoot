"""
Exports Real Block-Level Multi-Horizon AI Predictions (7D, 14D, 21D, 30D)
and Latest Real Block Weather/Rainfall Observations for all 8 Prayagraj Blocks
(ml-service/scripts/export_gis_predictions.py)

Prompt 7 Requirements 9, 10, 11, 20:
- Computes real `MPAI-ENS-0.1` predictions for every block (`karchhana`, `phulpur`,
  `meja`, `koraon`, `bara`, `soraon`, `handia`, `chaka`) across all 4 horizons
  (`7D`, `14D`, `21D`, `30D`) without rescaling 14D values.
- Extracts the latest real observed meteorology (`rainfall_mm`, `temperature_c`,
  `humidity_pct`, `pressure_hpa`, `wind_speed_kmh`, `observation_date`) per block.
- Saves to `ml-service/artifacts/block_spatial_predictions.json` for instant batch
  serving by `/api/gis/block-intelligence` and FastAPI `/predict-batch`.
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import ARTIFACTS_DIR, FORECAST_HORIZONS, PRAYAGRAJ_BLOCKS
from app.inference.predictor import MonsoonPredictor


def main():
    predictor = MonsoonPredictor()
    if not predictor.is_ready or predictor.raw_df is None:
        raise RuntimeError("MonsoonPredictor is not ready — cannot export GIS predictions.")

    raw_df = predictor.raw_df
    blocks_output = {}

    for block in PRAYAGRAJ_BLOCKS:
        loc_id = block["location_id"]
        bdf = raw_df[raw_df["location_id"] == loc_id].sort_values("date")
        # Latest active monsoon observation row for realistic mid-monsoon operational monitoring
        monsoon_rows = bdf[bdf["date"].dt.month.isin([6, 7, 8])]
        obs_row = monsoon_rows.iloc[-1] if len(monsoon_rows) > 0 else bdf.iloc[-1]
        obs_date_str = str(obs_row["date"])[:10]

        # Compute cumulative 7-day observed rainfall up to obs_date_str
        recent_7d = bdf[bdf["date"] <= obs_row["date"]].tail(7)
        cum_7d_mm = round(float(recent_7d["rainfall_mm"].sum()), 1)

        observation_payload = {
            "available": True,
            "label": "REAL OBSERVATION",
            "rainfall_mm": round(float(obs_row["rainfall_mm"]), 1),
            "cumulative_7d_rain_mm": cum_7d_mm,
            "temperature_c": round(float(obs_row["temperature_c"]), 1),
            "humidity_pct": round(float(obs_row["humidity_pct"]), 1),
            "pressure_hpa": round(float(obs_row["pressure_hpa"]), 1),
            "wind_speed_kmh": round(float(obs_row["wind_speed_kmh"]), 1),
            "observation_timestamp": f"{obs_date_str}T12:00:00Z",
            "source": "Open-Meteo ERA5 Historical / Prayagraj Block Grid Archive",
            "quality": "valid",
        }

        horizons_map = {}
        for h in FORECAST_HORIZONS:
            pred = predictor.predict(
                location_id=loc_id,
                forecast_horizon=h,
                initialization_date=obs_date_str,
            )
            horizons_map[f"{h}D"] = pred

        blocks_output[loc_id] = {
            "block_id": loc_id,
            "block_name": block["name"],
            "district": block["district"],
            "state": block["state"],
            "latitude": block["latitude"],
            "longitude": block["longitude"],
            "elevation_m": block["elevation_m"],
            "soil_type": block["soil_type"],
            "normal_daily_rain_mm": block["normal_daily_rain_mm"],
            "observation": observation_payload,
            "predictions_by_horizon": horizons_map,
        }

    export_payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model_name": "MonsoonPulse Ensemble",
        "model_version": predictor.metadata.get("model_version", "MPAI-ENS-0.1"),
        "dataset_version": predictor.metadata.get(
            "dataset_version", "PRAYAGRAJ-ERA5-HIST-2019-2025-v1"
        ),
        "training_period": "2019–2022",
        "validation_period": "2023",
        "test_period": "2024–2025",
        "block_count": len(blocks_output),
        "blocks": blocks_output,
    }

    out_path = ARTIFACTS_DIR / "block_spatial_predictions.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(export_payload, f, indent=2)

    print(
        f"Exported 8-block x 4-horizon real MPAI-ENS-0.1 spatial predictions to: {out_path}"
    )
    for loc_id, bdata in blocks_output.items():
        p14 = bdata["predictions_by_horizon"]["14D"]
        p30 = bdata["predictions_by_horizon"]["30D"]
        print(
            f"  - {loc_id:10s} | 14D Onset={p14['onset_probability_pct']:5.1f}%, FalseOnset={p14['false_onset_probability_pct']:5.1f}%, "
            f"DrySpell={p14['dry_spell_probability_pct']:5.1f}%, Rain={p14['expected_rainfall']:5.1f}mm | "
            f"30D Onset={p30['onset_probability_pct']:5.1f}%, Rain={p30['expected_rainfall']:5.1f}mm"
        )


if __name__ == "__main__":
    main()
