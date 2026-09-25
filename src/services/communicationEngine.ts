import {
  AdvisorySignalSource,
  AlertDeliveryLogRecord,
  AlertLifecycleStatus,
  AlertPriorityLevel,
  CommunicationAlertRecord,
  CommunicationChannel,
  CropStageId,
  FarmerCommunicationProfile,
  FarmerResponseOption,
} from "@/types/communication";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";
import { MOCK_BLOCKS } from "@/data/mockData";
import { evaluateCropAdvisories } from "./advisoryEngine";
import {
  buildAlertDedupKey,
  checkDispatchRateLimit,
  evaluateAlertPriority,
  isAlertExpired,
  maskPhoneNumber,
  verifyFarmerConsent,
} from "./alertPriorityService";
import { generateStructuredFarmerMessage } from "./messageGenerator";
import { sendWhatsAppMessage } from "./providers/whatsappProvider";
import { sendSMSMessage } from "./providers/smsProvider";
import { SupportedCropId } from "@/types/advisory";
import { CROP_PROFILES } from "@/config/advisoryRules";

const RAW_FARMER_PHONES: Record<string, string> = {
  "frm-101": "+919451200084",
  "frm-102": "+919839000019",
  "frm-103": "+918765400062",
  "frm-104": "+919125600041",
  "frm-105": "+919415300007",
};

function resolveSupportedCropId(cropId: string): SupportedCropId {
  const clean = (cropId || "paddy").toLowerCase().trim();
  if (clean in CROP_PROFILES) return clean as SupportedCropId;
  if (clean === "millets") return "maize";
  return "paddy";
}

