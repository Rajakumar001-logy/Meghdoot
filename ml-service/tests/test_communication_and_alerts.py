"""
Automated Unit & Integration Test Suite for Farmer Communication, Alert Delivery
& Officer Alert Center (ml-service/tests/test_communication_and_alerts.py)

Prompt 9 Section 36:
Verifies all 17 required scenarios against the actual TypeScript implementation:
1. alert generation from advisory
2. priority classification (CRITICAL, HIGH, MODERATE, LOW)
3. English message template generation
4. Hindi message template generation
5. farmer preferred language selection
6. multi-crop farmer advisory generation
7. alert deduplication
8. alert expiration
9. farmer consent disabled
10. phone number masking
11. unconfigured WhatsApp provider -> status = NOT_CONFIGURED
12. unconfigured SMS provider -> status = NOT_CONFIGURED
13. simulated delivery in Demo Mode -> SIMULATED DELIVERY
14. delivery log creation
15. mark alert as read
16. retry failed alert
17. bulk alert preview and confirmation requirement
"""

import json
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[2]


def run_ts_comm_action(action: str, payload: dict | None = None) -> dict:
    """
    Executes TypeScript communication & alert functions via Node/TypeScript
    transpilation to guarantee 100% fidelity with src/services/*.ts.
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

    const prioritySvc = require(path.join(rootDir, 'src/services/alertPriorityService.ts'));
    const msgGen = require(path.join(rootDir, 'src/services/messageGenerator.ts'));
    const waProvider = require(path.join(rootDir, 'src/services/providers/whatsappProvider.ts'));
    const smsProvider = require(path.join(rootDir, 'src/services/providers/smsProvider.ts'));
    const commEngine = require(path.join(rootDir, 'src/services/communicationEngine.ts'));

    const action = process.argv[1];
    const input = JSON.parse(process.argv[2] || '{}');

    (async () => {
      let out = {};
      if (action === 'priority') {
        out = prioritySvc.evaluateAlertPriority(input);
      } else if (action === 'message') {
        out = msgGen.generateStructuredFarmerMessage(input);
      } else if (action === 'mask_phone') {
        out = { masked: prioritySvc.maskPhoneNumber(input.phone) };
      } else if (action === 'whatsapp') {
        delete process.env.WHATSAPP_API_URL;
        delete process.env.WHATSAPP_ACCESS_TOKEN;
        out = await waProvider.sendWhatsAppMessage(input);
      } else if (action === 'sms') {
        delete process.env.SMS_API_URL;
        delete process.env.SMS_API_KEY;
        out = await smsProvider.sendSMSMessage(input);
      } else if (action === 'dispatch_single') {
        out = await commEngine.dispatchSingleAlert(input);
      } else if (action === 'multi_crop_farmer') {
        const farmer = commEngine.getFarmerById(input.farmerId);
        const alerts = commEngine.listCommunicationAlerts({ farmerId: input.farmerId });
        out = { farmer, alerts };
      } else if (action === 'dedup_test') {
        const first = await commEngine.dispatchSingleAlert(input);
        const second = await commEngine.dispatchSingleAlert(input);
        out = { first, second };
      } else if (action === 'mark_read') {
        const alerts = commEngine.listCommunicationAlerts();
        const targetId = alerts[0].id;
        const updated = commEngine.markCommunicationAlertRead(targetId, input.farmerResponse);
        out = { updated };
      } else if (action === 'retry_alert') {
        const alerts = commEngine.listCommunicationAlerts();
        const targetId = alerts[0].id;
        const retried = await commEngine.retryCommunicationAlert(targetId, true);
        const details = commEngine.getCommunicationAlertById(retried.alert.id);
        out = { retried, details };
      } else if (action === 'bulk_preview') {
        out = commEngine.previewBulkAlertOperation(input);
      }
      process.stdout.write(JSON.stringify(out));
    })();
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


# 1. Alert generation from advisory
def test_01_alert_generation_from_advisory():
    res = run_ts_comm_action(
        "dispatch_single",
        {
            "farmerId": "frm-101",
            "locationId": "karchhana",
            "cropId": "paddy",
            "cropStage": "sowing",
            "channel": "WhatsApp",
            "horizon": "14D",
            "simulate": True,
            "forceResend": True,
        },
    )
    assert res["success"] is True
    alert = res["alert"]
    assert alert is not None
    assert alert["location_id"] == "karchhana"
    assert alert["crop_id"] == "paddy"
    assert alert["model_version"] == "MPAI-ENS-0.1"
    assert alert["explainability"]["rule_id"].startswith("RULE-")


# 2. Priority classification (CRITICAL, HIGH, MODERATE, LOW)
def test_02_priority_classification_levels():
    crit = run_ts_comm_action(
        "priority",
        {"falseOnsetRisk": 0.78, "drySpellRisk": 0.40, "heavyRainRisk": 0.20},
    )
    assert crit["severity"] == "CRITICAL"

    crit_dry_soil = run_ts_comm_action(
        "priority",
        {
            "falseOnsetRisk": 0.30,
            "drySpellRisk": 0.72,
            "heavyRainRisk": 0.15,
            "soilMoistureLow": True,
        },
    )
    assert crit_dry_soil["severity"] == "CRITICAL"

    high = run_ts_comm_action(
        "priority",
        {"falseOnsetRisk": 0.64, "drySpellRisk": 0.50, "heavyRainRisk": 0.20},
    )
    assert high["severity"] == "HIGH"

    mod = run_ts_comm_action(
        "priority",
        {"falseOnsetRisk": 0.48, "drySpellRisk": 0.30, "heavyRainRisk": 0.20},
    )
    assert mod["severity"] == "MODERATE"

    low = run_ts_comm_action(
        "priority",
        {"falseOnsetRisk": 0.22, "drySpellRisk": 0.18, "heavyRainRisk": 0.10},
    )
    assert low["severity"] == "LOW"


# 3. English message template generation
def test_03_english_message_template_generation():
    res = run_ts_comm_action(
        "message",
        {
            "blockName": "Karchhana Block",
            "districtName": "Prayagraj",
            "cropName": "Paddy / Rice",
            "cropStage": "sowing",
            "language": "English",
            "horizon": "14D",
            "severity": "HIGH",
            "falseOnsetRiskPct": 68,
            "drySpellRiskPct": 62,
            "heavyRainRiskPct": 24,
        },
    )
    assert res["language"] == "English"
    assert res["containsForbiddenJargon"] is False
    fields = res["structuredFields"]
    assert "Karchhana" in fields["location"]
    assert "Paddy" in fields["crop"]
    assert "14D" in fields["forecastHorizon"]
    assert len(fields["recommendedAction"]) > 10
    assert len(fields["importantCaution"]) > 10
    assert "MonsoonPulse AI" in fields["sourceProvenance"]


# 4. Hindi message template generation
def test_04_hindi_message_template_generation():
    res = run_ts_comm_action(
        "message",
        {
            "blockName": "Karchhana Block",
            "districtName": "Prayagraj",
            "cropName": "Paddy",
            "cropStage": "sowing",
            "language": "Hindi",
            "horizon": "14D",
            "severity": "HIGH",
            "falseOnsetRiskPct": 68,
            "drySpellRiskPct": 62,
            "heavyRainRiskPct": 24,
        },
    )
    assert res["language"] == "Hindi"
    assert res["containsForbiddenJargon"] is False
    assert "मानसून" in res["message"]
    assert "धान" in res["message"]
    assert "सलाह:" in res["message"]
    assert "सावधानी:" in res["message"]


# 5. Farmer preferred language selection
def test_05_farmer_preferred_language_selection():
    # frm-101 prefers Hindi; frm-104 prefers English
    res_hi = run_ts_comm_action(
        "dispatch_single",
        {
            "farmerId": "frm-101",
            "locationId": "karchhana",
            "cropId": "paddy",
            "channel": "WhatsApp",
            "simulate": True,
            "forceResend": True,
        },
    )
    assert res_hi["alert"]["language"] == "Hindi"

    res_en = run_ts_comm_action(
        "dispatch_single",
        {
            "farmerId": "frm-104",
            "locationId": "soraon",
            "cropId": "paddy",
            "channel": "In-App",
            "simulate": True,
            "forceResend": True,
        },
    )
    assert res_en["alert"]["language"] == "English"


# 6. Multi-crop farmer advisory generation
def test_06_multi_crop_farmer_advisory_generation():
    res = run_ts_comm_action("multi_crop_farmer", {"farmerId": "frm-101"})
    farmer = res["farmer"]
    alerts = res["alerts"]
    crop_ids = {c["crop_id"] for c in farmer["crops"]}
    assert "paddy" in crop_ids
    assert "pulses" in crop_ids
    alert_crops = {a["crop_id"] for a in alerts if a["status"] != "EXPIRED"}
    assert "paddy" in alert_crops
    assert "pulses" in alert_crops


# 7. Alert deduplication
def test_07_alert_deduplication():
    res = run_ts_comm_action(
        "dedup_test",
        {
            "farmerId": "frm-102",
            "locationId": "phulpur",
            "cropId": "maize",
            "channel": "SMS",
            "simulate": True,
        },
    )
    # Second identical call without forceResend is suppressed by dedup_key
    assert res["second"]["duplicate_suppressed"] is True
    assert res["second"]["delivery_mode_badge"] == "DUPLICATE SUPPRESSED"


# 8. Alert expiration
def test_08_alert_expiration_blocks_active_send():
    res = run_ts_comm_action(
        "dispatch_single",
        {
            "farmerId": "frm-101",
            "locationId": "karchhana",
            "cropId": "paddy",
            "channel": "WhatsApp",
            "validUntilIso": "2020-01-01T00:00:00Z",
        },
    )
    assert res["success"] is False
    assert res["status"] == "EXPIRED"
    assert res["delivery_mode_badge"] == "EXPIRED"


# 9. Farmer consent disabled
def test_09_farmer_consent_disabled_blocks_send():
    # frm-105 has notification_enabled = false
    res = run_ts_comm_action(
        "dispatch_single",
        {
            "farmerId": "frm-105",
            "locationId": "koraon",
            "cropId": "soybean",
            "channel": "SMS",
        },
    )
    assert res["success"] is False
    assert res["status"] == "CANCELLED"
    assert res["reason"] == "Notifications disabled by farmer."


# 10. Phone number masking
def test_10_phone_number_masking():
    res = run_ts_comm_action("mask_phone", {"phone": "+919876541234"})
    assert res["masked"] == "+91 ******1234"
    assert "987654" not in res["masked"]


# 11. Unconfigured WhatsApp provider -> status = NOT_CONFIGURED
def test_11_unconfigured_whatsapp_provider():
    res = run_ts_comm_action(
        "whatsapp",
        {
            "recipientPhone": "+919451200084",
            "message": "Test advisory",
            "language": "Hindi",
            "alertId": "ALT-TEST-WA",
            "simulate": False,
        },
    )
    assert res["status"] == "NOT_CONFIGURED"
    assert res["delivery_label"] == "NOT_CONFIGURED"
    assert "not configured" in res["reason"].lower()


# 12. Unconfigured SMS provider -> status = NOT_CONFIGURED
def test_12_unconfigured_sms_provider():
    res = run_ts_comm_action(
        "sms",
        {
            "recipientPhone": "+919839000019",
            "message": "Test SMS advisory",
            "language": "Hindi",
            "alertId": "ALT-TEST-SMS",
            "simulate": False,
        },
    )
    assert res["status"] == "NOT_CONFIGURED"
    assert res["delivery_label"] == "NOT_CONFIGURED"
    assert "not configured" in res["reason"].lower()


# 13. Simulated delivery in Demo Mode -> SIMULATED DELIVERY
def test_13_simulated_delivery_in_demo_mode():
    res = run_ts_comm_action(
        "whatsapp",
        {
            "recipientPhone": "+919451200084",
            "message": "Simulated WhatsApp advisory",
            "language": "Hindi",
            "alertId": "ALT-SIM-01",
            "simulate": True,
        },
    )
    assert res["status"] == "SIMULATED"
    assert res["delivery_label"] == "SIMULATED DELIVERY"


# 14. Delivery log creation
def test_14_delivery_log_creation():
    res = run_ts_comm_action(
        "dispatch_single",
        {
            "farmerId": "frm-103",
            "locationId": "meja",
            "cropId": "pulses",
            "channel": "WhatsApp",
            "simulate": True,
            "forceResend": True,
        },
    )
    log = res["delivery_log"]
    assert log is not None
    assert log["alert_id"] == res["alert"]["id"]
    assert log["status"] == "SIMULATED"
    assert log["request_timestamp"] is not None
    assert log["response_timestamp"] is not None


# 15. Mark alert as read
def test_15_mark_alert_as_read():
    res = run_ts_comm_action(
        "mark_read", {"farmerResponse": "ACTION_TAKEN"}
    )
    updated = res["updated"]
    assert updated["read"] is True
    assert updated["status"] == "READ"
    assert updated["farmer_response"] == "ACTION_TAKEN"


# 16. Retry failed/existing alert
def test_16_retry_alert():
    res = run_ts_comm_action("retry_alert")
    retried = res["retried"]
    assert retried["success"] is True
    assert retried["alert"] is not None
    assert len(res["details"]["deliveryLogs"]) >= 1


# 17. Bulk alert preview and confirmation requirement
def test_17_bulk_alert_preview_and_confirmation_requirement():
    preview = run_ts_comm_action(
        "bulk_preview",
        {
            "locationId": "karchhana",
            "cropId": "paddy",
            "channel": "WhatsApp",
            "language": "Hindi",
            "horizon": "14D",
        },
    )
    assert preview["confirmation_required"] is True
    assert preview["recipient_count"] >= 1
    assert preview["consent_blocked_count"] >= 0
    assert "Karchhana" in preview["block_name"]
    for f in preview["eligible_farmers"]:
        assert f["masked_phone"].startswith("+91 ******")
