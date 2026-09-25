import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";
import {
  AdvisorySignalSource,
  AlertPriorityLevel,
  CommunicationChannel,
} from "@/types/communication";

export interface MessageTemplateInput {
  blockName: string;
  districtName?: string;
  cropName: string;
  hindiCropName?: string;
  cropStage?: string;
  language?: FarmerLanguage;
  preferredLanguage?: FarmerLanguage;
  horizon: ForecastHorizon;
  severity: AlertPriorityLevel;
  falseOnsetRiskPct: number;
  drySpellRiskPct: number;
  heavyRainRiskPct: number;
  expectedDrySpellDays?: string;
  recommendedActionEn?: string;
  recommendedActionHi?: string;
  cautionEn?: string;
  cautionHi?: string;
  signalSource?: AdvisorySignalSource;
  modelVersion?: string;
  channel?: CommunicationChannel;
}

export interface GeneratedFarmerMessage {
  language: FarmerLanguage;
  title: string;
  message: string;
  characterCount: number;
  smsSegmentsEstimate: number;
  structuredFields: {
    location: string;
    crop: string;
    situation: string;
    forecastHorizon: string;
    recommendedAction: string;
    importantCaution: string;
    sourceProvenance: string;
  };
  containsForbiddenJargon: boolean;
}

const FORBIDDEN_ML_JARGON = [
  "lstm",
  "xgboost",
  "brier score",
  "calibration curve",
  "z-score",
  "hyperparameter",
  "gradient boosting",
];

const HINDI_CROP_NAMES: Record<string, string> = {
  paddy: "धान (Paddy)",
  "paddy / rice": "धान (Paddy)",
  pulses: "दलहन - अरहर/उड़द/मूंग (Pulses)",
  soybean: "सोयाबीन (Soybean)",
  cotton: "कपास (Cotton)",
  maize: "मक्का (Maize)",
  millets: "श्री अन्न - बाजरा/ज्वार (Millets)",
};

const HINDI_STAGE_NAMES: Record<string, string> = {
  sowing: "बुवाई चरण",
  nursery: "नर्सरी चरण",
  vegetative: "वानस्पतिक वृद्धि चरण",
  flowering: "फूल एवं फली चरण",
  harvest: "कटाई चरण",
};

/**
 * Sanitizes any accidental technical ML terms from user-supplied text so farmer
 * messages remain 100% understandable in the field.
 */
function stripTechnicalJargon(text: string): string {
  let cleaned = text;
  cleaned = cleaned.replace(/xgboost/gi, "weather model");
  cleaned = cleaned.replace(/lstm/gi, "sequence forecast");
  cleaned = cleaned.replace(/brier\s*score/gi, "reliability score");
  cleaned = cleaned.replace(/calibration\s*curve/gi, "confidence check");
  cleaned = cleaned.replace(/z-score/gi, "anomaly index");
  return cleaned;
}

/**
 * Sections 8, 9, 10: Structured Multilingual Farmer Message Generator.
 * Generates concise, action-oriented messages from approved templates in English and Hindi.
 * Always populates all 7 required fields:
 *   1. Location
 *   2. Crop
 *   3. Situation
 *   4. Forecast horizon
 *   5. Recommended action
 *   6. Important caution
 *   7. Source/provenance
 */
