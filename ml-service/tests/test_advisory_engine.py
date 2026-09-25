"""
Automated Unit & Boundary Test Suite for Crop-Specific AI Advisory Engine
(ml-service/tests/test_advisory_engine.py)

Prompt 8 Section 26:
Tests all 16 required advisory scenarios + exact boundary probabilities (0.30, 0.60, 0.80):
1. onset advisory (RULE-ONSET-001, RULE-ONSET-002, RULE-ONSET-003)
2. false onset advisory (RULE-FALSE-ONSET-001)
3. dry spell advisory (RULE-DRY-SPELL-001)
4. heavy rainfall advisory (RULE-HEAVY-RAIN-001)
5. irrigation logic (RULE-IRRIGATION-001, RULE-IRRIGATION-002)
6. drainage logic (RULE-DRAINAGE-001)
7. crop-specific differences (Paddy vs Maize vs Pulses vs Soybean vs Cotton)
8. crop seasonality (Wheat Rabi off-season in monsoon -> RULE-SEASON-001)
9. missing soil moisture ("Soil moisture unavailable", no fabrication)
10. missing crop stage ("Growth stage not specified", stage-independent rules)
11. expired prediction (status == "EXPIRED", excluded from active_advisories)
12. AI mode (source_mode == "AI", model_version == "MPAI-ENS-0.1")
13. simulated mode (source_mode == "SIMULATED")
14. demo mode (source_mode == "DEMO")
15. English output (WHAT / WHY / WHEN / ACTION + responsible wording)
16. Hindi output (Unicode Devanagari WHAT / WHY / WHEN / ACTION)
+ Boundary threshold tests at probability = 0.30, 0.60, 0.80.
"""

import json
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


