# MonsoonPulse AI — Crop-Specific AI Advisory & Agricultural Decision Engine (`MPAI-ENS-0.1`)

> [!IMPORTANT]
> **Prototype & Scientific Limitation Disclaimers**
> - **"These are prototype decision-support rules and are not official agricultural advisories."**
> - **"MonsoonPulse AI provides experimental decision support based on model outputs and available observations. Agricultural recommendations should be validated against local agronomic conditions and official extension guidance before operational deployment."**
> - This system does **not** claim to provide government-approved advice, official IMD advisories, or official agricultural extension recommendations.

---

## 1. Supported Crops (`src/config/advisoryRules.ts`)
MonsoonPulse AI supports 6 configurable crop profiles stored in `CROP_PROFILES` (`src/config/advisoryRules.ts`) and `public.crops` (`supabase/migrations/005_crop_advisory_decision_engine.sql`):

| `crop_id` | Name | Scientific Name | Hindi Name | Season | Sowing Window | Water Requirement | Excess Rain Sensitivity | Dry Spell Sensitivity | Waterlogging Sensitivity | Primary Suitable Blocks (Prayagraj) |
|---|---|---|---|---|---|---|---|---|---|---|
| `paddy` | Paddy / Rice | *Oryza sativa* | धान (चावल) | Kharif | June – July | `1100–1250 mm` | `MODERATE` | `HIGH` | `LOW` | All 8 blocks (`karchhana`, `phulpur`, `soraon`, `handia`, `chaka`, `bara`, `meja`, `koraon`) |
| `maize` | Maize | *Zea mays* | मक्का | Kharif | Mid-June – July | `500–650 mm` | `HIGH` | `MODERATE` | `HIGH` | `phulpur`, `soraon`, `handia`, `karchhana`, `chaka`, `bara`, `meja` |
| `pulses` | Pulses (Arhar/Moong/Urad) | *Cajanus cajan / Vigna radiata* | दलहन (अरहर/मूंग/उड़द) | Kharif | Late June – July | `350–450 mm` | `HIGH` | `LOW` | `HIGH` | All 8 blocks (upland/raised beds) |
| `soybean` | Soybean | *Glycine max* | सोयाबीन | Kharif | Late June – Mid-July | `450–600 mm` | `HIGH` | `HIGH` | `HIGH` | `meja`, `koraon`, `bara`, `karchhana` |
| `cotton` | Cotton | *Gossypium hirsutum* | कपास | Kharif | May – June | `650–800 mm` | `HIGH` | `MODERATE` | `HIGH` | `bara`, `meja`, `koraon` (limited upland pockets) |
| `wheat` | Wheat | *Triticum aestivum* | गेहूँ | **Rabi** | **November – December** | `400–500 mm` | `HIGH` | `MODERATE` | `HIGH` | All 8 blocks (Winter Rabi crop — **off-season during monsoon**) |

---

## 2. Advisory Inputs (`src/types/advisory.ts`)
Every advisory evaluation (`evaluateCropAdvisories`) consumes:
- `location_id` (Prayagraj block ID)
- `crop_id` (`paddy`, `maize`, `pulses`, `soybean`, `cotton`, `wheat`)
- `forecast_horizon` (`7D`, `14D`, `21D`, `30D`)
- `crop_stage` (optional: `pre_sowing`, `germination`, `vegetative`, `flowering`, `grain_filling`, `harvest`; if omitted/null, displays **`"Growth stage not specified"`** and evaluates only stage-independent rules)
- `current_rainfall` (`mm`), `recent_rainfall` (`7D cumulative mm`), `rainfall_anomaly` (`%`), `temperature` (`°C`), `humidity` (`%`)
- `soil_moisture` (`%` or `null` — **if unavailable, it is NEVER fabricated; the system displays `"Soil moisture unavailable"` and does not trigger soil-moisture-dependent conditions**)
- `onset_probability`, `false_onset_probability`, `dry_spell_probability`, `heavy_rain_probability`, `expected_rainfall` (`mm`)
- `model_version` (`MPAI-ENS-0.1`), `observation_cutoff`, `prediction_issued_at`, `prediction_valid_until`, `source_mode` (`AI` | `SIMULATED` | `DEMO`)

---

## 3. Deterministic Rule Definitions (`12 Rules`)
All rules are deterministic, non-LLM, and independently testable:

| `rule_id` | Decision Category | Code | Trigger Condition | Default Severity |
|---|---|---|---|---|
| `RULE-SEASON-001` | `NO_IMMEDIATE_ACTION` | `J` | `crop.season === 'Rabi' && evaluation_month in [5..9]` | `LOW` |
| `RULE-SUITABILITY-001` | `MONITOR_DRY_SPELL` | `I` | `!crop.suitable_blocks.includes(location_id)` | `MODERATE` |
| `RULE-ONSET-001` | `SOW_NOW` | `A` | `onset_probability >= 0.60 && false_onset_probability < 0.60 && dry_spell_probability < 0.60 && recent_or_expected_rain_adequate` | `LOW` |
| `RULE-ONSET-002` | `DELAY_SOWING` | `B` | `(onset_probability <= 0.30 \|\| false_onset_probability >= 0.60) && sowing_context` | `HIGH` / `CRITICAL` |
| `RULE-ONSET-003` | `PREPARE_FOR_SOWING` | `C` | `0.30 < onset_probability < 0.60 && false_onset_probability < 0.60` | `MODERATE` |
| `RULE-FALSE-ONSET-001` | `MONITOR_FALSE_ONSET_RISK` | `H` | `false_onset_probability >= 0.30 && sowing_context` | `MODERATE` / `HIGH` / `CRITICAL` |
| `RULE-DRY-SPELL-001` | `MONITOR_DRY_SPELL` | `I` | `dry_spell_probability >= 0.30` | `MODERATE` / `HIGH` |
| `RULE-IRRIGATION-001` | `IRRIGATION_REQUIRED` | `D` | `dry_spell_probability >= 0.60 && (soil_moisture < 35% \|\| rainfall_anomaly <= -10%)` | `HIGH` / `CRITICAL` |
| `RULE-IRRIGATION-002` | `REDUCE_AVOID_IRRIGATION` | `E` | `heavy_rain_probability >= 0.30` | `MODERATE` |
| `RULE-DRAINAGE-001` | `DRAINAGE_PREPARATION` | `F` | `heavy_rain_probability >= 0.30` (scaled by `waterlogging_sensitivity`) | `MODERATE` / `HIGH` / `CRITICAL` |
| `RULE-HEAVY-RAIN-001` | `HEAVY_RAIN_PREPARATION` | `G` | `heavy_rain_probability >= 0.60 \|\| daily_rain >= 64.5 mm/day` | `HIGH` / `CRITICAL` |
| `RULE-NO-ACTION-001` | `NO_IMMEDIATE_ACTION` | `J` | All adverse risk probabilities `< 0.30` | `LOW` |

---

## 4. Thresholds (`ADVISORY_THRESHOLDS`)
- **Probability Cutoffs**:
  - `< 0.30`: Low
  - `>= 0.30`: Moderate / Watch (`MONITOR_FALSE_ONSET_RISK`, `MONITOR_DRY_SPELL`, `DRAINAGE_PREPARATION`)
  - `>= 0.60`: High / Action (`SOW_NOW`, `DELAY_SOWING`, `IRRIGATION_REQUIRED`, `HEAVY_RAIN_PREPARATION`)
  - `>= 0.80`: Critical
- **IMD Heavy Rainfall Categories (`Section 8`)**:
  - **Heavy**: `64.5 – 115.5 mm/day`
  - **Very Heavy**: `115.6 – 204.4 mm/day`
  - **Extremely Heavy**: `>= 204.5 mm/day`

---

## 5. Crop Sensitivity Assumptions (`Section 9`)
- **Paddy**: Low waterlogging sensitivity (`LOW`), high dry-spell sensitivity (`HIGH`). Advises maintaining a 5 cm spillway notch in nurseries/transplanted plots during heavy rain.
- **Maize / Pulses / Soybean / Cotton**: High waterlogging sensitivity (`HIGH`). When `heavy_rain_probability >= 0.60`, `RULE-DRAINAGE-001` escalates to `HIGH` severity (`HIGH heavy-rain probability + waterlogging-sensitive crop = HIGH drainage preparation advisory`).

---

## 6. Seasonality (`Wheat in Monsoon`)
- `wheat` has `season = "Rabi"` and `sowing_window.months = [11, 12]`.
- During Kharif monsoon months (`May–September`), `RULE-SEASON-001` suppresses all monsoon sowing advisories (`SOW_NOW`, `DELAY_SOWING`, `PREPARE_FOR_SOWING`) and instructs the user to bank residual soil moisture for November–December Rabi sowing.

---

## 7. Bilingual Support (`English` & `Hindi` Unicode)
- Every rule produces reviewed `en` and `hi` structured `WHAT / WHY / WHEN / ACTION` fields in Unicode (`हिन्दी`).
- No runtime LLM or machine-translation API is called.

---

## 8. Evidence Generation (`Evidence Basis` — Never `"AI Accuracy"`)
- Every advisory includes an `evidence` object (`AdvisoryEvidenceBasis`) listing the exact forecast probabilities, rainfall anomaly, soil moisture status, forecast horizon, observation cutoff, and `rule_id`.
- The UI labels this **`"Evidence basis"`** and never calls it `"AI accuracy"` or an `"overall AI score"`.

---

## 9. Limitations
1. Prototype thresholds (`0.30`, `0.60`, `0.80`) are deterministic decision-support rules and must be calibrated with local Krishi Vigyan Kendra (KVK) agronomists prior to operational extension use.
2. When physical in-situ soil moisture sensors are absent (`AI` mode using ERA5/Open-Meteo observations), soil moisture is reported as `"Soil moisture unavailable"` and irrigation rules rely on `dry_spell_probability` and `rainfall_anomaly`.

---

## 10. Provenance & Expiration
- Every advisory records `source_mode` (`AI` | `SIMULATED` | `DEMO`), `model_version` (`MPAI-ENS-0.1`), `created_at`, `valid_until`, and `status` (`ACTIVE` | `EXPIRED`).
- When `reference_timestamp > valid_until`, `status` becomes `EXPIRED` and the advisory is excluded from `active_advisories`.