const SEEDED_FARMER_PROFILES: FarmerCommunicationProfile[] = [
  {
    id: "frm-101",
    name: "Ramesh Chandra Patel",
    hindi_name: "रमेश चंद्र पटेल",
    masked_phone: maskPhoneNumber(RAW_FARMER_PHONES["frm-101"]),
    raw_phone_last4: "0084",
    preferred_language: "Hindi",
    location_id: "karchhana",
    block_name: "Karchhana Block",
    panchayat_name: "Bhita Gram Panchayat",
    preferred_channel: "WhatsApp",
    notification_enabled: true,
    active: true,
    land_size_acres: 3.5,
    crops: [
      {
        id: "fc-101-paddy",
        farmer_id: "frm-101",
        crop_id: "paddy",
        crop_name: "Paddy / Rice",
        hindi_crop_name: "धान (Paddy)",
        crop_stage: "sowing",
        sowing_date: "2026-06-15",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-12T08:00:00Z",
      },
      {
        id: "fc-101-pulses",
        farmer_id: "frm-101",
        crop_id: "pulses",
        crop_name: "Pulses (Arhar / Urad / Moong)",
        hindi_crop_name: "दलहन - अरहर/उड़द/मूंग",
        crop_stage: "sowing",
        sowing_date: "2026-06-18",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-12T08:00:00Z",
      },
    ],
    created_at: "2026-05-15T08:00:00Z",
    updated_at: "2026-06-12T08:15:00Z",
  },
  {
    id: "frm-102",
    name: "Sukhdev Prasad Maurya",
    hindi_name: "सुखदेव प्रसाद मौर्य",
    masked_phone: maskPhoneNumber(RAW_FARMER_PHONES["frm-102"]),
    raw_phone_last4: "0019",
    preferred_language: "Hindi",
    location_id: "phulpur",
    block_name: "Phulpur Block",
    panchayat_name: "Mailahan Panchayat",
    preferred_channel: "SMS",
    notification_enabled: true,
    active: true,
    land_size_acres: 2.2,
    crops: [
      {
        id: "fc-102-paddy",
        farmer_id: "frm-102",
        crop_id: "paddy",
        crop_name: "Paddy / Rice",
        hindi_crop_name: "धान (Paddy)",
        crop_stage: "nursery",
        sowing_date: "2026-06-10",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-12T08:00:00Z",
      },
      {
        id: "fc-102-maize",
        farmer_id: "frm-102",
        crop_id: "maize",
        crop_name: "Maize",
        hindi_crop_name: "मक्का (Maize)",
        crop_stage: "sowing",
        sowing_date: "2026-06-16",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-12T08:00:00Z",
      },
    ],
    created_at: "2026-05-15T08:00:00Z",
    updated_at: "2026-06-12T08:12:00Z",
  },
  {
    id: "frm-103",
    name: "Smt. Kavita Devi Bind",
    hindi_name: "श्रीमती कविता देवी बिंद",
    masked_phone: maskPhoneNumber(RAW_FARMER_PHONES["frm-103"]),
    raw_phone_last4: "0062",
    preferred_language: "Hindi",
    location_id: "meja",
    block_name: "Meja Block",
    panchayat_name: "Sirsa Gram Panchayat",
    preferred_channel: "WhatsApp",
    notification_enabled: true,
    active: true,
    land_size_acres: 4.0,
    crops: [
      {
        id: "fc-103-pulses",
        farmer_id: "frm-103",
        crop_id: "pulses",
        crop_name: "Pulses (Arhar / Urad / Moong)",
        hindi_crop_name: "दलहन - अरहर/उड़द/मूंग",
        crop_stage: "sowing",
        sowing_date: "2026-06-14",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-12T08:00:00Z",
      },
      {
        id: "fc-103-soybean",
        farmer_id: "frm-103",
        crop_id: "soybean",
        crop_name: "Soybean",
        hindi_crop_name: "सोयाबीन (Soybean)",
        crop_stage: "vegetative",
        sowing_date: "2026-06-05",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-12T08:00:00Z",
      },
    ],
    created_at: "2026-05-15T08:00:00Z",
    updated_at: "2026-06-11T17:30:00Z",
  },
  {
    id: "frm-104",
    name: "Brijesh Kumar Yadav",
    hindi_name: "बृजेश कुमार यादव",
    masked_phone: maskPhoneNumber(RAW_FARMER_PHONES["frm-104"]),
    raw_phone_last4: "0041",
    preferred_language: "English",
    location_id: "soraon",
    block_name: "Soraon Block",
    panchayat_name: "Mewalal Baghiya",
    preferred_channel: "In-App",
    notification_enabled: true,
    active: true,
    land_size_acres: 5.1,
    crops: [
      {
        id: "fc-104-paddy",
        farmer_id: "frm-104",
        crop_id: "paddy",
        crop_name: "Paddy / Rice",
        hindi_crop_name: "धान (Paddy)",
        crop_stage: "vegetative",
        sowing_date: "2026-06-01",
        created_at: "2026-05-25T08:00:00Z",
        updated_at: "2026-06-12T09:00:00Z",
      },
      {
        id: "fc-104-cotton",
        farmer_id: "frm-104",
        crop_id: "cotton",
        crop_name: "Cotton",
        hindi_crop_name: "कपास (Cotton)",
        crop_stage: "vegetative",
        sowing_date: "2026-05-28",
        created_at: "2026-05-25T08:00:00Z",
        updated_at: "2026-06-12T09:00:00Z",
      },
    ],
    created_at: "2026-05-15T08:00:00Z",
    updated_at: "2026-06-12T09:00:00Z",
  },
  {
    id: "frm-105",
    name: "Harishankar Shukla",
    hindi_name: "हरिशंकर शुक्ला",
    masked_phone: maskPhoneNumber(RAW_FARMER_PHONES["frm-105"]),
    raw_phone_last4: "0007",
    preferred_language: "Hindi",
    location_id: "koraon",
    block_name: "Koraon Block",
    panchayat_name: "Mahuli Gram Panchayat",
    preferred_channel: "SMS",
    notification_enabled: false,
    active: true,
    land_size_acres: 6.4,
    crops: [
      {
        id: "fc-105-soybean",
        farmer_id: "frm-105",
        crop_id: "soybean",
        crop_name: "Soybean",
        hindi_crop_name: "सोयाबीन (Soybean)",
        crop_stage: "sowing",
        sowing_date: "2026-06-16",
        created_at: "2026-06-01T08:00:00Z",
        updated_at: "2026-06-11T16:00:00Z",
      },
    ],
    created_at: "2026-05-15T08:00:00Z",
    updated_at: "2026-06-11T16:00:00Z",
  },
];

const runtimeAlertsMap = new Map<string, CommunicationAlertRecord>();
const runtimeDedupIndex = new Map<string, string>();
const runtimeDeliveryLogsMap = new Map<string, AlertDeliveryLogRecord[]>();
let storeInitialized = false;

