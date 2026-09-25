# MonsoonPulse AI — Data Provenance & Isolation Policy (`docs/DATA_PROVENANCE.md`)

---

## 1. Global `DataProvenanceBadge` States

Every screen in MonsoonPulse AI renders the reusable [`DataProvenanceBadge`](file:///d:/monsoon%20ai/src/components/common/DataProvenanceBadge.tsx) component with one of four explicit states:

| Badge State | Label Displayed | Meaning |
| :--- | :--- | :--- |
| `REAL` | `REAL OBSERVATION` | Validated external meteorological/climate telemetry (Open-Meteo, IMD/NASA POWER, NOAA ENSO/IOD/MJO). |
| `AI` | `AI PREDICTION (MPAI-ENS-0.1)` | Calibrated probability output from the trained `0.60 XGBoost + 0.40 Causal LSTM` ensemble. |
| `SIMULATED` | `SIMULATED FORECAST` | Deterministic rule-based fallback forecast used when the Python FastAPI ML service is offline. |
| `DEMO` | `DEMO DATA` | Interactive hackathon scenario (`Scenario A/B/C/D`) isolated in client/demo state. |

---

## 2. Strict Isolation Guarantees

1. **No Silent Mixing**: If the FastAPI AI service is unreachable, the UI never labels fallback numbers as `"AI PREDICTION"`. It explicitly transitions to `"SIMULATED FORECAST"`.
2. **Demo Reset Safety (`RESET DEMO`)**: Running or resetting a Demo Scenario (`Favorable Monsoon`, `False Onset`, `Prolonged Break`, `Heavy Rainfall`) operates exclusively on isolated scenario state and **never overwrites** `weather_observations`, `rainfall_observations`, `ai_predictions`, `farmers`, or trained model artifacts (`ml-service/artifacts/`).
3. **Truthful Messaging Status**: External WhatsApp and SMS dispatches are labeled `"SIMULATED DELIVERY"` in Demo Mode and `"NOT_CONFIGURED"` when `WHATSAPP_*` / `SMS_*` credentials are absent.
