"""
Central Configuration for MonsoonPulse AI Real ML Prediction Service (MPAI-ENS-0.1)
Defines prototype operational label definitions, block metadata, horizon windows,
ensemble weights, and artifact storage paths.
"""

from pathlib import Path
from typing import Dict, Any, List

BASE_DIR = Path(__file__).resolve().parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
DATA_CACHE_DIR = BASE_DIR / "artifacts" / "data_cache"

ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
DATA_CACHE_DIR.mkdir(parents=True, exist_ok=True)

MODEL_VERSION = "MPAI-ENS-0.1"
DATASET_VERSION = "PRAYAGRAJ-ERA5-HIST-2019-2025-v1"

# Forecast horizons supported (in days ahead of initialization date T)
FORECAST_HORIZONS: List[int] = [7, 14, 21, 30]

# Target classification names
CLASSIFICATION_TARGETS: List[str] = [
    "onset",
    "false_onset",
    "dry_spell",
    "heavy_rain",
]

# 8 Prototype Prayagraj Blocks with real geographic coordinates, elevation, and soil types
PRAYAGRAJ_BLOCKS: List[Dict[str, Any]] = [
    {
        "location_id": "karchhana",
        "name": "Karchhana",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.28,
        "longitude": 81.94,
        "elevation_m": 96.0,
        "soil_type": "Alluvial Clay-Loam",
        "soil_code": 1,
        "normal_daily_rain_mm": 8.6,
    },
    {
        "location_id": "phulpur",
        "name": "Phulpur",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.55,
        "longitude": 82.09,
        "elevation_m": 94.0,
        "soil_type": "Sandy Loam Alluvial",
        "soil_code": 2,
        "normal_daily_rain_mm": 8.4,
    },
    {
        "location_id": "meja",
        "name": "Meja",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.14,
        "longitude": 82.12,
        "elevation_m": 118.0,
        "soil_type": "Vindhyan Red-Loam",
        "soil_code": 3,
        "normal_daily_rain_mm": 8.1,
    },
    {
        "location_id": "koraon",
        "name": "Koraon",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 24.98,
        "longitude": 82.06,
        "elevation_m": 142.0,
        "soil_type": "Vindhyan Residual Clay",
        "soil_code": 4,
        "normal_daily_rain_mm": 7.9,
    },
    {
        "location_id": "bara",
        "name": "Bara",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.25,
        "longitude": 81.73,
        "elevation_m": 108.0,
        "soil_type": "Yamuna Ravine Loam",
        "soil_code": 3,
        "normal_daily_rain_mm": 8.2,
    },
    {
        "location_id": "soraon",
        "name": "Soraon",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.60,
        "longitude": 81.85,
        "elevation_m": 95.0,
        "soil_type": "Deep Gangetic Loam",
        "soil_code": 1,
        "normal_daily_rain_mm": 8.8,
    },
    {
        "location_id": "handia",
        "name": "Handia",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.38,
        "longitude": 82.18,
        "elevation_m": 91.0,
        "soil_type": "Gangetic Silty Loam",
        "soil_code": 1,
        "normal_daily_rain_mm": 8.7,
    },
    {
        "location_id": "chaka",
        "name": "Chaka",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "latitude": 25.39,
        "longitude": 81.86,
        "elevation_m": 97.0,
        "soil_type": "Alluvial Sandy-Clay",
        "soil_code": 2,
        "normal_daily_rain_mm": 8.5,
    },
]

# ==============================================================================
# CONFIGURABLE PROTOTYPE OPERATIONAL LABEL DEFINITIONS (Requirements 8–12)
# ==============================================================================

# 1. PROTOTYPE ONSET DEFINITION (Requirement 9)
# NOTE: "Prototype operational definition — requires validation against
# official/local onset datasets." (Not claimed as official IMD onset definition)
ONSET_CONFIG = {
    "ONSET_RAIN_THRESHOLD_MM": 2.5,      # Minimum daily rain to count as a wet day (mm)
    "ONSET_WINDOW_DAYS": 5,              # Consecutive evaluation window length (days)
    "ONSET_CUMULATIVE_RAIN_MM": 22.0,    # Minimum cumulative rain over ONSET_WINDOW_DAYS (mm)
    "MAX_ALLOWED_DRY_DAYS": 2,           # Maximum dry days allowed in the follow-up persistence window
    "PERSISTENCE_CHECK_DAYS": 7,         # Follow-up window to verify sustained monsoon moisture
    "DEFINITION_LABEL": (
        "Prototype operational definition — requires validation against "
        "official/local onset datasets."
    ),
}

# 2. FALSE ONSET DEFINITION (Requirement 10)
# Significant initial rainfall/wet event followed by a prolonged dry spell
# prior to sustained monsoon establishment.
FALSE_ONSET_CONFIG = {
    "INITIAL_WET_WINDOW_DAYS": 3,
    "INITIAL_WET_MIN_RAIN_MM": 12.0,     # Significant pre-monsoon / early wet burst
    "FALSE_ONSET_MIN_DRY_DAYS": 6,       # Prolonged dry spell duration following the burst
    "DRY_DAY_THRESHOLD_MM": 2.5,         # Daily rainfall < 2.5 mm considered dry day
}

# 3. BREAK-MONSOON / PROLONGED DRY SPELL DEFINITION (Requirement 11)
BREAK_MONSOON_CONFIG = {
    "BREAK_MIN_DRY_DAYS": 7,             # At least 7 consecutive or near-consecutive dry days
    "DRY_DAY_THRESHOLD_MM": 2.5,         # Daily rainfall < 2.5 mm
}

# 4. HEAVY RAINFALL DEFINITION (Requirement 12 - Official IMD Categories)
# Heavy rainfall: 64.5–115.5 mm/day
# Very heavy: 115.6–204.4 mm/day
# Extremely heavy: >= 204.5 mm/day
HEAVY_RAIN_CONFIG = {
    "HEAVY_RAIN_THRESHOLD_MM": 64.5,
    "VERY_HEAVY_RAIN_THRESHOLD_MM": 115.6,
    "EXTREMELY_HEAVY_RAIN_THRESHOLD_MM": 204.5,
    "SOURCE": "India Meteorological Department (IMD) Standard Daily Rainfall Categories",
}

# ==============================================================================
# MODEL & ENSEMBLE CONFIGURATION (Requirements 15–18)
# ==============================================================================
ENSEMBLE_CONFIG = {
    "XGBOOST_WEIGHT": 0.6,
    "LSTM_WEIGHT": 0.4,
    "NOTE": "Initial prototype weights (0.6 XGBoost / 0.4 LSTM); configurable for validation optimization.",
}

LSTM_CONFIG = {
    "SEQUENCE_LENGTH_DAYS": 30,
    "MIN_REQUIRED_SAMPLES": 400,
    "HIDDEN_SIZE": 32,
    "NUM_LAYERS": 1,
    "EPOCHS": 18,
    "BATCH_SIZE": 64,
    "LEARNING_RATE": 0.003,
}

# Chronological split boundaries (strictly ordered in time: Train -> Val -> Test)
SPLIT_CONFIG = {
    "TRAIN_END_YEAR": 2022,
    "VAL_YEAR": 2023,
    "TEST_START_YEAR": 2024,
}