function buildInitialAlerts(): void {
  if (storeInitialized) return;
  storeInitialized = true;

  const forecastIssueTime = "2026-06-12T06:00:00Z";
  const observationCutoff = "2026-06-12T05:30:00Z";
  const activeExpiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const expiredAt = new Date(Date.now() - 12 * 3600 * 1000).toISOString();

  for (const farmer of SEEDED_FARMER_PROFILES) {
    const block =
      MOCK_BLOCKS.find((b) => b.id === farmer.location_id) || MOCK_BLOCKS[0];

    for (const cropAssignment of farmer.crops) {
      const supportedCrop = resolveSupportedCropId(cropAssignment.crop_id);
      const advisorySuite = evaluateCropAdvisories({
        location_id: block.id,
        block_name: block.name,
        district: block.district,
        state: block.state,
        crop_id: supportedCrop,
        forecast_horizon: "14D",
        horizon_days: 14,
        crop_stage: cropAssignment.crop_stage,
        current_rainfall: 18.4,
        recent_rainfall: Math.round(block.expectedRainfall * 0.22),
        rainfall_anomaly: block.rainfallAnomaly,
        temperature: 30.2,
        humidity: 78,
        soil_moisture: block.soilMoisture,
        onset_probability: block.onsetProbability / 100.0,
        false_onset_probability: block.falseOnsetProbability / 100.0,
        dry_spell_probability: block.drySpellProbability / 100.0,
        heavy_rain_probability: block.heavyRainProbability / 100.0,
        expected_rainfall: block.expectedRainfall,
        model_version: "MPAI-ENS-0.1",
        observation_cutoff: observationCutoff,
        prediction_issued_at: forecastIssueTime,
        prediction_valid_until: activeExpiresAt,
        source_mode: "AI",
      });

      const primaryAdv = advisorySuite.active_advisories[0];
      const priorityEval = evaluateAlertPriority({
        falseOnsetRisk: block.falseOnsetProbability,
        drySpellRisk: block.drySpellProbability,
        heavyRainRisk: block.heavyRainProbability,
        soilMoisturePct: block.soilMoisture,
      });

      const msgBundle = generateStructuredFarmerMessage({
        blockName: block.name,
        districtName: block.district,
        cropName: cropAssignment.crop_name,
        hindiCropName: cropAssignment.hindi_crop_name,
        cropStage: cropAssignment.crop_stage,
        preferredLanguage: farmer.preferred_language,
        horizon: "14D",
        severity: priorityEval.severity,
        falseOnsetRiskPct: block.falseOnsetProbability,
        drySpellRiskPct: block.drySpellProbability,
        heavyRainRiskPct: block.heavyRainProbability,
        expectedDrySpellDays: block.expectedDrySpellDays,
        recommendedActionEn: primaryAdv?.en?.action,
        recommendedActionHi: primaryAdv?.hi?.action,
        signalSource: "AI_FORECAST",
        modelVersion: "MPAI-ENS-0.1",
        channel: farmer.preferred_channel,
      });

      const advisoryId =
        primaryAdv?.id || `ADV-${block.id}-${cropAssignment.crop_id}`;
      const dedupKey = buildAlertDedupKey({
        farmerId: farmer.id,
        advisoryId,
        forecastIssueTime,
        channel: farmer.preferred_channel,
      });

      const alertId = `ALT-${farmer.id.toUpperCase()}-${cropAssignment.crop_id.toUpperCase()}-14D`;
      const isConsentBlocked = !farmer.notification_enabled;

      const status: AlertLifecycleStatus = isConsentBlocked
        ? "CANCELLED"
        : farmer.preferred_channel === "In-App"
        ? "DELIVERED"
        : "SIMULATED";

      const badge = isConsentBlocked
        ? "CONSENT BLOCKED"
        : farmer.preferred_channel === "In-App"
        ? "IN-APP DELIVERED"
        : "SIMULATED DELIVERY";

      const record: CommunicationAlertRecord = {
        id: alertId,
        farmer_id: farmer.id,
        farmer_name: farmer.name,
        masked_phone: farmer.masked_phone,
        location_id: block.id,
        block_name: block.name,
        crop_id: cropAssignment.crop_id,
        crop_name: cropAssignment.crop_name,
        crop_stage: cropAssignment.crop_stage,
        advisory_id: advisoryId,
        alert_type: primaryAdv?.rule_id || "RULE-MONSOON-001",
        severity: priorityEval.severity,
        title: msgBundle.title,
        message: msgBundle.message,
        language: msgBundle.language,
        channel: farmer.preferred_channel,
        status,
        delivery_mode_badge: badge,
        dedup_key: dedupKey,
        model_version: "MPAI-ENS-0.1",
        forecast_horizon: "14D",
        signal_source: "AI_FORECAST",
        confidence_tier: "MODERATE",
        observation_cutoff: observationCutoff,
        forecast_issue_time: forecastIssueTime,
        created_at: "2026-06-12T08:15:00Z",
        sent_at: isConsentBlocked ? null : "2026-06-12T08:15:05Z",
        expires_at: activeExpiresAt,
        read: false,
        farmer_response: farmer.id === "frm-101" ? "READ_ACKNOWLEDGED" : null,
        explainability: {
          block_name: block.name,
          crop_name: cropAssignment.crop_name,
          crop_stage: cropAssignment.crop_stage,
          false_onset_risk_pct: block.falseOnsetProbability,
          dry_spell_risk_pct: block.drySpellProbability,
          heavy_rain_risk_pct: block.heavyRainProbability,
          soil_moisture_pct: block.soilMoisture,
          cumulative_rain_7d_mm: Math.round(block.expectedRainfall * 0.22),
          rule_id: primaryAdv?.rule_id || "RULE-MONSOON-001",
          rule_triggered: priorityEval.triggeredCondition,
          recommended_action:
            primaryAdv?.en?.action ||
            msgBundle.structuredFields.recommendedAction,
          why_receiving_points: [
            `Location matches your registered block (${block.name}, Prayagraj).`,
            `Crop matches your registered farm profile (${cropAssignment.crop_name} — ${cropAssignment.crop_stage} stage).`,
            `Monsoon risk threshold crossed: ${priorityEval.triggeredCondition}.`,
          ],
        },
      };

      runtimeAlertsMap.set(alertId, record);
      runtimeDedupIndex.set(dedupKey, alertId);
      runtimeDeliveryLogsMap.set(alertId, [
        {
          id: `LOG-${alertId}-1`,
          alert_id: alertId,
          provider: isConsentBlocked
            ? "CONSENT_GATE"
            : `${farmer.preferred_channel.toUpperCase()}_DEMO_SIMULATOR`,
          request_timestamp: "2026-06-12T08:15:02Z",
          response_timestamp: "2026-06-12T08:15:05Z",
          provider_message_id: isConsentBlocked ? null : `sim-${alertId}`,
          status,
          error_code: isConsentBlocked ? "NOTIFICATIONS_DISABLED" : null,
          error_message: isConsentBlocked
            ? "Notifications disabled by farmer."
            : null,
        },
      ]);
    }
  }

  // Historical EXPIRED alert for Officer Alert Center inspection
  const expiredAlertId = "ALT-HIST-EXPIRED-001";
  runtimeAlertsMap.set(expiredAlertId, {
    id: expiredAlertId,
    farmer_id: "frm-101",
    farmer_name: "Ramesh Chandra Patel",
    masked_phone: maskPhoneNumber(RAW_FARMER_PHONES["frm-101"]),
    location_id: "karchhana",
    block_name: "Karchhana Block",
    crop_id: "paddy",
    crop_name: "Paddy / Rice",
    crop_stage: "nursery",
    advisory_id: "ADV-KARCHHANA-PADDY-HIST",
    alert_type: "RULE-PADDY-001",
    severity: "HIGH",
    title: "मानसून सलाह (Karchhana • धान (Paddy)) [EXPIRED]",
    message:
      "🌾 मानसून कृषि सलाह — Karchhana ब्लॉक, Prayagraj\nफसल: धान (Paddy) (नर्सरी चरण)\nस्थिति: पिछला पूर्वानुमान चक्र समाप्त हो चुका है।\nअवधि: अगले 7 दिन (7D)\nसलाह: नवीनतम 14D सलाह देखें।\nसावधानी: पुरानी सलाह पर बुवाई निर्णय न लें।\nस्रोत: MonsoonPulse AI कृषि सलाह",
    language: "Hindi",
    channel: "WhatsApp",
    status: "EXPIRED",
    delivery_mode_badge: "EXPIRED",
    dedup_key: "frm-101:adv-karchhana-paddy-hist:2026-06-05:whatsapp",
    model_version: "MPAI-ENS-0.1",
    forecast_horizon: "7D",
    signal_source: "AI_FORECAST",
    confidence_tier: "MODERATE",
    observation_cutoff: "2026-06-05T05:30:00Z",
    forecast_issue_time: "2026-06-05T06:00:00Z",
    created_at: "2026-06-05T08:00:00Z",
    sent_at: "2026-06-05T08:01:00Z",
    expires_at: expiredAt,
    read: true,
    farmer_response: null,
    explainability: {
      block_name: "Karchhana Block",
      crop_name: "Paddy / Rice",
      crop_stage: "nursery",
      false_onset_risk_pct: 64,
      dry_spell_risk_pct: 61,
      heavy_rain_risk_pct: 22,
      soil_moisture_pct: 31,
      cumulative_rain_7d_mm: 12,
      rule_id: "RULE-PADDY-001",
      rule_triggered: "false_onset_risk (64%) >= 60%",
      recommended_action: "Superseded by newer forecast cycle.",
      why_receiving_points: [
        "Historical advisory validity window has elapsed (valid_until < current_time).",
      ],
    },
  });
}

