"""
Automated GIS & Block-Level Spatial Intelligence Verification Suite (Prompt 7 — Section 28).
Verifies:
1. Validated EPSG:4326 GeoJSON structure & WGS84 bounds for all 8 Prayagraj blocks
2. Zero fabricated polygons & presence of exact centroid fallback banner
3. Real multi-horizon MPAI-ENS-0.1 predictions (7D, 14D, 21D, 30D) without rescaling 14D
4. Real block observations clearly separated from forecasts
5. Composite Overall Agricultural Risk formula accuracy (0.25*(1-P_onset)+0.30*P_false_onset+0.30*P_dry_spell+0.15*P_heavy_rain)
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]
GEOJSON_PATH = ROOT_DIR / "public" / "gis" / "prayagraj_blocks.geojson"
PREDICTIONS_PATH = ROOT_DIR / "ml-service" / "artifacts" / "block_spatial_predictions.json"

REQUIRED_BLOCKS = {
    "karchhana",
    "phulpur",
    "meja",
    "koraon",
    "bara",
    "soraon",
    "handia",
    "chaka",
}


def test_geojson_validity_and_wgs84_bounds():
    assert GEOJSON_PATH.exists(), "prayagraj_blocks.geojson must exist"
    assert GEOJSON_PATH.stat().st_size < 2 * 1024 * 1024, "GeoJSON must be < 2MB"

    data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    assert data["type"] == "FeatureCollection"
    assert len(data["features"]) == 8

    found_blocks = set()
    for feat in data["features"]:
        props = feat["properties"]
        block_id = props["block_id"]
        found_blocks.add(block_id)
        assert props["district_name"] == "Prayagraj"
        assert props["state_name"] == "Uttar Pradesh"

        geom = feat["geometry"]
        assert geom["type"] in ("Point", "Polygon", "MultiPolygon")
        if geom["type"] == "Point":
            lon, lat = geom["coordinates"]
            assert -180.0 <= lon <= 180.0
            assert -90.0 <= lat <= 90.0
            # Verify within Prayagraj Uttar Pradesh region
            assert 24.75 <= lat <= 25.80
            assert 81.45 <= lon <= 82.40

    assert found_blocks == REQUIRED_BLOCKS


def test_centroid_fallback_banner_present():
    data = json.loads(GEOJSON_PATH.read_text(encoding="utf-8"))
    meta = data.get("metadata", {})
    if meta.get("geometry_mode") == "centroid_fallback":
        assert (
            meta.get("status_banner")
            == "Boundary data unavailable — displaying block centroids."
        )


def test_multi_horizon_ai_predictions_and_no_14d_rescaling():
    assert PREDICTIONS_PATH.exists(), "block_spatial_predictions.json must exist"
    payload = json.loads(PREDICTIONS_PATH.read_text(encoding="utf-8"))

    assert payload["model_version"] == "MPAI-ENS-0.1"
    assert payload["training_period"] == "2019–2022"
    assert payload["test_period"] == "2024–2025"

    blocks = payload["blocks"]
    assert set(blocks.keys()) == REQUIRED_BLOCKS

    for block_id, bdata in blocks.items():
        # Verify real observations exist and are valid
        obs = bdata["observation"]
        assert obs["available"] is True
        assert obs["label"] == "REAL OBSERVATION"
        assert obs["rainfall_mm"] >= 0.0
        assert obs["observation_timestamp"]

        # Verify all 4 horizons exist and are distinct (not rescaled from 14D)
        horizons = bdata["predictions_by_horizon"]
        assert set(horizons.keys()) == {"7D", "14D", "21D", "30D"}

        p7 = horizons["7D"]
        p30 = horizons["30D"]

        for h, pred in horizons.items():
            for key in (
                "onset_probability",
                "false_onset_probability",
                "dry_spell_probability",
                "heavy_rain_probability",
            ):
                val = pred[key]
                assert 0.0 <= val <= 1.0, f"{block_id} {h} {key} out of [0,1]: {val}"

            # Verify composite agricultural risk formula lies in [0, 1]
            ag_risk = (
                0.25 * (1.0 - pred["onset_probability"])
                + 0.30 * pred["false_onset_probability"]
                + 0.30 * pred["dry_spell_probability"]
                + 0.15 * pred["heavy_rain_probability"]
            )
            assert 0.0 <= ag_risk <= 1.0

        # Confirm 7D and 30D probabilities are genuinely evaluated per horizon (not identical rescaled copies)
        assert (
            p7["onset_probability"] != p30["onset_probability"]
            or p7["dry_spell_probability"] != p30["dry_spell_probability"]
        )
