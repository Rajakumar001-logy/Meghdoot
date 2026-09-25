# MonsoonPulse AI — SIH 3–5 Minute Demonstration Guide (`docs/DEMO_GUIDE.md`)

> **"Predict the Monsoon. Protect the Harvest."**

This guide provides the step-by-step **Smart India Hackathon (SIH)** 19-point live demonstration script (`3–5 minutes`) so judges can see the complete chain from **Climate Signal → Local Observation → AI Prediction → GIS Risk → Crop Advisory → Farmer Alert → Officer Response** without unnecessary page switching.

---

## 19-Step SIH Demonstration Flow

1. **Landing Page (`/`)**: Highlight the core proposition (*"Block-level probabilistic monsoon intelligence that converts climate and weather signals into crop-specific agricultural decision support"*) and click **Open Dashboard**.
2. **Open Command Center (`/dashboard`)**: Point out the 6 live KPI cards (`ACTIVE BLOCKS`, `HIGH-RISK BLOCKS`, `ACTIVE ADVISORIES`, `ACTIVE ALERTS`, `REAL OBSERVATION STATUS`, `AI MODEL STATUS`).
3. **Show Real Data & Model Status**: Point out the `MODEL HEALTH` (`MPAI-ENS-0.1`, Train `2019–2022`, Val `2023`, Test `2024–2025`, Leakage Audit `PASSED`) and `DATA SOURCE HEALTH` (`Weather`, `Rainfall`, `ENSO`, `IOD`, `MJO`).
4. **Select Prayagraj District**: Verify the 8 Prayagraj administrative blocks are active.
5. **Show Block Map (`/map` or Dashboard GIS Panel)**: Show the real Prayagraj 8-block GeoJSON polygons and switch between the 7 risk layers (`ONSET`, `FALSE ONSET`, `DRY SPELL`, `HEAVY RAIN`, `EXPECTED RAINFALL`, `RAINFALL ANOMALY`, `AGRICULTURAL RISK`).
6. **Select Karchhana Block**: Focus on `Karchhana Block` (`25.28°N, 81.94°E`).
7. **Select `14D` Horizon**: Use the global horizon selector (`7D / 14D / 21D / 30D`) to select `14D`.
8. **Show AI Prediction**: Display `MONSOON STATUS` showing `68% False Onset Probability` and `62% Dry-Spell Probability`.
9. **Click `"Why this prediction?"`**: Open the Explainable AI panel showing `TOP CONTRIBUTING FEATURES` (`Rainfall anomaly -18%`, `Recent 7D rainfall`, `Consecutive dry days`, `MJO Phase 3–4`, `ENSO/IOD`).
10. **Show Prediction Trace**: Expand **`Prediction Trace`** (`REAL OBSERVATION → FEATURE ENGINEERING → MODEL (0.60 XGBoost + 0.40 LSTM) → CALIBRATION (Isotonic) → OUTPUT`).
11. **Select `Paddy` Crop**: Click `Paddy` in the Global Crop Selector. Emphasize that changing the crop updates only the **agricultural interpretation**, while the underlying weather probability remains invariant.
12. **Show Crop Advisory (`/advisories` or Command Center)**: Show `RULE-FALSE-ONSET-001` (*Delay direct rainfed Paddy sowing by 5–7 days; maintain nursery irrigation*).
13. **Open Farmer Alert Preview (`/farmers`)**: Select **Ramesh Chandra Patel (`frm-101`, Karchhana Block)** who grows both **Paddy** and **Pulses** (`farmer_crops`). Point out masked phone privacy (`+91 ******0084`) and consent status (`notification_enabled = TRUE`).
14. **Show Hindi Message**: Inspect the structured 7-field Unicode Hindi advisory (`🌾 मानसून कृषि सलाह — Karchhana ब्लॉक, Prayagraj`).
15. **Open Officer Alert Center**: Filter alerts by `HIGH PRIORITY` or `UNREAD` and expand **`Why this alert?`** and **`Delivery Log`** (`SIMULATED DELIVERY` in Demo Mode vs. honest `NOT_CONFIGURED` when external gateway keys are absent).
16. **Show 3-Block Comparison**: Compare `Karchhana`, `Meja`, and `Koraon` side-by-side across `Onset`, `False Onset`, `Dry Spell`, `Heavy Rain`, `Anomaly`, and `Active Advisories`.
17. **Switch Demo Scenarios**: Click through `1. Favorable Monsoon`, `2. False Onset`, `3. Prolonged Break`, and `4. Heavy Rainfall` using the Command Center bar or **`RUN DEMO`** guided sequence.
18. **Show Complete Prediction → Advisory → Alert Chain**: Toggle **Farmer View (`MY FARM`)** to show how technical complexity is hidden for farmers while remaining explainable via `"Why am I seeing this?"`.
19. **Click `RESET DEMO`**: Click **`RESET DEMO`** to clear all demo overrides and restore the default AI state without altering real observations or model artifacts.