export function getRegisteredFarmers(
  locationId?: string
): FarmerCommunicationProfile[] {
  buildInitialAlerts();
  if (!locationId || locationId === "all") {
    return SEEDED_FARMER_PROFILES;
  }
  return SEEDED_FARMER_PROFILES.filter((f) => f.location_id === locationId);
}

export function getFarmerById(
  farmerId: string
): FarmerCommunicationProfile | undefined {
  buildInitialAlerts();
  return SEEDED_FARMER_PROFILES.find((f) => f.id === farmerId);
}

export function updateFarmerConsentPreference(
  farmerId: string,
  notificationEnabled: boolean
): FarmerCommunicationProfile | null {
  buildInitialAlerts();
  const farmer = SEEDED_FARMER_PROFILES.find((f) => f.id === farmerId);
  if (!farmer) return null;
  farmer.notification_enabled = notificationEnabled;
  farmer.updated_at = new Date().toISOString();
  return farmer;
}

export interface ListAlertsFilter {
  locationId?: string;
  cropId?: string;
  alertType?: string;
  severity?: AlertPriorityLevel | "ALL";
  language?: FarmerLanguage | "ALL";
  channel?: CommunicationChannel | "ALL";
  status?: AlertLifecycleStatus | "ALL" | "UNREAD";
  farmerId?: string;
}

