# MonsoonPulse AI — External Climate & Weather Data Sources (`DATA_SOURCES.md`)

This document specifies the real external atmospheric, agroclimatological, and planetary teleconnection data providers integrated into **MonsoonPulse AI**, along with their variables, standardized units, update frequencies, and normalization / quality-flag rules.

---

## 1. Architecture Overview

```text
REAL EXTERNAL DATA (Open-Meteo, NASA POWER, NOAA CPC / Marine SST)
        ↓
SERVER-SIDE INGESTION PROXY (/api/ingest) & PROVIDER LAYER (src/services/providers/*)
        ↓
VALIDATION, PHASE CLASSIFICATION & NORMALIZATION (src/services/normalization/*)
        ↓
SUPABASE POSTGRESQL & LOCAL OBSERVATION CACHE (src/services/ingestion/*)
        ↓
MONSOONPULSE AI DECISION SUPPORT UI (Dashboard, Climate Intelligence, Settings)
```

> **Strict Separation of Provenance**:
> 1. **REAL OBSERVATIONS**: Local weather (`weather_observations`), daily rainfall (`rainfall_observations`), and global climate indices (`climate_index_observations`).
> 2. **SIMULATED FORECAST**: 7-day, 14-day, 21-day, and 30-day sub-seasonal rainfall plumes (`rainfall_forecasts`).
> 3. **PROTOTYPE PREDICTION**: Rule-based Monsoon Onset, False Onset, Break-Monsoon, Heavy Rainfall probabilities, Soil Moisture status, and Crop Advisories (`forecast_predictions`, `crop_advisories`).

---

## 2. External Data Providers & Datasets

### A. Weather Observations (`weatherProvider.ts` → `weather_observations`)

| Property | Specification |
| :--- | :--- |
| **Provider** | **Open-Meteo Weather & ERA5 Reanalysis API** (`https://api.open-meteo.com/v1/forecast`) |
| **Dataset** | IFS / ERA5-Land High-Resolution Surface Meteorology & Reanalysis |
| **Spatial Resolution** | Block-level coordinates (`latitude`, `longitude`) for all 8 blocks in Prayagraj District, Uttar Pradesh |
| **Variables** | `temperature_2m` (`temperature_c`), `relative_humidity_2m` (`humidity_pct`), `surface_pressure` (`pressure_hpa`), `wind_speed_10m` (`wind_speed_kmh`), `precipitation` (`rainfall_mm`) |
| **Standardized Units** | Temperature: `°C` \| Humidity: `%` \| Pressure: `hPa` \| Wind Speed: `km/h` \| Rainfall: `mm/day` |
| **Update Frequency** | Hourly real-time observation & daily aggregation (`Asia/Kolkata` timezone); on-demand manual refresh or scheduled cron |

---

### B. Rainfall Observations (`rainfallProvider.ts` → `rainfall_observations`)

| Property | Specification |
| :--- | :--- |
| **Provider** | **NASA POWER Agroclimatology API** (`https://power.larc.nasa.gov/api/temporal/daily/point`) + **Open-Meteo Daily Precipitation Sum** |
| **Dataset** | NASA MERRA-2 / GPM Integrated Multi-satellitE Retrievals (`PRECTOTCORR`) & ERA5 Daily Precipitation |
| **Variables** | `PRECTOTCORR` / `precipitation_sum` (`rainfall_mm`), `normal_rainfall_mm` (block climatological baseline), `anomaly_percent` |
| **Standardized Units** | `mm/day` (millimeters per day) and `%` anomaly relative to normal |
| **Update Frequency** | Daily (`YYYY-MM-DD` ISO dates, 14-day rolling window) |

---

### C. Global Climate Signals (`climateProvider.ts` → `climate_index_observations`)