export function generateStructuredFarmerMessage(
  input: MessageTemplateInput
): GeneratedFarmerMessage {
  const resolvedLanguage: FarmerLanguage =
    input.language || input.preferredLanguage || "Hindi";

  const cleanBlock = input.blockName.replace(/\s+Block$/i, "").trim();
  const district = input.districtName || "Prayagraj";
  const horizonDays =
    input.horizon === "7D"
      ? "7"
      : input.horizon === "14D"
      ? "7–14"
      : input.horizon === "21D"
      ? "14–21"
      : "30";

  const sourceLabelEn =
    input.signalSource === "AI_FORECAST"
      ? "MonsoonPulse AI Advisory (Verified AI Forecast)"
      : "MonsoonPulse AI Advisory (Prototype Decision Support)";

  const sourceLabelHi =
    input.signalSource === "AI_FORECAST"
      ? "MonsoonPulse AI कृषि सलाह (सत्यापित पूर्वानुमान)"
      : "MonsoonPulse AI कृषि सलाह (प्रोटोटाइप निर्णय सहायता)";

  if (resolvedLanguage === "Hindi") {
    const cropKey = input.cropName.toLowerCase().trim();
    const cropLabelHi =
      input.hindiCropName || HINDI_CROP_NAMES[cropKey] || input.cropName;
    const stageHi = input.cropStage
      ? HINDI_STAGE_NAMES[input.cropStage.toLowerCase()] || input.cropStage
      : "बुवाई चरण";

    let situationHi = `अगले ${horizonDays} दिनों में संभावित शुष्क अंतराल (${input.drySpellRiskPct}% जोखिम) और अनियमित वर्षा की संभावना है।`;
    let actionHi =
      input.recommendedActionHi ||
      "सीधी बुवाई 5–7 दिन रोकें तथा नर्सरी में नमी बनाए रखने के लिए हल्की सिंचाई की व्यवस्था रखें।";
    let cautionHi =
      input.cautionHi ||
      "केवल पहली शुरुआती बारिश के आधार पर असिंचित खेत में पूरी बुवाई न करें।";

    if (input.heavyRainRiskPct >= 55) {
      situationHi = `अगले ${horizonDays} दिनों में भारी वर्षा (${input.heavyRainRiskPct}% संभावना) और जलभराव का जोखिम है।`;
      actionHi =
        input.recommendedActionHi ||
        "खेत की जल-निकासी नालियां तुरंत साफ करें और अगले 48–72 घंटों तक उर्वरक या कीटनाशक का छिड़काव टालें।";
      cautionHi =
        input.cautionHi ||
        "निचले खेतों में पानी रुकने न दें ताकि जड़ सड़न से बचाव हो सके।";
    } else if (input.falseOnsetRiskPct >= 60) {
      situationHi = `शुरुआती बारिश के बाद ${
        input.expectedDrySpellDays || "8–11 दिन"
      } के सूखे अंतराल (False Onset: ${input.falseOnsetRiskPct}%) की उच्च संभावना है।`;
      actionHi =
        input.recommendedActionHi ||
        "वर्षा आधारित सीधी बुवाई 5–7 दिन टालें और जीवनरक्षक सिंचाई की तैयारी रखें।";
      cautionHi =
        input.cautionHi ||
        "स्थायी मिट्टी नमी की पुष्टि किए बिना महंगे बीज और खाद का प्रयोग न करें।";
    }

    situationHi = stripTechnicalJargon(situationHi);
    actionHi = stripTechnicalJargon(actionHi);
    cautionHi = stripTechnicalJargon(cautionHi);

    const locationField = `${cleanBlock} ब्लॉक, ${district}`;
    const cropField = `${cropLabelHi} (${stageHi})`;
    const horizonField = `अगले ${horizonDays} दिन (${input.horizon})`;

    const message = [
      `🌾 मानसून कृषि सलाह — ${locationField}`,
      `फसल: ${cropField}`,
      `स्थिति: ${situationHi}`,
      `अवधि: ${horizonField}`,
      `सलाह: ${actionHi}`,
      `सावधानी: ${cautionHi}`,
      `स्रोत: ${sourceLabelHi}`,
    ].join("\n");

    const title = `मानसून सलाह (${cleanBlock} • ${cropLabelHi})`;
    const validation = validateFarmerMessageSafety(message);

    return {
      language: "Hindi",
      title,
      message,
      characterCount: message.length,
      smsSegmentsEstimate: Math.max(1, Math.ceil(message.length / 70)),
      structuredFields: {
        location: locationField,
        crop: cropField,
        situation: situationHi,
        forecastHorizon: horizonField,
        recommendedAction: actionHi,
        importantCaution: cautionHi,
        sourceProvenance: sourceLabelHi,
      },
      containsForbiddenJargon: !validation.safe,
    };
  }

  // English Template
  const stageEn = input.cropStage ? ` (${input.cropStage} stage)` : "";
  let situationEn = `Moderate dry-spell risk (${input.drySpellRiskPct}%) and uneven rainfall expected over the next ${horizonDays} days.`;
  let actionEn =
    input.recommendedActionEn ||
    "Delay rainfed sowing by 5–7 days, maintain nursery moisture, and prepare backup irrigation.";
  let cautionEn =
    input.cautionEn ||
    "Do not commit full seed rate on the first isolated shower without checking topsoil moisture.";

  if (input.heavyRainRiskPct >= 55) {
    situationEn = `High heavy-rainfall and waterlogging risk (${input.heavyRainRiskPct}%) expected over the next ${horizonDays} days.`;
    actionEn =
      input.recommendedActionEn ||
      "Open field drainage channels immediately and postpone fertilizer top-dressing or spraying for 48–72 hours.";
    cautionEn =
      input.cautionEn ||
      "Avoid standing water in low-lying pulse, soybean, and maize plots to prevent root rot.";
  } else if (input.falseOnsetRiskPct >= 60) {
    situationEn = `High risk of false monsoon onset (${input.falseOnsetRiskPct}%) followed by an ${
      input.expectedDrySpellDays || "8–11 day"
    } dry spell.`;
    actionEn =
      input.recommendedActionEn ||
      "Delay direct sowing by 5–7 days, keep paddy nursery irrigated, and conserve farm pond water.";
    cautionEn =
      input.cautionEn ||
      "Avoid rainfed sowing immediately after the initial shower until sustained moisture is confirmed.";
  }

  situationEn = stripTechnicalJargon(situationEn);
  actionEn = stripTechnicalJargon(actionEn);
  cautionEn = stripTechnicalJargon(cautionEn);

  const locationField = `${cleanBlock} Block, ${district}`;
  const cropField = `${input.cropName}${stageEn}`;
  const horizonField = `Next ${horizonDays} days (${input.horizon})`;

  const message = [
    `MonsoonPulse AI Advisory — ${locationField}`,
    `Crop: ${cropField}`,
    `Situation: ${situationEn}`,
    `Horizon: ${horizonField}`,
    `Action: ${actionEn}`,
    `Caution: ${cautionEn}`,
    `Source: ${sourceLabelEn}`,
  ].join("\n");

  const title = `Monsoon Advisory (${cleanBlock} Block • ${input.cropName})`;
  const validation = validateFarmerMessageSafety(message);

  return {
    language: "English",
    title,
    message,
    characterCount: message.length,
    smsSegmentsEstimate: Math.max(1, Math.ceil(message.length / 153)),
    structuredFields: {
      location: locationField,
      crop: cropField,
      situation: situationEn,
      forecastHorizon: horizonField,
      recommendedAction: actionEn,
      importantCaution: cautionEn,
      sourceProvenance: sourceLabelEn,
    },
    containsForbiddenJargon: !validation.safe,
  };
}

/**
 * Validates that a farmer message contains zero forbidden ML jargon
 * (LSTM, XGBoost, Brier score, calibration curve, z-score).
 */
export function validateFarmerMessageSafety(message: string): {
  safe: boolean;
  detectedTerms: string[];
} {
  const lower = (message || "").toLowerCase();
  const detectedTerms = FORBIDDEN_ML_JARGON.filter((term) =>
    lower.includes(term)
  );
  return {
    safe: detectedTerms.length === 0,
    detectedTerms,
  };
}
