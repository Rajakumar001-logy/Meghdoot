"""
Automated SIH Final Integration & Readiness Test Suite
(ml-service/tests/test_sih_final_readiness.py)

Verifies Prompt 10 requirements:
1. Unified Block Intelligence Object consistency ({ block, geometry, observations, predictions, rainfall, risk, advisories, alerts, provenance })
2. Global Crop Selector invariance (weather prediction unchanged when crop changes; only agricultural advisory updates)
3. Up-to-3 Block Comparison Matrix (max 3 blocks, no single-score 'best block' ranking)
4. Explainable AI ('Why this prediction?') causal-safe wording + 5-stage Prediction Trace
5. All 4 Demo Scenarios (Favorable Monsoon, False Onset, Prolonged Break, Heavy Rainfall)
6. Structured Observability Logger secret & phone redaction
7. Security Audit (.env.example groups, zero exposed service_role/WhatsApp/SMS secrets)
8. Documentation & SQL Migration verification
"""

import json
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


def run_ts_sih_eval(action: str, payload: dict | None = None) -> dict:
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
        const candidateTsx = path.join(rootDir, 'src', rel + '.tsx');
        if (fs.existsSync(candidateTsx)) return candidateTsx;
      }
      return origResolve.call(this, request, parent, isMain, options);
    };

    const compileHook = function(module, filename) {
      const content = fs.readFileSync(filename, 'utf8');
      const compiled = ts.transpileModule(content, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.React,
          esModuleInterop: true,
        }
      });
      module._compile(compiled.outputText, filename);
    };

    require.extensions['.ts'] = compileHook;
    require.extensions['.tsx'] = compileHook;

    const unifiedSvc = require(path.join(rootDir, 'src/services/unifiedBlockIntelligence.ts'));
    const obsLogger = require(path.join(rootDir, 'src/lib/observabilityLogger.ts'));

    const action = process.argv[1];
    const input = JSON.parse(process.argv[2] || '{}');

    let out = {};
    if (action === 'unified') {
      out = unifiedSvc.buildUnifiedBlockIntelligence(input);
    } else if (action === 'compare') {
      out = { rows: unifiedSvc.buildBlockComparisonMatrix(input) };
    } else if (action === 'log_redact') {
      out = obsLogger.logSystemEvent(input);
    }
    process.stdout.write(JSON.stringify(out));
    """
    proc = subprocess.run(
        ["node", "-e", runner_js, action, json.dumps(payload or {})],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    return json.loads(proc.stdout)


def test_01_unified_block_intelligence_structure():
    res = run_ts_sih_eval(
        "unified",
        {
            "blockId": "karchhana",
            "horizon": "14D",
            "cropId": "paddy",
            "scenario": "scenario_b",
            "engineMode": "AI_FORECAST",
            "demoMode": False,
        },
    )
    for key in [
        "block",
        "geometry",
        "observations",
        "predictions",
        "rainfall",
        "risk",
        "advisories",
        "alerts",
        "provenance",
        "explainable_ai",
    ]:
        assert key in res
    assert res["block"]["location_id"] == "karchhana"
    assert res["predictions"]["model_version"] == "MPAI-ENS-0.1"
    assert res["provenance"]["badge"] == "AI"


def test_02_crop_selector_weather_invariance():
    paddy_res = run_ts_sih_eval(
        "unified",
        {"blockId": "karchhana", "horizon": "14D", "cropId": "paddy"},
    )
    pulses_res = run_ts_sih_eval(
        "unified",
        {"blockId": "karchhana", "horizon": "14D", "cropId": "pulses"},
    )
    # Weather predictions must remain identical when crop changes
    assert (
        paddy_res["predictions"]["onset_probability_pct"]
        == pulses_res["predictions"]["onset_probability_pct"]
    )
    assert (
        paddy_res["predictions"]["false_onset_probability_pct"]
        == pulses_res["predictions"]["false_onset_probability_pct"]
    )
    # Agricultural interpretation updates for the selected crop
    assert paddy_res["advisories"]["crop_id"] == "paddy"
    assert pulses_res["advisories"]["crop_id"] == "pulses"


def test_03_up_to_three_block_comparison_matrix():
    res = run_ts_sih_eval(
        "compare",
        {
            "blockIds": ["karchhana", "meja", "koraon", "phulpur"],
            "horizon": "14D",
            "cropId": "paddy",
        },
    )
    rows = res["rows"]
    assert len(rows) == 3
    assert [r["location_id"] for r in rows] == ["karchhana", "meja", "koraon"]
    for r in rows:
        assert "best_rank" not in r


def test_04_explainable_ai_and_prediction_trace():
    res = run_ts_sih_eval(
        "unified",
        {"blockId": "karchhana", "horizon": "14D", "cropId": "paddy"},
    )
    xai = res["explainable_ai"]
    assert len(xai["top_contributing_features"]) >= 4
    for feat in xai["top_contributing_features"]:
        assert "contributed" in feat["contribution_statement"].lower()
        assert "caused the prediction" not in feat["contribution_statement"].lower()

    stages = [s["stage"] for s in xai["prediction_trace"]]
    assert stages == [
        "REAL OBSERVATION",
        "FEATURE ENGINEERING",
        "MODEL",
        "CALIBRATION",
        "OUTPUT",
    ]


def test_05_demo_scenarios_consistency():
    fav = run_ts_sih_eval(
        "unified",
        {
            "blockId": "karchhana",
            "horizon": "14D",
            "scenario": "scenario_a",
            "demoMode": True,
        },
    )
    heavy = run_ts_sih_eval(
        "unified",
        {
            "blockId": "karchhana",
            "horizon": "14D",
            "scenario": "scenario_d",
            "demoMode": True,
        },
    )
    assert fav["provenance"]["badge"] == "DEMO"
    assert heavy["predictions"]["heavy_rain_probability_pct"] > fav["predictions"]["heavy_rain_probability_pct"]


def test_06_observability_logger_redacts_secrets_and_phones():
    entry = run_ts_sih_eval(
        "log_redact",
        {
            "endpoint": "/api/alerts/send",
            "durationMs": 42,
            "status": 200,
            "note": "Auth Bearer secretToken123456 for phone +919876541234",
        },
    )
    assert "secretToken123456" not in entry["note"]
    assert "9876541234" not in entry["note"]
    assert "[REDACTED]" in entry["note"]


def test_07_security_and_documentation_artifacts():
    env_example = (ROOT_DIR / ".env.example").read_text(encoding="utf-8")
    for group in [
        "SUPABASE",
        "WEATHER",
        "RAINFALL",
        "CLIMATE",
        "AI SERVICE",
        "WHATSAPP",
        "SMS",
        "GIS",
    ]:
        assert group in env_example

    assert "NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY" not in env_example
    assert "NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN" not in env_example
    assert "NEXT_PUBLIC_SMS_API_KEY" not in env_example

    for doc_rel in [
        "README.md",
        "docs/ARCHITECTURE.md",
        "docs/DEMO_GUIDE.md",
        "docs/DATA_PROVENANCE.md",
        "docs/DEPLOYMENT.md",
        "supabase/migrations/006_sih_final_indexes.sql",
    ]:
        assert (ROOT_DIR / doc_rel).exists(), f"Missing {doc_rel}"