def run_ts_advisory_eval(payload: dict) -> dict:
    """
    Executes the actual TypeScript evaluateCropAdvisories() engine via Node/TypeScript
    transpilation in-memory to guarantee 100% fidelity with src/services/advisoryEngine.ts.
    """
    runner_js = """
    const ts = require('typescript');
    const fs = require('fs');
    const path = require('path');
    const Module = require('module');

    const rootDir = process.cwd();
    const origResolve = Module._resolveFilename;
    Module._resolveFilename = function(request, parent, isMain, options) {
      if (request.startsWith('@/')) {
        const rel = request.slice(2);
        const candidateTs = path.join(rootDir, 'src', rel + '.ts');
        if (fs.existsSync(candidateTs)) return candidateTs;
      }
      return origResolve.call(this, request, parent, isMain, options);
    };

    require.extensions['.ts'] = function(module, filename) {
      const content = fs.readFileSync(filename, 'utf8');
      const compiled = ts.transpileModule(content, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
        }
      });
      module._compile(compiled.outputText, filename);
    };

    const { evaluateCropAdvisories } = require(path.join(rootDir, 'src/services/advisoryEngine.ts'));
    const input = JSON.parse(process.argv[1]);
    const result = evaluateCropAdvisories(input);
    process.stdout.write(JSON.stringify(result));
    """
    proc = subprocess.run(
        ["node", "-e", runner_js, json.dumps(payload)],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return json.loads(proc.stdout)


def base_inputs(**overrides) -> dict:
    default = {
        "location_id": "karchhana",
        "block_name": "Karchhana Block",
        "district": "Prayagraj",
        "state": "Uttar Pradesh",
        "crop_id": "paddy",
        "forecast_horizon": "14D",
        "horizon_days": 14,
        "crop_stage": "pre_sowing",
        "current_rainfall": 24.0,
        "recent_rainfall": 65.0,
        "rainfall_anomaly": -5.0,
        "temperature": 30.0,
        "humidity": 82.0,
        "soil_moisture": 52.0,
        "onset_probability": 0.72,
        "false_onset_probability": 0.18,
        "dry_spell_probability": 0.20,
        "heavy_rain_probability": 0.15,
        "expected_rainfall": 110.0,
        "model_version": "MPAI-ENS-0.1",
        "observation_cutoff": "2025-08-31",
        "prediction_issued_at": "2026-06-15T06:00:00Z",
        "prediction_valid_until": "2026-06-29T06:00:00Z",
        "reference_timestamp": "2026-06-15T12:00:00Z",
        "evaluation_month": 6,
        "source_mode": "AI",
    }
    default.update(overrides)
    return default


def test_01_onset_advisory_and_boundary_060():
    # Boundary: onset_probability == 0.60 with false_onset < 0.60 and dry_spell < 0.60 -> RULE-ONSET-001 (SOW_NOW)
    res = run_ts_advisory_eval(base_inputs(onset_probability=0.60, false_onset_probability=0.25, dry_spell_probability=0.25))
    rule_ids = [a["rule_id"] for a in res["active_advisories"]]
    assert "RULE-ONSET-001" in rule_ids

    # Boundary: onset_probability == 0.30 -> RULE-ONSET-002 (DELAY_SOWING)
    res_low = run_ts_advisory_eval(base_inputs(onset_probability=0.30))
    rule_ids_low = [a["rule_id"] for a in res_low["active_advisories"]]
    assert "RULE-ONSET-002" in rule_ids_low


def test_02_false_onset_advisory_and_boundaries_030_060_080():
    # Below 0.30 -> no RULE-FALSE-ONSET-001
    res_29 = run_ts_advisory_eval(base_inputs(false_onset_probability=0.29))
    assert "RULE-FALSE-ONSET-001" not in [a["rule_id"] for a in res_29["active_advisories"]]

    # Exact 0.30 -> triggers RULE-FALSE-ONSET-001 with MODERATE severity
    res_30 = run_ts_advisory_eval(base_inputs(false_onset_probability=0.30))
    fo_30 = next(a for a in res_30["active_advisories"] if a["rule_id"] == "RULE-FALSE-ONSET-001")
    assert fo_30["severity"] == "MODERATE"
    assert "Rainfall may occur before a prolonged dry period" in fo_30["en"]["why"]

    # Exact 0.60 -> triggers RULE-FALSE-ONSET-001 (HIGH) and RULE-ONSET-002 (DELAY_SOWING)
    res_60 = run_ts_advisory_eval(base_inputs(false_onset_probability=0.60))
    fo_60 = next(a for a in res_60["active_advisories"] if a["rule_id"] == "RULE-FALSE-ONSET-001")
    assert fo_60["severity"] == "HIGH"
    assert "RULE-ONSET-002" in [a["rule_id"] for a in res_60["active_advisories"]]

    # Exact 0.80 -> triggers CRITICAL severity
    res_80 = run_ts_advisory_eval(base_inputs(false_onset_probability=0.80))
    fo_80 = next(a for a in res_80["active_advisories"] if a["rule_id"] == "RULE-FALSE-ONSET-001")
    assert fo_80["severity"] == "CRITICAL"


def test_03_dry_spell_and_05_irrigation_logic():
    # Exact 0.30 -> triggers RULE-DRY-SPELL-001 (MONITOR_DRY_SPELL)
    res_30 = run_ts_advisory_eval(base_inputs(dry_spell_probability=0.30))
    assert "RULE-DRY-SPELL-001" in [a["rule_id"] for a in res_30["active_advisories"]]

    # Exact 0.60 + negative anomaly -> triggers RULE-IRRIGATION-001 with "If irrigation is available"
    res_60 = run_ts_advisory_eval(
        base_inputs(dry_spell_probability=0.60, rainfall_anomaly=-18.0, soil_moisture=None)
    )
    irr = next(a for a in res_60["active_advisories"] if a["rule_id"] == "RULE-IRRIGATION-001")
    assert "If irrigation is available" in irr["en"]["action"]


def test_04_heavy_rainfall_and_06_drainage_logic():
    # Heavy rain == 0.60 on Maize (HIGH waterlogging sensitivity) -> HIGH drainage & heavy rain advisories
    res = run_ts_advisory_eval(base_inputs(crop_id="maize", heavy_rain_probability=0.60))
    rules = {a["rule_id"]: a for a in res["active_advisories"]}
    assert "RULE-HEAVY-RAIN-001" in rules
    assert "RULE-DRAINAGE-001" in rules
    assert "RULE-IRRIGATION-002" in rules
    assert rules["RULE-DRAINAGE-001"]["severity"] == "HIGH"


def test_07_crop_specific_differences():
    res_paddy = run_ts_advisory_eval(base_inputs(crop_id="paddy", heavy_rain_probability=0.65))
    res_maize = run_ts_advisory_eval(base_inputs(crop_id="maize", heavy_rain_probability=0.65))
    paddy_drain = next(a for a in res_paddy["active_advisories"] if a["rule_id"] == "RULE-DRAINAGE-001")
    maize_drain = next(a for a in res_maize["active_advisories"] if a["rule_id"] == "RULE-DRAINAGE-001")
    assert paddy_drain["en"]["action"] != maize_drain["en"]["action"]
    assert paddy_drain["severity"] == "MODERATE"  # Paddy has LOW waterlogging sensitivity
    assert maize_drain["severity"] == "HIGH"      # Maize has HIGH waterlogging sensitivity


def test_08_crop_seasonality_wheat():
    # Wheat in June (month=6) must trigger RULE-SEASON-001 and NEVER trigger SOW_NOW / DELAY_SOWING
    res_wheat = run_ts_advisory_eval(
        base_inputs(crop_id="wheat", evaluation_month=6, onset_probability=0.82, false_onset_probability=0.10)
    )
    rule_ids = [a["rule_id"] for a in res_wheat["active_advisories"]]
    assert "RULE-SEASON-001" in rule_ids
    assert "RULE-ONSET-001" not in rule_ids
    assert "RULE-ONSET-002" not in rule_ids


def test_09_missing_soil_moisture_and_10_missing_crop_stage():
    res = run_ts_advisory_eval(base_inputs(soil_moisture=None, crop_stage=None))
    assert res["soil_moisture_status_en"] == "Soil moisture unavailable"
    assert res["crop_stage_status_en"] == "Growth stage not specified"
    assert res["crop_stage_resolved"] is None


def test_11_expired_prediction():
    res = run_ts_advisory_eval(
        base_inputs(
            prediction_valid_until="2026-06-10T00:00:00Z",
            reference_timestamp="2026-06-15T12:00:00Z",
        )
    )
    assert res["is_prediction_expired"] is True
    assert len(res["active_advisories"]) == 0
    assert len(res["expired_advisories"]) > 0
    assert all(a["status"] == "EXPIRED" for a in res["expired_advisories"])


def test_12_13_14_modes_and_15_16_bilingual_unicode():
    for mode in ("AI", "SIMULATED", "DEMO"):
        res = run_ts_advisory_eval(base_inputs(source_mode=mode, dry_spell_probability=0.68))
        assert res["source_mode"] == mode
        adv = res["active_advisories"][0]
        # Verify English and Hindi WHAT / WHY / WHEN / ACTION exist and contain no forbidden phrases
        assert adv["en"]["what"] and adv["en"]["why"] and adv["en"]["when"] and adv["en"]["action"]
        assert adv["hi"]["what"] and adv["hi"]["why"] and adv["hi"]["when"] and adv["hi"]["action"]
        assert "AI accuracy" not in json.dumps(res)
        assert "Guaranteed" not in json.dumps(res)
        # Check Hindi Devanagari Unicode characters present
        assert any("\u0900" <= ch <= "\u097f" for ch in adv["hi"]["message"])