| Property | Specification |
| :--- | :--- |
| **Providers** | **NOAA Climate Prediction Center (CPC)** (`https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt`), **Open-Meteo Marine SST API** (`https://marine-api.open-meteo.com/v1/marine`), & **NOAA/BOM Real-time Multivariate MJO (RMM)** |
| **Datasets** | ERSSTv5 Niño 3.4 SST Anomaly (ONI), Equatorial Indian Ocean Dipole Mode Index (WIO `60°E, 0°N` vs SEIO `100°E, 5°S`), and RMM1/RMM2 MJO Index |
| **Variables** | `ENSO` (ONI SST anomaly), `IOD` (DMI SST dipole), `MJO` (RMM Amplitude & Phase 1–8) |
| **Standardized Units** | ENSO: `°C` anomaly \| IOD: `°C` anomaly \| MJO Amplitude: dimensionless (`>= 0`) |
| **Update Frequency** | Daily / Weekly synoptic updates |

---

## 3. Validation, Phase Classification & Normalization Rules

All incoming external payloads pass through `src/services/normalization/` before database persistence:

### 3.1 Physical Range Validation (`weatherNormalizer.ts` & `rainfallNormalizer.ts`)
- **Precipitation (`rainfall_mm`)**: Must satisfy `0 <= rainfall_mm <= 1200 mm/day`. Negative values are marked `invalid`. Missing values (`null`, `undefined`, or NASA POWER's `-999` fill value) are preserved as `null` with `quality_flag = "missing"` — **never silently replaced with `0 mm`**.
- **Temperature (`temperature_c`)**: Must satisfy `-25 °C <= temperature_c <= 60 °C`.
- **Relative Humidity (`humidity_pct`)**: Must satisfy `0% <= humidity_pct <= 100%`.
- **Atmospheric Pressure (`pressure_hpa`)**: Must satisfy `850 hPa <= pressure_hpa <= 1080 hPa`.
- **Wind Speed (`wind_speed_kmh`)**: Must satisfy `0 km/h <= wind_speed_kmh <= 250 km/h`.
- **Observation Date (`observation_date`)**: Normalized to ISO `YYYY-MM-DD`. Observations older than 5 days are tagged `quality_flag = "stale"`.

### 3.2 Quality Flag Hierarchy (`DataQualityFlag`)
Every observation record in `weather_observations`, `rainfall_observations`, and `climate_index_observations` includes a `quality_flag`:
- `valid`: All physical bounds and format checks passed from live external provider.
- `missing`: One or more sensor fields returned `null` or `-999`.
- `estimated`: Value derived from secondary reanalysis or fallback proxy.
- `stale`: Observation timestamp is older than 5 days.
- `invalid`: Out-of-bounds physical value rejected during normalization.

### 3.3 Teleconnection Phase Classification (`ensoClassifier.ts`)
- **ENSO (`classifyEnsoPhase`)**:
  - `value >= +0.5 °C` → `El Niño`
  - `value <= -0.5 °C` → `La Niña`
  - `-0.5 °C < value < +0.5 °C` → `Neutral`
- **IOD (`classifyIodPhase`)**:
  - `value >= +0.4 °C` → `Positive`
  - `value <= -0.4 °C` → `Negative`
  - `-0.4 °C < value < +0.4 °C` → `Neutral`
- **MJO (`classifyMjoPhase`)**:
  - Validates `amplitude >= 0`. Maps active amplitude (`>= 1.0`) and phase (`1–8`) to its geographic convective sector (e.g., `Phase 4 — Maritime Continent (Enhanced Monsoon)`).

---

## 4. Resilience & Multi-Tier Fallback Protocol

1. **Live Data Mode (`LIVE DATA`)**: Displayed **only** when at least one external provider fetch (`syncWeatherData`, `syncRainfallData`, `syncClimateIndices`) succeeds during the session.
2. **Stored Observation Fallback (`STORED SUPABASE OBSERVATION`)**: If an external API times out or is unreachable, the ingestion layer queries the latest stored observation in Supabase (`weather_observations`, `rainfall_observations`, `climate_index_observations`) or local persistent cache and sets `data_source_status.status = "degraded"`.
3. **Demo Mode (`SIMULATED FORECAST — DEMO`)**: If no external API is reachable and no stored observation exists, the application automatically falls back to the centralized Demo Data Engine (`src/data/mockData.ts`).