export function listCommunicationAlerts(
  filter: ListAlertsFilter = {}
): CommunicationAlertRecord[] {
  buildInitialAlerts();
  const now = new Date();
  const all = Array.from(runtimeAlertsMap.values()).map((item) => {
    if (item.status !== "EXPIRED" && isAlertExpired(item.expires_at, now)) {
      const updated: CommunicationAlertRecord = {
        ...item,
        status: "EXPIRED",
        delivery_mode_badge: "EXPIRED",
      };
      runtimeAlertsMap.set(item.id, updated);
      return updated;
    }
    return item;
  });

  return all
    .filter((a) => {
      if (
        filter.locationId &&
        filter.locationId !== "all" &&
        a.location_id !== filter.locationId
      ) {
        return false;
      }
      if (
        filter.cropId &&
        filter.cropId !== "all" &&
        a.crop_id !== filter.cropId
      ) {
        return false;
      }
      if (
        filter.alertType &&
        filter.alertType !== "all" &&
        a.alert_type !== filter.alertType
      ) {
        return false;
      }
      if (
        filter.severity &&
        filter.severity !== "ALL" &&
        a.severity !== filter.severity
      ) {
        return false;
      }
      if (
        filter.language &&
        filter.language !== "ALL" &&
        a.language !== filter.language
      ) {
        return false;
      }
      if (
        filter.channel &&
        filter.channel !== "ALL" &&
        a.channel !== filter.channel
      ) {
        return false;
      }
      if (filter.status && filter.status !== "ALL") {
        if (filter.status === "UNREAD") {
          if (a.read) return false;
        } else if (a.status !== filter.status) {
          return false;
        }
      }
      if (filter.farmerId && a.farmer_id !== filter.farmerId) {
        return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
}

export function getCommunicationAlertById(
  alertId: string
): {
  alert: CommunicationAlertRecord | null;
  deliveryLogs: AlertDeliveryLogRecord[];
} {
  buildInitialAlerts();
  const alert = runtimeAlertsMap.get(alertId) || null;
  if (alert && alert.status !== "EXPIRED" && isAlertExpired(alert.expires_at)) {
    alert.status = "EXPIRED";
    alert.delivery_mode_badge = "EXPIRED";
  }
  const deliveryLogs = runtimeDeliveryLogsMap.get(alertId) || [];
  return { alert, deliveryLogs };
}

export function markCommunicationAlertRead(
  alertId: string,
  farmerResponse?: FarmerResponseOption
): CommunicationAlertRecord | null {
  buildInitialAlerts();
  const alert = runtimeAlertsMap.get(alertId);
  if (!alert) return null;
  alert.read = true;
  if (alert.status === "DELIVERED" || alert.status === "SIMULATED") {
    alert.status = "READ";
  }
  if (farmerResponse) {
    alert.farmer_response = farmerResponse;
  }
  runtimeAlertsMap.set(alertId, alert);
  return alert;
}

export interface SendSingleAlertParams {
  farmerId?: string;
  locationId: string;
  cropId: string;
  cropStage?: CropStageId;
  channel: CommunicationChannel;
  language?: FarmerLanguage;
  horizon?: ForecastHorizon;
  signalSource?: AdvisorySignalSource;
  simulate?: boolean;
  forceResend?: boolean;
  validUntilIso?: string;
}

export interface SendSingleAlertResult {
  success: boolean;
  status: AlertLifecycleStatus;
  delivery_mode_badge: CommunicationAlertRecord["delivery_mode_badge"];
  reason: string;
  duplicate_suppressed: boolean;
  alert: CommunicationAlertRecord | null;
  delivery_log: AlertDeliveryLogRecord | null;
}

export async function dispatchSingleAlert(
  params: SendSingleAlertParams
): Promise<SendSingleAlertResult> {
  buildInitialAlerts();

  const farmer = params.farmerId
    ? SEEDED_FARMER_PROFILES.find((f) => f.id === params.farmerId)
    : SEEDED_FARMER_PROFILES.find((f) => f.location_id === params.locationId) ||
      SEEDED_FARMER_PROFILES[0];

  const block =
    MOCK_BLOCKS.find((b) => b.id === params.locationId) || MOCK_BLOCKS[0];
  const horizon = params.horizon || "14D";
  const horizonDays =
    horizon === "7D" ? 7 : horizon === "14D" ? 14 : horizon === "21D" ? 21 : 30;
  const signalSource = params.signalSource || "AI_FORECAST";

  // 1. Check Farmer Consent Gate (Section 25)
  if (farmer) {
    const consent = verifyFarmerConsent(farmer);
    if (!consent.allowed) {
      return {
        success: false,
        status: "CANCELLED",
        delivery_mode_badge: "CONSENT BLOCKED",
        reason: consent.reason,
        duplicate_suppressed: false,
        alert: null,
        delivery_log: null,
      };
    }
  }

  // 2. Check Expiration / Stale Advisory Gate (Section 19)
  const expiresAt =
    params.validUntilIso ||
    new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  if (isAlertExpired(expiresAt)) {
    return {
      success: false,
      status: "EXPIRED",
      delivery_mode_badge: "EXPIRED",
      reason:
        "Advisory validity window has expired (valid_until < current_time). Stale alerts cannot be sent as active.",
      duplicate_suppressed: false,
      alert: null,
      delivery_log: null,
    };
  }

  // 3. Evaluate Advisory & Priority
  const cropStage: CropStageId = params.cropStage || "sowing";
  const supportedCrop = resolveSupportedCropId(params.cropId);
  const forecastIssueTime = "2026-06-12T06:00:00Z";
  const observationCutoff = "2026-06-12T05:30:00Z";

  const advisorySuite = evaluateCropAdvisories({
    location_id: block.id,
    block_name: block.name,
    district: block.district,
    state: block.state,
    crop_id: supportedCrop,
    forecast_horizon: horizon,
    horizon_days: horizonDays,
    crop_stage: cropStage,
    current_rainfall: 18.4,
    recent_rainfall: Math.round(block.expectedRainfall * 0.22),
    rainfall_anomaly: block.rainfallAnomaly,
    temperature: 30.2,
    humidity: 78,
    soil_moisture: block.soilMoisture,
    onset_probability: block.onsetProbability / 100.0,
    false_onset_probability: block.falseOnsetProbability / 100.0,
    dry_spell_probability: block.drySpellProbability / 100.0,
    heavy_rain_probability: block.heavyRainProbability / 100.0,
    expected_rainfall: block.expectedRainfall,
    model_version: "MPAI-ENS-0.1",
    observation_cutoff: observationCutoff,
    prediction_issued_at: forecastIssueTime,
    prediction_valid_until: expiresAt,
    source_mode: signalSource === "AI_FORECAST" ? "AI" : "SIMULATED",
  });

  const primaryAdv = advisorySuite.active_advisories[0];
  const priorityEval = evaluateAlertPriority({
    falseOnsetRisk: block.falseOnsetProbability,
    drySpellRisk: block.drySpellProbability,
    heavyRainRisk: block.heavyRainProbability,
    soilMoisturePct: block.soilMoisture,
  });

  const advisoryId =
    primaryAdv?.id || `ADV-${block.id}-${params.cropId}-${horizon}`;
  const dedupKey = buildAlertDedupKey({
    farmerId: farmer?.id || `block-${block.id}`,
    advisoryId,
    forecastIssueTime,
    channel: params.channel,
  });

  // 4. Deduplication Check (Section 18)
  if (!params.forceResend && runtimeDedupIndex.has(dedupKey)) {
    const existingId = runtimeDedupIndex.get(dedupKey)!;
    const existingAlert = runtimeAlertsMap.get(existingId) || null;
    return {
      success: false,
      status: existingAlert?.status || "SIMULATED",
      delivery_mode_badge: "DUPLICATE SUPPRESSED",
      reason: `Duplicate alert suppressed (dedup_key=${dedupKey}). Use explicit retry/resend to override.`,
      duplicate_suppressed: true,
      alert: existingAlert,
      delivery_log: null,
    };
  }

  // 5. Rate Limit Check (Section 28)
  const rateCheck = checkDispatchRateLimit({
    farmerId: farmer?.id || `block-${block.id}`,
  });
  if (!rateCheck.allowed) {
    return {
      success: false,
      status: "CANCELLED",
      delivery_mode_badge: "CONSENT BLOCKED",
      reason: rateCheck.reason,
      duplicate_suppressed: false,
      alert: null,
      delivery_log: null,
    };
  }

  // 6. Generate Structured Farmer Message in Farmer Preferred Language (or manual override)
  const preferredLang =
    params.language || farmer?.preferred_language || "Hindi";
  const cropNameDisplay =
    advisorySuite.crop_profile?.name || params.cropId.toUpperCase();

  const msgBundle = generateStructuredFarmerMessage({
    blockName: block.name,
    districtName: block.district,
    cropName: cropNameDisplay,
    cropStage,
    preferredLanguage: preferredLang,
    language: preferredLang,
    horizon,
    severity: priorityEval.severity,
    falseOnsetRiskPct: block.falseOnsetProbability,
    drySpellRiskPct: block.drySpellProbability,
    heavyRainRiskPct: block.heavyRainProbability,
    expectedDrySpellDays: block.expectedDrySpellDays,
    recommendedActionEn: primaryAdv?.en?.action,
    recommendedActionHi: primaryAdv?.hi?.action,
    signalSource,
    modelVersion: "MPAI-ENS-0.1",
    channel: params.channel,
  });

  const alertId = `ALT-${Date.now()}-${Math.floor(100 + Math.random() * 899)}`;
  const rawPhone = farmer
    ? RAW_FARMER_PHONES[farmer.id] || "+919451200084"
    : "+919451200084";

  // 7. Dispatch via Provider Abstraction
  let finalStatus: AlertLifecycleStatus = "GENERATED";
  let deliveryBadge: CommunicationAlertRecord["delivery_mode_badge"] =
    "SIMULATED DELIVERY";
  let logEntry: AlertDeliveryLogRecord;

  if (params.channel === "In-App" || params.channel === "Dashboard") {
    finalStatus = "DELIVERED";
    deliveryBadge = "IN-APP DELIVERED";
    const nowIso = new Date().toISOString();
    logEntry = {
      id: `LOG-${alertId}`,
      alert_id: alertId,
      provider: "IN_APP_NOTIFICATION_CENTER",
      request_timestamp: nowIso,
      response_timestamp: nowIso,
      provider_message_id: `inapp-${alertId}`,
      status: "DELIVERED",
      error_code: null,
      error_message: null,
    };
  } else if (params.channel === "WhatsApp") {
    const waRes = await sendWhatsAppMessage({
      recipientPhone: rawPhone,
      message: msgBundle.message,
      language: msgBundle.language,
      alertId,
      simulate: params.simulate,
    });
    finalStatus = waRes.status;
    deliveryBadge =
      waRes.status === "NOT_CONFIGURED"
        ? "NOT_CONFIGURED"
        : waRes.status === "SIMULATED"
        ? "SIMULATED DELIVERY"
        : "PROVIDER DELIVERED";
    logEntry = {
      id: `LOG-${alertId}`,
      alert_id: alertId,
      provider: waRes.provider,
      request_timestamp: waRes.request_timestamp,
      response_timestamp: waRes.response_timestamp,
      provider_message_id: waRes.provider_message_id,
      status: waRes.status,
      error_code: waRes.error_code || null,
      error_message:
        waRes.status === "NOT_CONFIGURED" || waRes.status === "FAILED"
          ? waRes.reason
          : null,
    };
  } else {
    const smsRes = await sendSMSMessage({
      recipientPhone: rawPhone,
      message: msgBundle.message,
      language: msgBundle.language,
      alertId,
      simulate: params.simulate,
    });
    finalStatus = smsRes.status;
    deliveryBadge =
      smsRes.status === "NOT_CONFIGURED"
        ? "NOT_CONFIGURED"
        : smsRes.status === "SIMULATED"
        ? "SIMULATED DELIVERY"
        : "PROVIDER DELIVERED";
    logEntry = {
      id: `LOG-${alertId}`,
      alert_id: alertId,
      provider: smsRes.provider,
      request_timestamp: smsRes.request_timestamp,
      response_timestamp: smsRes.response_timestamp,
      provider_message_id: smsRes.provider_message_id,
      status: smsRes.status,
      error_code: smsRes.error_code || null,
      error_message:
        smsRes.status === "NOT_CONFIGURED" || smsRes.status === "FAILED"
          ? smsRes.reason
          : null,
    };
  }

  const nowIso = new Date().toISOString();
  const alertRecord: CommunicationAlertRecord = {
    id: alertId,
    farmer_id: farmer?.id || null,
    farmer_name: farmer?.name || `${block.name} Farmers`,
    masked_phone: maskPhoneNumber(rawPhone),
    location_id: block.id,
    block_name: block.name,
    crop_id: params.cropId,
    crop_name: cropNameDisplay,
    crop_stage: cropStage,
    advisory_id: advisoryId,
    alert_type: primaryAdv?.rule_id || "RULE-MONSOON-001",
    severity: priorityEval.severity,
    title: msgBundle.title,
    message: msgBundle.message,
    language: msgBundle.language,
    channel: params.channel,
    status: finalStatus,
    delivery_mode_badge: deliveryBadge,
    dedup_key: dedupKey,
    model_version: "MPAI-ENS-0.1",
    forecast_horizon: horizon,
    signal_source: signalSource,
    confidence_tier: "MODERATE",
    observation_cutoff: observationCutoff,
    forecast_issue_time: forecastIssueTime,
    created_at: nowIso,
    sent_at:
      finalStatus === "SENT" ||
      finalStatus === "DELIVERED" ||
      finalStatus === "SIMULATED"
        ? nowIso
        : null,
    expires_at: expiresAt,
    read: false,
    farmer_response: null,
    explainability: {
      block_name: block.name,
      crop_name: cropNameDisplay,
      crop_stage: cropStage,
      false_onset_risk_pct: block.falseOnsetProbability,
      dry_spell_risk_pct: block.drySpellProbability,
      heavy_rain_risk_pct: block.heavyRainProbability,
      soil_moisture_pct: block.soilMoisture,
      cumulative_rain_7d_mm: Math.round(block.expectedRainfall * 0.22),
      rule_id: primaryAdv?.rule_id || "RULE-MONSOON-001",
      rule_triggered: priorityEval.triggeredCondition,
      recommended_action:
        primaryAdv?.en?.action || msgBundle.structuredFields.recommendedAction,
      why_receiving_points: [
        `Location matches ${block.name}, Prayagraj.`,
        `Crop matches ${cropNameDisplay} (${cropStage} stage).`,
        `Triggered rule ${primaryAdv?.rule_id || "RULE-MONSOON-001"}: ${priorityEval.triggeredCondition}.`,
      ],
    },
  };

  runtimeAlertsMap.set(alertId, alertRecord);
  runtimeDedupIndex.set(dedupKey, alertId);
  runtimeDeliveryLogsMap.set(alertId, [logEntry]);

  return {
    success:
      finalStatus === "SENT" ||
      finalStatus === "DELIVERED" ||
      finalStatus === "SIMULATED" ||
      finalStatus === "NOT_CONFIGURED",
    status: finalStatus,
    delivery_mode_badge: deliveryBadge,
    reason:
      finalStatus === "NOT_CONFIGURED"
        ? logEntry.error_message ||
          "External provider is not configured. Message preview generated only."
        : finalStatus === "SIMULATED"
        ? "SIMULATED DELIVERY — logged in Demo Mode without external gateway."
        : "Alert processed.",
    duplicate_suppressed: false,
    alert: alertRecord,
    delivery_log: logEntry,
  };
}

export async function retryCommunicationAlert(
  alertId: string,
  simulate: boolean = true
): Promise<SendSingleAlertResult> {
  buildInitialAlerts();
  const existing = runtimeAlertsMap.get(alertId);
  if (!existing) {
    return {
      success: false,
      status: "FAILED",
      delivery_mode_badge: "NOT_CONFIGURED",
      reason: `Alert ${alertId} not found.`,
      duplicate_suppressed: false,
      alert: null,
      delivery_log: null,
    };
  }

  return dispatchSingleAlert({
    farmerId: existing.farmer_id || undefined,
    locationId: existing.location_id,
    cropId: existing.crop_id,
    cropStage: existing.crop_stage,
    channel: existing.channel,
    language: existing.language,
    horizon: existing.forecast_horizon,
    signalSource: existing.signal_source,
    simulate,
    forceResend: true,
    validUntilIso: existing.expires_at,
  });
}

export interface BulkAlertPreviewSummary {
  location_id: string;
  block_name: string;
  crop_id: string;
  crop_name: string;
  channel: CommunicationChannel;
  language: FarmerLanguage;
  severity: AlertPriorityLevel;
  recipient_count: number;
  eligible_farmers: Array<{
    farmer_id: string;
    name: string;
    masked_phone: string;
    preferred_language: FarmerLanguage;
    consent_enabled: boolean;
  }>;
  consent_blocked_count: number;
  message_preview: string;
  confirmation_required: true;
}

export function previewBulkAlertOperation(params: {
  locationId: string;
  cropId: string;
  channel: CommunicationChannel;
  language?: FarmerLanguage;
  horizon?: ForecastHorizon;
}): BulkAlertPreviewSummary {
  buildInitialAlerts();
  const block =
    MOCK_BLOCKS.find((b) => b.id === params.locationId) || MOCK_BLOCKS[0];
  const horizon = params.horizon || "14D";

  const matchingFarmers = SEEDED_FARMER_PROFILES.filter(
    (f) =>
      params.locationId === "all" ||
      f.location_id === params.locationId ||
      f.crops.some((c) => c.crop_id === params.cropId)
  );

  const eligible = matchingFarmers.filter((f) => f.notification_enabled);
  const blockedCount = matchingFarmers.length - eligible.length;

  const priorityEval = evaluateAlertPriority({
    falseOnsetRisk: block.falseOnsetProbability,
    drySpellRisk: block.drySpellProbability,
    heavyRainRisk: block.heavyRainProbability,
    soilMoisturePct: block.soilMoisture,
  });

  const msg = generateStructuredFarmerMessage({
    blockName: block.name,
    districtName: block.district,
    cropName: params.cropId.toUpperCase(),
    language: params.language || "Hindi",
    horizon,
    severity: priorityEval.severity,
    falseOnsetRiskPct: block.falseOnsetProbability,
    drySpellRiskPct: block.drySpellProbability,
    heavyRainRiskPct: block.heavyRainProbability,
    expectedDrySpellDays: block.expectedDrySpellDays,
  });

  return {
    location_id: block.id,
    block_name: block.name,
    crop_id: params.cropId,
    crop_name: params.cropId.toUpperCase(),
    channel: params.channel,
    language: msg.language,
    severity: priorityEval.severity,
    recipient_count: eligible.length,
    eligible_farmers: matchingFarmers.map((f) => ({
      farmer_id: f.id,
      name: f.name,
      masked_phone: f.masked_phone,
      preferred_language: f.preferred_language,
      consent_enabled: f.notification_enabled,
    })),
    consent_blocked_count: blockedCount,
    message_preview: msg.message,
    confirmation_required: true,
  };
}
