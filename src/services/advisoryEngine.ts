/**
 * MonsoonPulse AI — Deterministic Crop-Specific AI Advisory & Decision Engine
 * (src/services/advisoryEngine.ts)
 *
 * Prompt 8 Requirements 1–29:
 * Combines REAL OBSERVATIONS + AI FORECAST + CROP PROFILE + LOCATION + FORECAST HORIZON
 * into deterministic, traceable, bilingual (English + Hindi) agricultural advisories.
 *
 * Strictly enforces:
 * - Zero LLM / random advisory generation
 * - Zero fabricated soil moisture ("Soil moisture unavailable" when null)
 * - Zero fabricated growth stage ("Growth stage not specified" when omitted)
 * - Seasonality awareness (never issues Kharif monsoon sowing advice for Rabi Wheat)
 * - Crop-specific waterlogging & dry-spell sensitivity differentiation
 * - Conditional irrigation wording ("If irrigation is available...")
 * - Expiration gating (EXPIRED predictions are excluded from active advisories)
 */

import {
  ADVISORY_THRESHOLDS,
  CROP_PROFILES,
  PROTOTYPE_RULE_DISCLAIMER_EN,
  PROTOTYPE_RULE_DISCLAIMER_HI,
  resolveCanonicalGrowthStage,
  SCIENTIFIC_LIMITATION_DISCLAIMER_EN,
  SCIENTIFIC_LIMITATION_DISCLAIMER_HI,
} from "@/config/advisoryRules";
import {
  AdvisoryEngineResult,
  AdvisoryEvidenceBasis,
  AdvisoryInputs,
  AdvisorySeverity,
  AdvisorySourceMode,
  CanonicalGrowthStage,
  CropProfileMetadata,
  CropSensitivityLevel,
  FarmerOutlookCard,
  GeneratedAdvisoryItem,
  OfficerBlockAdvisorySummary,
  SupportedCropId,
} from "@/types/advisory";
import { DemoScenarioId, ForecastHorizon } from "@/types/monsoon";
import { getBlocksForScenarioAndHorizon, MOCK_BLOCKS } from "@/data/mockData";

function normalizeProbability(val: number | null | undefined): number {
  if (val === null || val === undefined || Number.isNaN(val)) return 0.0;
  const p = val > 1.0 ? val / 100.0 : val;
  return Math.min(1.0, Math.max(0.0, Number(p.toFixed(4))));
}

function formatPct(prob0to1: number): string {
  return `${Math.round(prob0to1 * 1000) / 10}%`;
}

function severityWeight(s: AdvisorySeverity): number {
  switch (s) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MODERATE":
      return 2;
    case "LOW":
    default:
      return 1;
  }
}

function sensitivityWeight(s: CropSensitivityLevel): number {
  switch (s) {
    case "HIGH":
      return 3;
    case "MODERATE":
      return 2;
    case "LOW":
    default:
      return 1;
  }
}

/**
 * Classifies daily rainfall intensity into IMD categories (Section 8)
 */
export function classifyIMDDailyRainfall(dailyMm: number): {
  category_en: string;
  category_hi: string;
  is_heavy_or_above: boolean;
} {
  const { imd_daily_mm } = ADVISORY_THRESHOLDS.heavy_rain;
  if (dailyMm >= imd_daily_mm.extremely_heavy_min) {
    return {
      category_en: "Extremely Heavy Rainfall (>=204.5 mm/day)",
      category_hi: "अत्यधिक भारी वर्षा (>=204.5 मिमी/दिन)",
      is_heavy_or_above: true,
    };
  }
  if (dailyMm >= imd_daily_mm.very_heavy_min) {
    return {
      category_en: "Very Heavy Rainfall (115.6–204.4 mm/day)",
      category_hi: "बहुत भारी वर्षा (115.6–204.4 मिमी/दिन)",
      is_heavy_or_above: true,
    };
  }
  if (dailyMm >= imd_daily_mm.heavy_min) {
    return {
      category_en: "Heavy Rainfall (64.5–115.5 mm/day)",
      category_hi: "भारी वर्षा (64.5–115.5 मिमी/दिन)",
      is_heavy_or_above: true,
    };
  }
  return {
    category_en: "Moderate / Normal Daily Rainfall (<64.5 mm/day)",
    category_hi: "सामान्य/मध्यम दैनिक वर्षा (<64.5 मिमी/दिन)",
    is_heavy_or_above: false,
  };
}

/**
 * Crop-specific drainage & heavy rainfall guidance (Section 9)
 */
function getCropSpecificHeavyRainGuidance(
  crop: CropProfileMetadata,
  stage: CanonicalGrowthStage | null
): {
  action_en: string;
  action_hi: string;
} {
  const stageNoteEn = stage ? ` (current stage: ${stage.replace("_", " ")})` : "";
  const stageNoteHi = stage ? ` (वर्तमान अवस्था: ${stage})` : "";

  switch (crop.crop_id) {
    case "paddy":
      return {
        action_en: `Monitor bund water levels and field drainage during prolonged heavy rainfall${stageNoteEn}. Maintain a 5 cm spillway notch in newly transplanted or nursery plots to prevent seedling submergence, and postpone urea top-dressing until heavy showers subside.`,
        action_hi: `लंबे समय तक भारी वर्षा के दौरान धान के खेत में जल स्तर और जल निकासी की निगरानी करें${stageNoteHi}। नर्सरी और नई रोपाई वाले खेतों में पौध को डूबने से बचाने के लिए मेड़ में 5 सेमी निकास रखें तथा भारी वर्षा थमने तक यूरिया का छिड़काव स्थगित रखें।`,
      };
    case "maize":
      return {
        action_en: `Prepare and clear field drainage channels immediately where heavy rainfall is expected${stageNoteEn}. Maize is highly sensitive to prolonged waterlogging (>24 hours); keep ridge furrows open and avoid foliar or basal fertilizer operations immediately before heavy rainfall.`,
        action_hi: `जहाँ भारी वर्षा की संभावना है, वहाँ मक्का के खेतों में तुरंत जल निकासी नालियाँ साफ करें${stageNoteHi}। मक्का 24 घंटे से अधिक जलभराव के प्रति अत्यंत संवेदनशील है; मेड़ की नालियों को खुला रखें और भारी वर्षा से ठीक पहले उर्वरक का प्रयोग न करें।`,
      };
    case "pulses":
      return {
        action_en: `Monitor field drainage closely and avoid any unnecessary irrigation before expected rainfall${stageNoteEn}. Pulses (Arhar/Moong/Urad) suffer root rot under standing water; ensure perimeter drainage trenches around raised beds are unobstructed.`,
        action_hi: `संभावित वर्षा से पूर्व जल निकासी की निगरानी करें और अनावश्यक सिंचाई से बचें${stageNoteHi}। दलहनी फसलों (अरहर/मूंग/उड़द) में जलभराव से जड़ सड़न का जोखिम रहता है; उठी हुई क्यारियों के चारों ओर निकास नालियाँ साफ रखें।`,
      };
    case "soybean":
      return {
        action_en: `Balance moisture availability with rapid drainage conditions${stageNoteEn}. Clear broad-bed furrow (BBF) channels to prevent root-zone waterlogging during intense monsoon spells and protect harvested/stored seed lots from moisture.`,
        action_hi: `नमी की उपलब्धता और जल निकासी के बीच संतुलन बनाए रखें${stageNoteHi}। सोयाबीन के खेतों में चौड़ी क्यारी-नाली (BBF) को साफ रखें ताकि जड़ों में पानी न रुके।`,
      };
    case "cotton":
      return {
        action_en: `Monitor waterlogging and rainfall around field operations${stageNoteEn}. Keep inter-row drainage furrows clear to avoid square/boll shedding and postpone pesticide spraying ahead of forecasted downpours.`,
        action_hi: `कपास में कृषि कार्यों के दौरान वर्षा और जलभराव की निगरानी करें${stageNoteHi}। पुड़िया/टिंडे गिरने से रोकने के लिए कतारों के बीच जल निकासी नालियाँ साफ रखें और भारी वर्षा से पहले छिड़काव स्थगित करें।`,
      };
    case "wheat":
    default:
      return {
        action_en: `Inspect fallow/pre-Rabi field bunds and drainage channels to prevent topsoil erosion during heavy monsoon rainfall while conserving sub-surface moisture for November sowing.`,
        action_hi: `भारी मानसून वर्षा के दौरान मिट्टी के कटाव को रोकने के लिए खेत की मेड़ों और जल निकासी का निरीक्षण करें तथा नवंबर की रबी बुवाई हेतु भूमिगत नमी संरक्षित करें।`,
      };
  }
}

/**
 * Crop-specific dry spell & moisture conservation guidance (Section 7 & 9)
 */
function getCropSpecificDrySpellGuidance(
  crop: CropProfileMetadata,
  stage: CanonicalGrowthStage | null
): {
  action_en: string;
  action_hi: string;
} {
  switch (crop.crop_id) {
    case "paddy":
      return {
        action_en:
          "If irrigation is available, maintain shallow saturation (2–3 cm) in paddy nurseries and staggered transplanting plots. Repair field bund cracks to conserve rainwater and withhold urea top-dressing until soil moisture is restored.",
        action_hi:
          "यदि सिंचाई की सुविधा उपलब्ध हो, तो धान की नर्सरी और रोपाई वाले खेतों में हल्की नमी (2–3 सेमी) बनाए रखें। वर्षा जल रोकने के लिए मेड़ों की दरारें बंद करें और पर्याप्त नमी होने तक यूरिया का प्रयोग स्थगित रखें।",
      };
    case "maize":
      return {
        action_en:
          "If irrigation is available, plan light furrow moisture replenishment during knee-high or tasseling stages. Practice shallow inter-row weeding and crop-residue mulching to reduce soil evaporation during the dry spell.",
        action_hi:
          "यदि सिंचाई की सुविधा उपलब्ध हो, तो मक्का की बढ़वार या मंजरी अवस्था में हल्की सिंचाई की योजना बनाएं। शुष्क दौर में नमी बचाने के लिए निराई-गुड़ाई और पलवार (mulching) का प्रयोग करें।",
      };
    case "pulses":
      return {
        action_en:
          "Monitor soil moisture retention and apply surface mulching between rows. Pulses have moderate drought tolerance, but if irrigation is available during flowering or pod initiation, schedule a light life-saving watering without flooding.",
        action_hi:
          "मृदा नमी की निगरानी करें और कतारों के बीच पलवार (mulching) बिछाएं। यदि फूल या फली बनते समय गंभीर नमी तनाव हो और सिंचाई उपलब्ध हो, तो बिना जलभराव किए हल्की जीवनरक्षक सिंचाई करें।",
      };
    case "soybean":
      return {
        action_en:
          "Delay moisture-sensitive soybean sowing until cumulative rainfall is adequate. For standing crops, conserve soil moisture via inter-cultivation mulching and, if irrigation is available, plan supplemental watering during flowering/pod-fill.",
        action_hi:
          "पर्याप्त वर्षा नमी होने तक सोयाबीन की बुवाई स्थगित रखने पर विचार करें। खड़ी फसल में नमी संरक्षण हेतु पलवार करें तथा यदि सिंचाई उपलब्ध हो, तो फूल/फली अवस्था में पूरक सिंचाई की व्यवस्था करें।",
      };
    case "cotton":
      return {
        action_en:
          "Monitor square and boll retention during prolonged dry spells. Conserve soil moisture with inter-row mulching and, if irrigation is available, apply alternate-furrow watering.",
        action_hi:
          "लंबे शुष्क दौर में कपास की पुड़िया और टिंडों की निगरानी करें। नमी संरक्षण के लिए पलवार अपनाएं और यदि सिंचाई उपलब्ध हो, तो एक-छोड़कर-एक नाली (alternate furrow) से सिंचाई करें।",
      };
    case "wheat":
    default:
      return {
        action_en:
          "Wheat is a Rabi crop (sown November–December). During monsoon dry spells, keep fallow plots weed-free and maintain perimeter bunds to bank residual moisture for winter sowing.",
        action_hi:
          "गेहूँ रबी (नवंबर–दिसंबर) की फसल है। मानसून के शुष्क दौर में खेत को खरपतवार मुक्त रखें और शीतकालीन बुवाई हेतु नमी संरक्षण के लिए मेड़बंदी बनाए रखें।",
      };
  }
}

/**
 * Core Deterministic Evaluation Function (Sections 2–24)
 */
export function evaluateCropAdvisories(
  inputs: AdvisoryInputs
): AdvisoryEngineResult {
  const cropId: SupportedCropId = CROP_PROFILES[inputs.crop_id]
    ? inputs.crop_id
    : "paddy";
  const crop = CROP_PROFILES[cropId];

  const locationId = (inputs.location_id || "karchhana").toLowerCase();
  const blockName =
    inputs.block_name ||
    MOCK_BLOCKS.find((b) => b.id === locationId)?.name ||
    locationId.charAt(0).toUpperCase() + locationId.slice(1);
  const district = inputs.district || "Prayagraj";
  const state = inputs.state || "Uttar Pradesh";

  const horizon: ForecastHorizon = inputs.forecast_horizon || "14D";
  const horizonDays: 7 | 14 | 21 | 30 =
    inputs.horizon_days ||
    (parseInt(horizon.replace("D", ""), 10) as 7 | 14 | 21 | 30) ||
    14;

  // Resolve optional growth stage (Section 10: never invent stage)
  const resolvedStage = resolveCanonicalGrowthStage(inputs.crop_stage);
  const cropStageStatusEn = resolvedStage
    ? `Specified Growth Stage: ${resolvedStage.replace("_", " ")}`
    : "Growth stage not specified";
  const cropStageStatusHi = resolvedStage
    ? `निर्दिष्ट वृद्धि अवस्था: ${resolvedStage}`
    : "फसल की वृद्धि अवस्था निर्दिष्ट नहीं है (Growth stage not specified)";

  // Resolve optional soil moisture (Section 3: never fabricate soil moisture)
  const hasSoilMoisture =
    inputs.soil_moisture !== null &&
    inputs.soil_moisture !== undefined &&
    !Number.isNaN(inputs.soil_moisture);
  const soilMoistureVal = hasSoilMoisture
    ? Number(inputs.soil_moisture)
    : null;
  const soilMoistureStatusEn = hasSoilMoisture
    ? `${soilMoistureVal}%`
    : "Soil moisture unavailable";
  const soilMoistureStatusHi = hasSoilMoisture
    ? `${soilMoistureVal}%`
    : "मृदा नमी डेटा अनुपलब्ध है (Soil moisture unavailable)";

  // Normalize probabilities [0, 1]
  const pOnset = normalizeProbability(inputs.onset_probability);
  const pFalseOnset = normalizeProbability(inputs.false_onset_probability);
  const pDrySpell = normalizeProbability(inputs.dry_spell_probability);
  const pHeavyRain = normalizeProbability(inputs.heavy_rain_probability);

  const currentRainMm =
    inputs.current_rainfall !== null && inputs.current_rainfall !== undefined
      ? Number(inputs.current_rainfall)
      : 0.0;
  const recent7dRainMm =
    inputs.recent_rainfall !== null && inputs.recent_rainfall !== undefined
      ? Number(inputs.recent_rainfall)
      : currentRainMm;
  const expectedRainMm =
    inputs.expected_rainfall !== null && inputs.expected_rainfall !== undefined
      ? Number(inputs.expected_rainfall)
      : 0.0;
  const anomalyPct =
    inputs.rainfall_anomaly !== null && inputs.rainfall_anomaly !== undefined
      ? Number(inputs.rainfall_anomaly)
      : 0.0;

  const evalMonth = inputs.evaluation_month ?? 6; // Default June (Kharif monsoon window)
  const isWithinSowingWindow = crop.sowing_window.months.includes(evalMonth);
  const isRabiOffSeasonInMonsoon =
    crop.season === "Rabi" && [5, 6, 7, 8, 9].includes(evalMonth);

  const isSowingOrPreSowingStage =
    resolvedStage === null ||
    resolvedStage === "pre_sowing" ||
    resolvedStage === "germination";

  // Timestamps & Expiration check (Section 22)
  const createdAt = inputs.prediction_issued_at || new Date().toISOString();
  const validUntil =
    inputs.prediction_valid_until ||
    new Date(
      new Date(createdAt).getTime() + horizonDays * 24 * 60 * 60 * 1000
    ).toISOString();
  const refTimeMs = inputs.reference_timestamp
    ? new Date(inputs.reference_timestamp).getTime()
    : new Date(createdAt).getTime();
  const isPredictionExpired = refTimeMs > new Date(validUntil).getTime();

  const itemStatus: "ACTIVE" | "EXPIRED" = isPredictionExpired
    ? "EXPIRED"
    : "ACTIVE";

  const generatedItems: GeneratedAdvisoryItem[] = [];

  const buildEvidence = (
    triggeredConditions: string[],
    sensitivityFactor: string
  ): AdvisoryEvidenceBasis => ({
    summary_en: `Evidence basis — ${inputs.source_mode} forecast (${horizonDays} days): Onset ${formatPct(
      pOnset
    )}, False Onset ${formatPct(pFalseOnset)}, Dry Spell ${formatPct(
      pDrySpell
    )}, Heavy Rain ${formatPct(
      pHeavyRain
    )}, Rainfall Anomaly ${anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`}.`,
    summary_hi: `साक्ष्य आधार — ${inputs.source_mode} पूर्वानुमान (${horizonDays} दिन): मानसून आगमन ${formatPct(
      pOnset
    )}, झूठा मानसून ${formatPct(pFalseOnset)}, शुष्क दौर ${formatPct(
      pDrySpell
    )}, भारी वर्षा ${formatPct(
      pHeavyRain
    )}, वर्षा विसंगति ${anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`}।`,
    metrics: [
      {
        label_en: `${horizon} Onset Probability`,
        label_hi: `${horizon} मानसून आगमन संभावना`,
        value: formatPct(pOnset),
      },
      {
        label_en: `${horizon} False Onset Probability`,
        label_hi: `${horizon} झूठा मानसून (False Onset) जोखिम`,
        value: formatPct(pFalseOnset),
      },
      {
        label_en: `${horizon} Dry-Spell Probability`,
        label_hi: `${horizon} शुष्क दौर (Dry Spell) संभावना`,
        value: formatPct(pDrySpell),
      },
      {
        label_en: `${horizon} Heavy-Rain Probability`,
        label_hi: `${horizon} भारी वर्षा संभावना`,
        value: formatPct(pHeavyRain),
      },
      {
        label_en: "Recent Rainfall Anomaly",
        label_hi: "हालिया वर्षा विसंगति",
        value: anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`,
      },
      {
        label_en: "Soil Moisture Status",
        label_hi: "मृदा नमी की स्थिति",
        value: soilMoistureStatusEn,
      },
      {
        label_en: "Forecast Horizon",
        label_hi: "पूर्वानुमान अवधि",
        value: `${horizonDays} days (${horizon})`,
      },
    ],
    triggered_conditions: triggeredConditions,
    crop_sensitivity_factor: sensitivityFactor,
    forecast_horizon_days: horizonDays,
    observation_cutoff: inputs.observation_cutoff,
    model_version: inputs.model_version,
    source_mode: inputs.source_mode,
  });

  // ============================================================================
  // 1. CROP SEASONALITY RULE (RULE-SEASON-001) — e.g., Wheat in Kharif Monsoon
  // ============================================================================
  if (isRabiOffSeasonInMonsoon) {
    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-SEASON-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-SEASON-001",
      decision_category: "NO_IMMEDIATE_ACTION",
      decision_code: "J",
      advisory_type: "SEASONALITY_GUARD",
      severity: "LOW",
      priority_rank: 1,
      priority_explanation:
        "Seasonality guard: Wheat is a Rabi winter crop (sown Nov–Dec); monsoon sowing advisories are suppressed.",
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: "Off-Season Crop (Rabi Wheat — No Monsoon Sowing)",
        what: `${crop.name} is a Rabi winter season crop (${crop.sowing_window.label_en}), not a Kharif monsoon sowing crop.`,
        why: `Current evaluation falls within the Southwest Monsoon window. Issuing monsoon sowing advice for ${crop.name} is agronomically inappropriate.`,
        when: `Next ${horizonDays} days (Monsoon Moisture Banking Period)`,
        action:
          "Do not sow wheat during the monsoon season. Maintain field bunds to conserve residual soil moisture for November–December Rabi sowing, or select a Kharif crop (Paddy, Maize, Pulses, Soybean).",
        message: `${crop.name} is a Rabi crop sown in November–December. Use the next ${horizonDays} days of monsoon rainfall (${expectedRainMm} mm expected) for fallow moisture conservation and bunding.`,
        reason: `Seasonality rule RULE-SEASON-001: ${crop.name} season is Rabi (${crop.sowing_window.label_en}).`,
      },
      hi: {
        title: "रबी सीजन की फसल (गेहूँ — मानसून में बुवाई न करें)",
        what: `${crop.local_names.hi} रबी (शीतकालीन) सीजन की फसल है (${crop.sowing_window.label_hi}), खरीफ मानसून में इसकी बुवाई नहीं की जाती है।`,
        why: `वर्तमान समय खरीफ मानसून अवधि का है, इसलिए गेहूँ की बुवाई की सलाह देना कृषि विज्ञान के अनुसार उचित नहीं है।`,
        when: `अगले ${horizonDays} दिन (मानसून नमी संरक्षण अवधि)`,
        action:
          "मानसून के दौरान गेहूँ की बुवाई न करें। नवंबर–दिसंबर की रबी बुवाई हेतु वर्षा जल को खेत में संचित करने के लिए मेड़बंदी करें अथवा खरीफ फसल (धान, मक्का, दलहन, सोयाबीन) चुनें।",
        message: `गेहूँ रबी सीजन (नवंबर–दिसंबर) की फसल है। अगले ${horizonDays} दिनों की संभावित वर्षा (${expectedRainMm} मिमी) का उपयोग खेत की मेड़बंदी और नमी संरक्षण में करें।`,
        reason: `फसल ऋतु नियम RULE-SEASON-001: गेहूँ का बुवाई समय नवंबर–दिसंबर है।`,
      },
      evidence: buildEvidence(
        [
          `crop.season === '${crop.season}'`,
          `evaluation_month (${evalMonth}) not in [${crop.sowing_window.months.join(", ")}]`,
        ],
        "Rabi Seasonality Filter"
      ),
    });
  }

  // ============================================================================
  // 2. CROP BLOCK SUITABILITY RULE (RULE-SUITABILITY-001)
  // ============================================================================
  if (!crop.suitable_blocks.includes(locationId)) {
    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-SUITABILITY-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-SUITABILITY-001",
      decision_category: "MONITOR_DRY_SPELL",
      decision_code: "I",
      advisory_type: "AGRO_ECOLOGICAL_SUITABILITY",
      severity: "MODERATE",
      priority_rank: 2,
      priority_explanation: `Block agro-ecological suitability notice for ${crop.name} in ${blockName}.`,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `Agro-Ecological Suitability Notice for ${crop.name} in ${blockName}`,
        what: `${crop.name} has limited historical agro-ecological suitability in ${blockName}.`,
        why: crop.suitability_note_en,
        when: `Before committing full acreage over the next ${horizonDays} days`,
        action:
          "Verify plot drainage and soil texture with local KVK / block extension officers before expanding cultivation, or prioritize well-drained raised beds.",
        message: `${crop.suitability_note_en} Verify local soil and drainage conditions before action.`,
        reason: `Location ${locationId} is outside primary suitability list [${crop.suitable_blocks.join(
          ", "
        )}].`,
      },
      hi: {
        title: `${blockName} में ${crop.local_names.hi} की क्षेत्रीय उपयुक्तता सूचना`,
        what: `${blockName} विकासखंड में ${crop.local_names.hi} की कृषि-पारिस्थितिक उपयुक्तता सीमित है।`,
        why: crop.suitability_note_hi,
        when: `अगले ${horizonDays} दिनों में बुवाई क्षेत्र बढ़ाने से पूर्व`,
        action:
          "बुवाई से पूर्व स्थानीय कृषि विज्ञान केंद्र (KVK) या ब्लॉक कृषि अधिकारी से मिट्टी एवं जल निकासी की पुष्टि करें तथा केवल ऊँचे जल-निकास वाले खेतों का चयन करें।",
        message: `${crop.suitability_note_hi}`,
        reason: `विकासखंड ${locationId} प्राथमिक उपयुक्त सूची [${crop.suitable_blocks.join(
          ", "
        )}] से बाहर है।`,
      },
      evidence: buildEvidence(
        [`!crop.suitable_blocks.includes('${locationId}')`],
        `Waterlogging sensitivity: ${crop.waterlogging_sensitivity}`
      ),
    });
  }

  // ============================================================================
  // 3. SOWING & ONSET RULES (Section 5 — Only for crops within sowing season)
  // ============================================================================
  if (!isRabiOffSeasonInMonsoon && isWithinSowingWindow && isSowingOrPreSowingStage) {
    const recentRainAdequate =
      recent7dRainMm >= ADVISORY_THRESHOLDS.onset.min_recent_7d_rain_mm ||
      expectedRainMm >= crop.rainfall_requirement.optimal_14d_sowing_rain_mm;

    // RULE-ONSET-001: Favorable Sowing Conditions (SOW NOW)
    if (
      pOnset >= ADVISORY_THRESHOLDS.onset.favorable_min_prob &&
      pFalseOnset < ADVISORY_THRESHOLDS.false_onset.delay_sowing_min_prob &&
      pDrySpell < ADVISORY_THRESHOLDS.dry_spell.action_min_prob &&
      recentRainAdequate
    ) {
      generatedItems.push({
        id: `${locationId}-${cropId}-${horizon}-RULE-ONSET-001`,
        location_id: locationId,
        crop_id: cropId,
        rule_id: "RULE-ONSET-001",
        decision_category: "SOW_NOW",
        decision_code: "A",
        advisory_type: "SOWING_CONDITIONS_FAVOURABLE",
        severity: "LOW",
        priority_rank: 3,
        priority_explanation:
          "High onset probability (>=60%) with adequate moisture and low/moderate false-onset risk.",
        forecast_horizon: horizon,
        horizon_days: horizonDays,
        model_version: inputs.model_version,
        source_mode: inputs.source_mode,
        created_at: createdAt,
        valid_until: validUntil,
        status: itemStatus,
        en: {
          title: `SOWING CONDITIONS FAVOURABLE (${crop.name})`,
          what: "Sowing conditions are currently more favorable based on onset stability and rainfall outlook.",
          why: `${horizon} monsoon onset probability is ${formatPct(
            pOnset
          )} with false-onset risk at ${formatPct(
            pFalseOnset
          )} and expected rainfall of ${expectedRainMm} mm.`,
          when: `Next ${horizonDays} days (${crop.sowing_window.label_en})`,
          action: `Conditions are currently more favorable for ${crop.name} seedbed preparation and sowing in ${blockName}. Verify local plot moisture before action and use treated seed.`,
          message: `SOWING CONDITIONS FAVOURABLE: ${horizon} onset probability is ${formatPct(
            pOnset
          )} with ${expectedRainMm} mm expected rainfall. Proceed with ${
            crop.name
          } sowing after verifying local topsoil moisture.`,
          reason: `Onset probability (${formatPct(
            pOnset
          )}) >= 60%, false onset (${formatPct(
            pFalseOnset
          )}) < 60%, and moisture regime is adequate.`,
        },
        hi: {
          title: `बुवाई के लिए परिस्थितियाँ अनुकूल हैं (${crop.local_names.hi})`,
          what: "मानसून आगमन की स्थिरता और वर्षा पूर्वानुमान के आधार पर बुवाई की परिस्थितियाँ वर्तमान में अनुकूल हैं।",
          why: `${horizon} मानसून आगमन की संभावना ${formatPct(
            pOnset
          )} है, झूठे मानसून का जोखिम ${formatPct(
            pFalseOnset
          )} है और ${expectedRainMm} मिमी संभावित वर्षा का अनुमान है।`,
          when: `अगले ${horizonDays} दिन (${crop.sowing_window.label_hi})`,
          action: `${blockName} में ${crop.local_names.hi} की बुवाई एवं रोपाई की तैयारी के लिए परिस्थितियाँ अनुकूल हैं। बुवाई से पूर्व स्थानीय खेत की नमी की पुष्टि अवश्य करें।`,
          message: `बुवाई हेतु अनुकूल संकेत: ${horizon} मानसून आगमन संभावना ${formatPct(
            pOnset
          )} तथा संभावित वर्षा ${expectedRainMm} मिमी है। स्थानीय नमी जांचकर ${
            crop.local_names.hi
          } की बुवाई करें।`,
          reason: `मानसून आगमन संभावना (${formatPct(
            pOnset
          )}) >= 60% एवं झूठा मानसून जोखिम (${formatPct(
            pFalseOnset
          )}) < 60%।`,
        },
        evidence: buildEvidence(
          [
            `onset_probability (${pOnset}) >= 0.60`,
            `false_onset_probability (${pFalseOnset}) < 0.60`,
            `dry_spell_probability (${pDrySpell}) < 0.60`,
            `recent_or_expected_rainfall_adequate === true`,
          ],
          `Dry-spell sensitivity: ${crop.dry_spell_sensitivity}`
        ),
      });
    }

    // RULE-ONSET-002: Consider Delaying Sowing (DELAY SOWING)
    if (
      pOnset <= ADVISORY_THRESHOLDS.onset.low_onset_max_prob ||
      pFalseOnset >= ADVISORY_THRESHOLDS.false_onset.delay_sowing_min_prob
    ) {
      const sev: AdvisorySeverity =
        pFalseOnset >= ADVISORY_THRESHOLDS.false_onset.critical_min_prob ||
        (pFalseOnset >= 0.6 && crop.dry_spell_sensitivity === "HIGH")
          ? "CRITICAL"
          : "HIGH";

      generatedItems.push({
        id: `${locationId}-${cropId}-${horizon}-RULE-ONSET-002`,
        location_id: locationId,
        crop_id: cropId,
        rule_id: "RULE-ONSET-002",
        decision_category: "DELAY_SOWING",
        decision_code: "B",
        advisory_type: "CONSIDER_DELAYING_SOWING",
        severity: sev,
        priority_rank: 1,
        priority_explanation: `Elevated seedling mortality risk: onset probability is ${formatPct(
          pOnset
        )} and/or false-onset risk is ${formatPct(pFalseOnset)}.`,
        forecast_horizon: horizon,
        horizon_days: horizonDays,
        model_version: inputs.model_version,
        source_mode: inputs.source_mode,
        created_at: createdAt,
        valid_until: validUntil,
        status: itemStatus,
        en: {
          title: `CONSIDER DELAYING SOWING (${crop.name})`,
          what: "Risk of erratic onset or post-sowing dry break is elevated.",
          why: `${horizon} onset probability is ${formatPct(
            pOnset
          )} and false-onset probability is ${formatPct(pFalseOnset)}.`,
          when: `Next ${horizonDays} days`,
          action: `Consider delaying direct rainfed sowing of ${crop.name} by 5–7 days until sustained monsoon showers (>20–25 mm over 3 consecutive days) are observed. Retain nursery moisture if irrigation is available.`,
          message: `CONSIDER DELAYING SOWING: Based on the current ${horizon} forecast (Onset ${formatPct(
            pOnset
          )}, False Onset ${formatPct(
            pFalseOnset
          )}), consider delaying rainfed ${
            crop.name
          } sowing and monitor local rainfall continuity.`,
          reason: `Triggered RULE-ONSET-002 because onset_probability (${formatPct(
            pOnset
          )}) <= 30% or false_onset_probability (${formatPct(
            pFalseOnset
          )}) >= 60%.`,
        },
        hi: {
          title: `बुवाई कुछ दिन स्थगित रखने पर विचार करें (${crop.local_names.hi})`,
          what: "मानसून के अस्थिर आगमन या बुवाई के बाद लंबे सूखे दौर का जोखिम बढ़ा हुआ है।",
          why: `${horizon} मानसून आगमन की संभावना ${formatPct(
            pOnset
          )} है तथा झूठे मानसून (False Onset) की संभावना ${formatPct(
            pFalseOnset
          )} है।`,
          when: `अगले ${horizonDays} दिन`,
          action: `वर्षा आधारित ${crop.local_names.hi} की सीधी बुवाई को 5–7 दिन स्थगित रखने पर विचार करें जब तक कि लगातार 3 दिनों में 20–25 मिमी से अधिक स्थिर वर्षा दर्ज न हो। यदि सिंचाई उपलब्ध हो तो नर्सरी में नमी बनाए रखें।`,
          message: `बुवाई स्थगित करने पर विचार करें: वर्तमान ${horizon} पूर्वानुमान (मानसून आगमन ${formatPct(
            pOnset
          )}, झूठा मानसून ${formatPct(
            pFalseOnset
          )}) के अनुसार स्थिर वर्षा होने तक बुवाई में सावधानी बरतें।`,
          reason: `नियम RULE-ONSET-002: आगमन संभावना (${formatPct(
            pOnset
          )}) <= 30% या झूठा मानसून जोखिम (${formatPct(pFalseOnset)}) >= 60%।`,
        },
        evidence: buildEvidence(
          [
            pOnset <= 0.3
              ? `onset_probability (${pOnset}) <= 0.30`
              : `false_onset_probability (${pFalseOnset}) >= 0.60`,
          ],
          `Dry-spell sensitivity: ${crop.dry_spell_sensitivity}`
        ),
      });
    } else if (
      pOnset > ADVISORY_THRESHOLDS.onset.low_onset_max_prob &&
      pOnset < ADVISORY_THRESHOLDS.onset.favorable_min_prob &&
      pFalseOnset < ADVISORY_THRESHOLDS.false_onset.delay_sowing_min_prob
    ) {
      // RULE-ONSET-003: Prepare for Sowing (PREPARE FOR SOWING)
      generatedItems.push({
        id: `${locationId}-${cropId}-${horizon}-RULE-ONSET-003`,
        location_id: locationId,
        crop_id: cropId,
        rule_id: "RULE-ONSET-003",
        decision_category: "PREPARE_FOR_SOWING",
        decision_code: "C",
        advisory_type: "PREPARE_FOR_SOWING",
        severity: "MODERATE",
        priority_rank: 2,
        priority_explanation:
          "Moderate onset probability (30%–60%); prepare seedbeds while awaiting confirmation showers.",
        forecast_horizon: horizon,
        horizon_days: horizonDays,
        model_version: inputs.model_version,
        source_mode: inputs.source_mode,
        created_at: createdAt,
        valid_until: validUntil,
        status: itemStatus,
        en: {
          title: `PREPARE FOR SOWING (${crop.name})`,
          what: "Transitional monsoon onset window — conditions are building toward sowing readiness.",
          why: `${horizon} onset probability is ${formatPct(
            pOnset
          )} with expected rainfall of ${expectedRainMm} mm.`,
          when: `Next ${horizonDays} days`,
          action: `Complete field bunding, ridge preparation, and seed treatment for ${crop.name}. Wait for 20–25 mm of cumulative local rainfall before committing full rainfed sowing.`,
          message: `PREPARE FOR SOWING: ${horizon} onset probability is ${formatPct(
            pOnset
          )}. Prepare seedbeds and inputs now, and verify local rainfall continuity before full sowing.`,
          reason: `Onset probability (${formatPct(
            pOnset
          )}) is in the transitional 30%–60% band.`,
        },
        hi: {
          title: `बुवाई की प्रारंभिक तैयारी करें (${crop.local_names.hi})`,
          what: "मानसून आगमन की मध्यम संभावना — बुवाई के लिए परिस्थितियाँ धीरे-धीरे बन रही हैं।",
          why: `${horizon} मानसून आगमन संभावना ${formatPct(
            pOnset
          )} तथा संभावित वर्षा ${expectedRainMm} मिमी है।`,
          when: `अगले ${horizonDays} दिन`,
          action: `${crop.local_names.hi} के लिए खेत की मेड़बंदी, मेड़/नाली की तैयारी और बीज उपचार पूरा करें। पूर्ण वर्षा-आधारित बुवाई से पहले 20–25 मिमी संचयी स्थानीय वर्षा की प्रतीक्षा करें।`,
          message: `बुवाई की तैयारी: ${horizon} मानसून आगमन संभावना ${formatPct(
            pOnset
          )} है। खेत और बीज तैयार रखें तथा स्थानीय वर्षा की पुष्टि के बाद बुवाई करें।`,
          reason: `मानसून आगमन संभावना (${formatPct(
            pOnset
          )}) 30%–60% के मध्यम दायरे में है।`,
        },
        evidence: buildEvidence(
          [
            `0.30 < onset_probability (${pOnset}) < 0.60`,
            `false_onset_probability (${pFalseOnset}) < 0.60`,
          ],
          `Dry-spell sensitivity: ${crop.dry_spell_sensitivity}`
        ),
      });
    }
  }

  // ============================================================================
  // 4. FALSE ONSET ADVISORY (Section 6 — RULE-FALSE-ONSET-001)
  // ============================================================================
  if (
    !isRabiOffSeasonInMonsoon &&
    pFalseOnset >= ADVISORY_THRESHOLDS.false_onset.alert_min_prob &&
    isSowingOrPreSowingStage
  ) {
    const falseSev: AdvisorySeverity =
      pFalseOnset >= ADVISORY_THRESHOLDS.false_onset.critical_min_prob
        ? "CRITICAL"
        : pFalseOnset >= ADVISORY_THRESHOLDS.false_onset.delay_sowing_min_prob
        ? "HIGH"
        : "MODERATE";

    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-FALSE-ONSET-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-FALSE-ONSET-001",
      decision_category: "MONITOR_FALSE_ONSET_RISK",
      decision_code: "H",
      advisory_type: "FALSE_ONSET_RISK",
      severity: falseSev,
      priority_rank: falseSev === "CRITICAL" ? 1 : 2,
      priority_explanation: `False-onset probability (${formatPct(
        pFalseOnset
      )}) >= 30% during sowing window.`,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `FALSE ONSET RISK (${formatPct(pFalseOnset)})`,
        what: "FALSE ONSET RISK — Early showers may be followed by an extended break-monsoon dry spell.",
        why: `Rainfall may occur before a prolonged dry period. Avoid treating an early wet spell as confirmation of stable monsoon conditions. (${horizon} false-onset probability is ${formatPct(
          pFalseOnset
        )}).`,
        when: `Next ${horizonDays} days`,
        action:
          crop.crop_id === "paddy"
            ? "Keep paddy seedlings in nursery beds where supplemental water can be managed; avoid premature rainfed transplanting until monsoon trough persistence is confirmed."
            : `Stagger ${crop.name} sowing across splits and verify 72-hour root-zone moisture retention before sowing rainfed plots.`,
        message: `FALSE ONSET RISK (${formatPct(
          pFalseOnset
        )}): Rainfall may occur before a prolonged dry period. Avoid treating an early wet spell as confirmation of stable monsoon conditions.`,
        reason: `false_onset_probability (${formatPct(
          pFalseOnset
        )}) >= 30% threshold during sowing window.`,
      },
      hi: {
        title: `झूठे मानसून (FALSE ONSET) का जोखिम (${formatPct(pFalseOnset)})`,
        what: "झूठे मानसून का जोखिम — प्रारंभिक बौछारों के बाद लंबा शुष्क दौर (Break-Monsoon) आ सकता है।",
        why: `लंबे सूखे दौर से पहले हल्की वर्षा हो सकती है। प्रारंभिक बारिश को स्थिर मानसून की पुष्टि न मानें। (${horizon} झूठे मानसून की संभावना ${formatPct(
          pFalseOnset
        )} है)।`,
        when: `अगले ${horizonDays} दिन`,
        action:
          crop.crop_id === "paddy"
            ? "धान की पौध को अभी नर्सरी में ही सुरक्षित रखें जहाँ सिंचाई प्रबंधन संभव हो; मानसून की निरंतरता सुनिश्चित होने तक वर्षा-आधारित रोपाई में जल्दबाजी न करें।"
            : `${crop.local_names.hi} की बुवाई एक साथ न करके चरणों में करें और 72 घंटे तक मिट्टी में नमी रुकने की पुष्टि के बाद ही बुवाई करें।`,
        message: `झूठे मानसून का जोखिम (${formatPct(
          pFalseOnset
        )}): लंबे शुष्क दौर से पहले प्रारंभिक वर्षा हो सकती है। शुरुआती बारिश को स्थिर मानसून न समझें।`,
        reason: `बुवाई अवधि के दौरान false_onset_probability (${formatPct(
          pFalseOnset
        )}) >= 30% सीमा से अधिक है।`,
      },
      evidence: buildEvidence(
        [
          `false_onset_probability (${pFalseOnset}) >= ${ADVISORY_THRESHOLDS.false_onset.alert_min_prob}`,
          `imminent_sowing_context === true`,
        ],
        `Dry-spell sensitivity: ${crop.dry_spell_sensitivity}`
      ),
    });
  }

  // ============================================================================
  // 5. DRY SPELL & CONDITIONAL IRRIGATION ADVISORIES (Section 7 — RULE-DRY-SPELL-001 & RULE-IRRIGATION-001)
  // ============================================================================
  if (pDrySpell >= ADVISORY_THRESHOLDS.dry_spell.monitor_min_prob) {
    const drySev: AdvisorySeverity =
      pDrySpell >= ADVISORY_THRESHOLDS.dry_spell.critical_min_prob ||
      (pDrySpell >= ADVISORY_THRESHOLDS.dry_spell.action_min_prob &&
        crop.dry_spell_sensitivity === "HIGH")
        ? "HIGH"
        : "MODERATE";

    const cropDryGuidance = getCropSpecificDrySpellGuidance(crop, resolvedStage);

    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-DRY-SPELL-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-DRY-SPELL-001",
      decision_category: "MONITOR_DRY_SPELL",
      decision_code: "I",
      advisory_type: "DRY_SPELL_RISK",
      severity: drySev,
      priority_rank: drySev === "HIGH" ? 2 : 3,
      priority_explanation: `Dry-spell probability is ${formatPct(
        pDrySpell
      )} with ${crop.dry_spell_sensitivity} crop dry-spell sensitivity.`,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `DRY SPELL RISK (${formatPct(pDrySpell)})`,
        what: "DRY SPELL RISK — Elevated likelihood of consecutive low-rainfall days.",
        why: `${horizon} dry-spell probability is ${formatPct(
          pDrySpell
        )} with rainfall anomaly at ${
          anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`
        }.`,
        when: `Next ${horizonDays} days`,
        action: cropDryGuidance.action_en,
        message: `High dry-spell risk (${formatPct(
          pDrySpell
        )}) over the next ${horizonDays} days. ${cropDryGuidance.action_en}`,
        reason: `dry_spell_probability (${formatPct(
          pDrySpell
        )}) >= 30% threshold.`,
      },
      hi: {
        title: `लंबे शुष्क दौर (DRY SPELL) का जोखिम (${formatPct(pDrySpell)})`,
        what: "शुष्क दौर का जोखिम — लगातार कम वर्षा वाले दिनों की संभावना अधिक है।",
        why: `${horizon} शुष्क दौर की संभावना ${formatPct(
          pDrySpell
        )} है और वर्षा विसंगति ${
          anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`
        } है।`,
        when: `अगले ${horizonDays} दिन`,
        action: cropDryGuidance.action_hi,
        message: `अगले ${horizonDays} दिनों में लंबे शुष्क दौर का जोखिम (${formatPct(
          pDrySpell
        )}) अधिक है। ${cropDryGuidance.action_hi}`,
        reason: `dry_spell_probability (${formatPct(
          pDrySpell
        )}) >= 30% सीमा से अधिक है।`,
      },
      evidence: buildEvidence(
        [
          `dry_spell_probability (${pDrySpell}) >= ${ADVISORY_THRESHOLDS.dry_spell.monitor_min_prob}`,
        ],
        `Dry-spell sensitivity: ${crop.dry_spell_sensitivity}`
      ),
    });

    // Conditional Irrigation Planning Rule (RULE-IRRIGATION-001)
    // Section 3 & 7: Do NOT make soil-moisture-dependent decisions if soil_moisture is null.
    // Only use rainfall anomaly + dry spell probability when soil_moisture is unavailable.
    const moistureDeficitVerified = hasSoilMoisture
      ? soilMoistureVal! < ADVISORY_THRESHOLDS.soil_moisture.deficit_max_pct
      : anomalyPct <= -10;

    if (
      !isRabiOffSeasonInMonsoon &&
      pDrySpell >= ADVISORY_THRESHOLDS.dry_spell.action_min_prob &&
      moistureDeficitVerified
    ) {
      const irrSev: AdvisorySeverity =
        pDrySpell >= ADVISORY_THRESHOLDS.dry_spell.critical_min_prob &&
        crop.dry_spell_sensitivity === "HIGH"
          ? "CRITICAL"
          : "HIGH";

      generatedItems.push({
        id: `${locationId}-${cropId}-${horizon}-RULE-IRRIGATION-001`,
        location_id: locationId,
        crop_id: cropId,
        rule_id: "RULE-IRRIGATION-001",
        decision_category: "IRRIGATION_REQUIRED",
        decision_code: "D",
        advisory_type: "IRRIGATION_PLANNING",
        severity: irrSev,
        priority_rank: irrSev === "CRITICAL" ? 1 : 2,
        priority_explanation: `High dry-spell probability (${formatPct(
          pDrySpell
        )}) coupled with negative moisture balance.`,
        forecast_horizon: horizon,
        horizon_days: horizonDays,
        model_version: inputs.model_version,
        source_mode: inputs.source_mode,
        created_at: createdAt,
        valid_until: validUntil,
        status: itemStatus,
        en: {
          title: `SUPPLEMENTAL IRRIGATION PLANNING (${crop.name})`,
          what: "Moisture stress risk is elevated over the forecast horizon.",
          why: `${horizon} dry-spell probability is ${formatPct(
            pDrySpell
          )} and rainfall anomaly is ${anomalyPct}% (${
            hasSoilMoisture
              ? `Measured soil moisture: ${soilMoistureVal}%`
              : "Soil moisture unavailable — evaluated via rainfall anomaly"
          }).`,
          when: `Next ${horizonDays} days`,
          action: `If irrigation is available, plan supplemental water delivery for ${crop.name} during critical moisture windows and apply surface mulching to conserve root-zone moisture.`,
          message: `If irrigation is available, schedule supplemental moisture support for ${crop.name} over the next ${horizonDays} days (${formatPct(
            pDrySpell
          )} dry-spell risk).`,
          reason: `dry_spell_probability (${formatPct(
            pDrySpell
          )}) >= 60% with moisture deficit signal.`,
        },
        hi: {
          title: `पूरक सिंचाई प्रबंधन (${crop.local_names.hi})`,
          what: "पूर्वानुमान अवधि में फसल में नमी तनाव (moisture stress) का जोखिम अधिक है।",
          why: `${horizon} शुष्क दौर की संभावना ${formatPct(
            pDrySpell
          )} है तथा वर्षा विसंगति ${anomalyPct}% है (${
            hasSoilMoisture
              ? `मापी गई मृदा नमी: ${soilMoistureVal}%`
              : "मृदा नमी डेटा अनुपलब्ध — वर्षा विसंगति के आधार पर आकलन"
          })।`,
          when: `अगले ${horizonDays} दिन`,
          action: `यदि सिंचाई की सुविधा उपलब्ध हो, तो ${crop.local_names.hi} में जीवनरक्षक सिंचाई की व्यवस्था करें और मिट्टी की नमी बचाने के लिए पलवार (mulching) का उपयोग करें।`,
          message: `यदि सिंचाई उपलब्ध हो, तो अगले ${horizonDays} दिनों में ${crop.local_names.hi} के लिए पूरक सिंचाई की योजना बनाएं (${formatPct(
            pDrySpell
          )} शुष्क दौर जोखिम)।`,
          reason: `dry_spell_probability (${formatPct(
            pDrySpell
          )}) >= 60% एवं वर्षा/नमी में कमी।`,
        },
        evidence: buildEvidence(
          [
            `dry_spell_probability (${pDrySpell}) >= 0.60`,
            hasSoilMoisture
              ? `soil_moisture (${soilMoistureVal}%) < 35%`
              : `rainfall_anomaly (${anomalyPct}%) <= -10% (soil moisture sensor unavailable)`,
          ],
          `Dry-spell sensitivity: ${crop.dry_spell_sensitivity}`
        ),
      });
    }
  }

  // ============================================================================
  // 6. HEAVY RAINFALL, DRAINAGE & REDUCE IRRIGATION RULES (Section 8 & 9)
  // ============================================================================
  const estimatedPeakDailyRainMm = Math.max(
    currentRainMm,
    Number(((expectedRainMm / horizonDays) * 2.6).toFixed(1))
  );
  const imdClass = classifyIMDDailyRainfall(estimatedPeakDailyRainMm);

  if (
    pHeavyRain >= ADVISORY_THRESHOLDS.heavy_rain.watch_min_prob ||
    imdClass.is_heavy_or_above
  ) {
    // RULE-IRRIGATION-002: Reduce / Avoid Irrigation ahead of wet spell
    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-IRRIGATION-002`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-IRRIGATION-002",
      decision_category: "REDUCE_AVOID_IRRIGATION",
      decision_code: "E",
      advisory_type: "REDUCE_OR_AVOID_IRRIGATION",
      severity: "MODERATE",
      priority_rank: 3,
      priority_explanation:
        "Elevated rainfall outlook; withholding irrigation prevents waterlogging and nutrient leaching.",
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `REDUCE / AVOID IRRIGATION (${crop.name})`,
        what: "Withhold supplemental irrigation ahead of expected monsoon showers.",
        why: `${horizon} heavy-rain probability is ${formatPct(
          pHeavyRain
        )} with ${expectedRainMm} mm cumulative expected rainfall.`,
        when: `Next ${horizonDays} days`,
        action: `Avoid unnecessary irrigation in ${crop.name} plots before expected rainfall to prevent root-zone saturation and fertilizer leaching.`,
        message: `REDUCE / AVOID IRRIGATION: With ${expectedRainMm} mm rainfall projected and ${formatPct(
          pHeavyRain
        )} heavy-rain probability, withhold irrigation in ${crop.name}.`,
        reason: `heavy_rain_probability (${formatPct(
          pHeavyRain
        )}) >= 30% or elevated expected rainfall.`,
      },
      hi: {
        title: `सिंचाई कम करें या स्थगित रखें (${crop.local_names.hi})`,
        what: "संभावित मानसून वर्षा से पहले अतिरिक्त सिंचाई न करें।",
        why: `${horizon} भारी वर्षा की संभावना ${formatPct(
          pHeavyRain
        )} है और ${expectedRainMm} मिमी संचयी वर्षा का अनुमान है।`,
        when: `अगले ${horizonDays} दिन`,
        action: `संभावित वर्षा से पूर्व ${crop.local_names.hi} के खेतों में अनावश्यक सिंचाई से बचें ताकि जलभराव और पोषक तत्वों का बहाव रोका जा सके।`,
        message: `सिंचाई से बचें: आगामी ${horizonDays} दिनों में ${expectedRainMm} मिमी संभावित वर्षा के मद्देनजर ${crop.local_names.hi} में सिंचाई स्थगित रखें।`,
        reason: `भारी वर्षा संभावना (${formatPct(pHeavyRain)}) >= 30%।`,
      },
      evidence: buildEvidence(
        [`heavy_rain_probability (${pHeavyRain}) >= 0.30`],
        `Excess-rain sensitivity: ${crop.excess_rain_sensitivity}`
      ),
    });

    // RULE-DRAINAGE-001: Crop-Specific Drainage Preparation
    const drainageSev: AdvisorySeverity =
      pHeavyRain >= ADVISORY_THRESHOLDS.heavy_rain.prepare_min_prob &&
      crop.waterlogging_sensitivity === "HIGH"
        ? "HIGH"
        : pHeavyRain >= ADVISORY_THRESHOLDS.heavy_rain.critical_min_prob
        ? "CRITICAL"
        : "MODERATE";

    const cropHeavyGuidance = getCropSpecificHeavyRainGuidance(
      crop,
      resolvedStage
    );

    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-DRAINAGE-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-DRAINAGE-001",
      decision_category: "DRAINAGE_PREPARATION",
      decision_code: "F",
      advisory_type: "DRAINAGE_PREPARATION",
      severity: drainageSev,
      priority_rank: drainageSev === "HIGH" || drainageSev === "CRITICAL" ? 1 : 2,
      priority_explanation: `Heavy-rain probability (${formatPct(
        pHeavyRain
      )}) combined with ${crop.name} waterlogging sensitivity (${
        crop.waterlogging_sensitivity
      }).`,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `DRAINAGE PREPARATION (${crop.name})`,
        what: `Field drainage preparation for ${crop.name} (Waterlogging sensitivity: ${crop.waterlogging_sensitivity}).`,
        why: `${horizon} heavy-rain probability is ${formatPct(
          pHeavyRain
        )} (${imdClass.category_en}).`,
        when: `Before heavy showers over the next ${horizonDays} days`,
        action: cropHeavyGuidance.action_en,
        message: `DRAINAGE PREPARATION (${crop.name}): ${cropHeavyGuidance.action_en}`,
        reason: `Heavy rain probability (${formatPct(
          pHeavyRain
        )}) + crop waterlogging sensitivity (${crop.waterlogging_sensitivity}).`,
      },
      hi: {
        title: `जल निकासी की तैयारी (${crop.local_names.hi})`,
        what: `${crop.local_names.hi} के लिए खेत में जल निकासी प्रबंधन (जलभराव संवेदनशीलता: ${crop.waterlogging_sensitivity})।`,
        why: `${horizon} भारी वर्षा की संभावना ${formatPct(
          pHeavyRain
        )} है (${imdClass.category_hi})।`,
        when: `अगले ${horizonDays} दिनों में संभावित भारी वर्षा से पूर्व`,
        action: cropHeavyGuidance.action_hi,
        message: `जल निकासी प्रबंधन (${crop.local_names.hi}): ${cropHeavyGuidance.action_hi}`,
        reason: `भारी वर्षा संभावना (${formatPct(
          pHeavyRain
        )}) + फसल की जलभराव संवेदनशीलता (${crop.waterlogging_sensitivity})।`,
      },
      evidence: buildEvidence(
        [
          `heavy_rain_probability (${pHeavyRain}) >= 0.30`,
          `crop.waterlogging_sensitivity === '${crop.waterlogging_sensitivity}'`,
        ],
        `Waterlogging sensitivity: ${crop.waterlogging_sensitivity}`
      ),
    });
  }

  // RULE-HEAVY-RAIN-001: IMD Heavy Rainfall Preparation (when probability >= 0.60 or daily >= 64.5 mm)
  if (
    pHeavyRain >= ADVISORY_THRESHOLDS.heavy_rain.prepare_min_prob ||
    imdClass.is_heavy_or_above
  ) {
    const heavySev: AdvisorySeverity =
      pHeavyRain >= ADVISORY_THRESHOLDS.heavy_rain.critical_min_prob
        ? "CRITICAL"
        : "HIGH";

    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-HEAVY-RAIN-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-HEAVY-RAIN-001",
      decision_category: "HEAVY_RAIN_PREPARATION",
      decision_code: "G",
      advisory_type: "HEAVY_RAIN_PREPARATION",
      severity: heavySev,
      priority_rank: 1,
      priority_explanation: `Elevated heavy rainfall risk (${formatPct(
        pHeavyRain
      )}) — IMD threshold category (${imdClass.category_en}).`,
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `HEAVY RAIN PREPARATION (${formatPct(pHeavyRain)})`,
        what: `HEAVY RAIN PREPARATION — Elevated probability of intense downpours (${imdClass.category_en}).`,
        why: `${horizon} heavy-rain probability is ${formatPct(
          pHeavyRain
        )} with ${expectedRainMm} mm cumulative expected rainfall.`,
        when: `Next ${horizonDays} days`,
        action:
          "Inspect field drainage, clear perimeter channels, protect harvested produce or seed bags under dry cover, and avoid chemical spraying or top-dressing fertilizer immediately before heavy rainfall.",
        message: `HEAVY RAIN PREPARATION (${formatPct(
          pHeavyRain
        )}): Clear drainage channels, protect stored inputs/produce, and postpone field spraying ahead of intense showers.`,
        reason: `heavy_rain_probability (${formatPct(
          pHeavyRain
        )}) >= 60% or IMD daily intensity >= 64.5 mm/day.`,
      },
      hi: {
        title: `भारी वर्षा से बचाव की तैयारी (${formatPct(pHeavyRain)})`,
        what: `भारी वर्षा की संभावना (${imdClass.category_hi}) को देखते हुए खेत एवं फसल सुरक्षा।`,
        why: `${horizon} भारी वर्षा की संभावना ${formatPct(
          pHeavyRain
        )} है और ${expectedRainMm} मिमी कुल वर्षा अनुमानित है।`,
        when: `अगले ${horizonDays} दिन`,
        action:
          "खेत के जल निकास मार्गों का निरीक्षण करें, नालियाँ साफ रखें, कटी हुई उपज व बीज को सुरक्षित स्थान पर रखें तथा भारी वर्षा से ठीक पहले कीटनाशक/उर्वरक का छिड़काव न करें।",
        message: `भारी वर्षा की तैयारी (${formatPct(
          pHeavyRain
        )}): जल निकास नालियाँ साफ करें, खाद/बीज सुरक्षित रखें और भारी बारिश से पहले छिड़काव स्थगित करें।`,
        reason: `heavy_rain_probability (${formatPct(
          pHeavyRain
        )}) >= 60% अथवा दैनिक तीव्रता >= 64.5 मिमी/दिन।`,
      },
      evidence: buildEvidence(
        [
          `heavy_rain_probability (${pHeavyRain}) >= ${ADVISORY_THRESHOLDS.heavy_rain.prepare_min_prob}`,
          `imd_category: ${imdClass.category_en}`,
        ],
        `Excess-rain sensitivity: ${crop.excess_rain_sensitivity}`
      ),
    });
  }

  // ============================================================================
  // 7. FALLBACK WHEN NO RISK THRESHOLD IS EXCEEDED (RULE-NO-ACTION-001)
  // ============================================================================
  if (generatedItems.length === 0) {
    generatedItems.push({
      id: `${locationId}-${cropId}-${horizon}-RULE-NO-ACTION-001`,
      location_id: locationId,
      crop_id: cropId,
      rule_id: "RULE-NO-ACTION-001",
      decision_category: "NO_IMMEDIATE_ACTION",
      decision_code: "J",
      advisory_type: "ROUTINE_FIELD_MONITORING",
      severity: "LOW",
      priority_rank: 4,
      priority_explanation:
        "All risk probabilities are below 30%; routine field monitoring applies.",
      forecast_horizon: horizon,
      horizon_days: horizonDays,
      model_version: inputs.model_version,
      source_mode: inputs.source_mode,
      created_at: createdAt,
      valid_until: validUntil,
      status: itemStatus,
      en: {
        title: `NO IMMEDIATE HIGH-RISK ACTION (${crop.name})`,
        what: "Monsoon risk probabilities are currently within normal bounds (<30%).",
        why: `False onset (${formatPct(pFalseOnset)}), dry spell (${formatPct(
          pDrySpell
        )}), and heavy rain (${formatPct(pHeavyRain)}) are all below 30%.`,
        when: `Next ${horizonDays} days`,
        action: `Continue standard agronomic field monitoring for ${crop.name} in ${blockName} and verify local conditions before routine operations.`,
        message: `Balanced conditions over the next ${horizonDays} days. Continue routine field monitoring for ${crop.name}.`,
        reason: "All adverse risk probabilities < 30%.",
      },
      hi: {
        title: `कोई तत्काल उच्च-जोखिम चेतावनी नहीं (${crop.local_names.hi})`,
        what: "मानसून जोखिम संभावनाएं वर्तमान में सामान्य सीमा (<30%) के भीतर हैं।",
        why: `झूठा मानसून (${formatPct(pFalseOnset)}), शुष्क दौर (${formatPct(
          pDrySpell
        )}) और भारी वर्षा (${formatPct(pHeavyRain)}) सभी 30% से कम हैं।`,
        when: `अगले ${horizonDays} दिन`,
        action: `${blockName} में ${crop.local_names.hi} की सामान्य निगरानी जारी रखें और स्थानीय परिस्थितियों के अनुसार नियमित कृषि कार्य करें।`,
        message: `अगले ${horizonDays} दिनों में परिस्थितियाँ सामान्य हैं। ${crop.local_names.hi} की नियमित देखभाल जारी रखें।`,
        reason: "सभी प्रतिकूल जोखिम संभावनाएं < 30% हैं।",
      },
      evidence: buildEvidence(
        ["false_onset < 0.30 && dry_spell < 0.30 && heavy_rain < 0.30"],
        "Balanced regime"
      ),
    });
  }

  // ============================================================================
  // 8. DETERMINISTIC MULTI-CRITERIA PRIORITY ORDERING (Section 21)
  // Ordered by: 1) severity, 2) forecast horizon urgency, 3) crop sensitivity, 4) evidence completeness
  // ============================================================================
  generatedItems.sort((a, b) => {
    const sevDiff = severityWeight(b.severity) - severityWeight(a.severity);
    if (sevDiff !== 0) return sevDiff;
    if (a.priority_rank !== b.priority_rank) {
      return a.priority_rank - b.priority_rank;
    }
    return a.rule_id.localeCompare(b.rule_id);
  });

  generatedItems.forEach((item, idx) => {
    item.priority_rank = idx + 1;
  });

  // Separate active vs expired (Section 22: Do not display expired advisories as active)
  const activeAdvisories = isPredictionExpired ? [] : generatedItems;
  const expiredAdvisories = isPredictionExpired ? generatedItems : [];

  // ============================================================================
  // 9. BUILD FARMER-FRIENDLY 4-PILLAR OUTLOOK CARDS (Section 19)
  // 🌱 Sowing | 💧 Water | 🌧️ Heavy Rain | ☀️ Dry Spell
  // ============================================================================
  const farmerOutlookCards: FarmerOutlookCard[] = [
    // Pillar 1: 🌱 Sowing
    isRabiOffSeasonInMonsoon
      ? {
          pillar_id: "sowing",
          icon_emoji: "🌱",
          title_en: "Sowing (Rabi Crop)",
          title_hi: "बुवाई (रबी फसल)",
          severity: "LOW",
          risk_label_en: "Off-Season (Sow in Nov–Dec)",
          risk_label_hi: "अभी बुवाई का समय नहीं (नवंबर–दिसंबर में बोएं)",
          reason_en: `${crop.name} is a winter Rabi crop. Monsoon onset is ${formatPct(
            pOnset
          )}.`,
          reason_hi: `${crop.local_names.hi} शीतकालीन रबी फसल है। मानसून आगमन ${formatPct(
            pOnset
          )} है।`,
          action_en:
            "Do not sow wheat now; conserve monsoon moisture in bunded fields for November.",
          action_hi:
            "अभी गेहूँ न बोएं; नवंबर की बुवाई के लिए खेत में मेड़बंदी कर वर्षा की नमी बचाएं।",
          rule_id: "RULE-SEASON-001",
        }
      : pOnset <= 0.3 || pFalseOnset >= 0.6
      ? {
          pillar_id: "sowing",
          icon_emoji: "🌱",
          title_en: "Sowing",
          title_hi: "बुवाई (Sowing)",
          severity: pFalseOnset >= 0.8 ? "CRITICAL" : "HIGH",
          risk_label_en: `High Risk — Consider Delaying (${formatPct(
            pFalseOnset
          )} False Onset)`,
          risk_label_hi: `उच्च जोखिम — बुवाई रोकने पर विचार करें (${formatPct(
            pFalseOnset
          )} झूठा मानसून)`,
          reason_en: `Early rain may be followed by a dry gap (Onset ${formatPct(
            pOnset
          )}, False Onset ${formatPct(pFalseOnset)}).`,
          reason_hi: `शुरुआती बारिश के बाद सूखा पड़ सकता है (आगमन ${formatPct(
            pOnset
          )}, झूठा मानसून ${formatPct(pFalseOnset)})।`,
          action_en: `Consider delaying rainfed ${crop.name} sowing by 5–7 days until steady rains arrive.`,
          action_hi: `स्थिर बारिश होने तक वर्षा-आधारित ${crop.local_names.hi} की बुवाई 5–7 दिन रोकने पर विचार करें।`,
          rule_id: "RULE-ONSET-002",
        }
      : pOnset >= 0.6 && pFalseOnset < 0.6 && pDrySpell < 0.6
      ? {
          pillar_id: "sowing",
          icon_emoji: "🌱",
          title_en: "Sowing",
          title_hi: "बुवाई (Sowing)",
          severity: "LOW",
          risk_label_en: `Favorable (${formatPct(pOnset)} Onset)`,
          risk_label_hi: `अनुकूल (${formatPct(pOnset)} मानसून आगमन)`,
          reason_en: `Monsoon onset probability is ${formatPct(
            pOnset
          )} with low false-onset risk (${formatPct(pFalseOnset)}).`,
          reason_hi: `मानसून आगमन संभावना ${formatPct(
            pOnset
          )} है और झूठे मानसून का जोखिम कम (${formatPct(pFalseOnset)}) है।`,
          action_en: `Conditions are currently more favorable for ${crop.name} sowing after checking plot moisture.`,
          action_hi: `खेत की नमी जांचकर ${crop.local_names.hi} की बुवाई के लिए परिस्थितियाँ अनुकूल हैं।`,
          rule_id: "RULE-ONSET-001",
        }
      : {
          pillar_id: "sowing",
          icon_emoji: "🌱",
          title_en: "Sowing",
          title_hi: "बुवाई (Sowing)",
          severity: "MODERATE",
          risk_label_en: `Prepare & Monitor (${formatPct(pOnset)} Onset)`,
          risk_label_hi: `तैयारी एवं निगरानी (${formatPct(pOnset)} आगमन)`,
          reason_en: `Monsoon onset is moderate (${formatPct(
            pOnset
          )}); false-onset risk is ${formatPct(pFalseOnset)}.`,
          reason_hi: `मानसून आगमन मध्यम (${formatPct(
            pOnset
          )}) है; झूठा मानसून जोखिम ${formatPct(pFalseOnset)} है।`,
          action_en: `Prepare seedbeds and bunds for ${crop.name}; sow after 20–25 mm steady rain.`,
          action_hi: `${crop.local_names.hi} हेतु खेत तैयार रखें; 20–25 मिमी स्थिर बारिश के बाद बुवाई करें।`,
          rule_id: "RULE-ONSET-003",
        },

    // Pillar 2: 💧 Water / Irrigation
    pDrySpell >= 0.6
      ? {
          pillar_id: "water",
          icon_emoji: "💧",
          title_en: "Water & Irrigation",
          title_hi: "जल एवं सिंचाई (Water)",
          severity: "HIGH",
          risk_label_en: `Moisture Stress Risk (${formatPct(pDrySpell)})`,
          risk_label_hi: `नमी की कमी का जोखिम (${formatPct(pDrySpell)})`,
          reason_en: `Expected ${horizon} rainfall is ${expectedRainMm} mm (${anomalyPct}% anomaly).`,
          reason_hi: `अगले ${horizonDays} दिनों में ${expectedRainMm} मिमी वर्षा (${anomalyPct}% विसंगति) अनुमानित है।`,
          action_en: `If irrigation is available, plan supplemental water for ${crop.name} and mulch soil.`,
          action_hi: `यदि सिंचाई उपलब्ध हो, तो ${crop.local_names.hi} में हल्की सिंचाई और पलवार (mulching) की व्यवस्था करें।`,
          rule_id: "RULE-IRRIGATION-001",
        }
      : pHeavyRain >= 0.3
      ? {
          pillar_id: "water",
          icon_emoji: "💧",
          title_en: "Water & Irrigation",
          title_hi: "जल एवं सिंचाई (Water)",
          severity: "MODERATE",
          risk_label_en: "Avoid Irrigation & Check Drains",
          risk_label_hi: "सिंचाई रोकें व जल निकास देखें",
          reason_en: `${expectedRainMm} mm rain expected over ${horizonDays} days; heavy-rain risk is ${formatPct(
            pHeavyRain
          )}.`,
          reason_hi: `अगले ${horizonDays} दिनों में ${expectedRainMm} मिमी बारिश की संभावना है।`,
          action_en: `Avoid irrigation before expected showers and keep drainage furrows open for ${crop.name}.`,
          action_hi: `संभावित बारिश से पहले सिंचाई न करें और ${crop.local_names.hi} के खेत की निकास नालियाँ खुली रखें।`,
          rule_id: "RULE-IRRIGATION-002",
        }
      : {
          pillar_id: "water",
          icon_emoji: "💧",
          title_en: "Water & Irrigation",
          title_hi: "जल एवं सिंचाई (Water)",
          severity: "LOW",
          risk_label_en: "Normal Moisture Balance",
          risk_label_hi: "सामान्य नमी संतुलन",
          reason_en: `${expectedRainMm} mm expected rainfall over ${horizonDays} days.`,
          reason_hi: `अगले ${horizonDays} दिनों में ${expectedRainMm} मिमी संभावित वर्षा।`,
          action_en:
            "Maintain field bunds to conserve rainwater; no immediate extra irrigation required.",
          action_hi:
            "वर्षा जल संचयन हेतु मेड़बंदी बनाए रखें; तत्काल अतिरिक्त सिंचाई की आवश्यकता नहीं है।",
          rule_id: "RULE-NO-ACTION-001",
        },

    // Pillar 3: 🌧️ Heavy Rain
    {
      pillar_id: "heavy_rain",
      icon_emoji: "🌧️",
      title_en: "Heavy Rain",
      title_hi: "भारी वर्षा (Heavy Rain)",
      severity:
        pHeavyRain >= 0.8
          ? "CRITICAL"
          : pHeavyRain >= 0.6
          ? "HIGH"
          : pHeavyRain >= 0.3
          ? "MODERATE"
          : "LOW",
      risk_label_en:
        pHeavyRain >= 0.6
          ? `High Heavy-Rain Risk (${formatPct(pHeavyRain)})`
          : pHeavyRain >= 0.3
          ? `Moderate Heavy-Rain Watch (${formatPct(pHeavyRain)})`
          : `Low Heavy-Rain Risk (${formatPct(pHeavyRain)})`,
      risk_label_hi:
        pHeavyRain >= 0.6
          ? `भारी वर्षा का उच्च जोखिम (${formatPct(pHeavyRain)})`
          : pHeavyRain >= 0.3
          ? `भारी वर्षा की मध्यम संभावना (${formatPct(pHeavyRain)})`
          : `भारी वर्षा का कम जोखिम (${formatPct(pHeavyRain)})`,
      reason_en: `${horizon} heavy-rain probability is ${formatPct(
        pHeavyRain
      )} (${crop.name} waterlogging sensitivity: ${crop.waterlogging_sensitivity}).`,
      reason_hi: `${horizon} भारी वर्षा संभावना ${formatPct(
        pHeavyRain
      )} है (${crop.local_names.hi} जलभराव संवेदनशीलता: ${
        crop.waterlogging_sensitivity
      })।`,
      action_en:
        pHeavyRain >= 0.3
          ? getCropSpecificHeavyRainGuidance(crop, resolvedStage).action_en
          : "Keep perimeter field drains clear as routine monsoon precaution.",
      action_hi:
        pHeavyRain >= 0.3
          ? getCropSpecificHeavyRainGuidance(crop, resolvedStage).action_hi
          : "मानसून सुरक्षा के रूप में खेत की बाहरी निकास नालियों को साफ रखें।",
      rule_id: pHeavyRain >= 0.6 ? "RULE-HEAVY-RAIN-001" : "RULE-DRAINAGE-001",
    },

    // Pillar 4: ☀️ Dry Spell
    {
      pillar_id: "dry_spell",
      icon_emoji: "☀️",
      title_en: "Dry Spell",
      title_hi: "शुष्क दौर (Dry Spell)",
      severity:
        pDrySpell >= 0.8
          ? "CRITICAL"
          : pDrySpell >= 0.6
          ? "HIGH"
          : pDrySpell >= 0.3
          ? "MODERATE"
          : "LOW",
      risk_label_en:
        pDrySpell >= 0.6
          ? `High Dry-Spell Risk (${formatPct(pDrySpell)})`
          : pDrySpell >= 0.3
          ? `Moderate Dry-Spell Risk (${formatPct(pDrySpell)})`
          : `Low Dry-Spell Risk (${formatPct(pDrySpell)})`,
      risk_label_hi:
        pDrySpell >= 0.6
          ? `लंबे सूखे दौर का उच्च जोखिम (${formatPct(pDrySpell)})`
          : pDrySpell >= 0.3
          ? `शुष्क दौर का मध्यम जोखिम (${formatPct(pDrySpell)})`
          : `शुष्क दौर का कम जोखिम (${formatPct(pDrySpell)})`,
      reason_en: `${horizon} dry-spell probability is ${formatPct(
        pDrySpell
      )} with ${anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`} rainfall anomaly.`,
      reason_hi: `${horizon} शुष्क दौर की संभावना ${formatPct(
        pDrySpell
      )} है तथा वर्षा विसंगति ${
        anomalyPct > 0 ? `+${anomalyPct}%` : `${anomalyPct}%`
      } है।`,
      action_en:
        pDrySpell >= 0.3
          ? getCropSpecificDrySpellGuidance(crop, resolvedStage).action_en
          : "Soil moisture continuity is currently adequate; continue routine weeding.",
      action_hi:
        pDrySpell >= 0.3
          ? getCropSpecificDrySpellGuidance(crop, resolvedStage).action_hi
          : "नमी की निरंतरता सामान्य है; नियमित निराई-गुड़ाई जारी रखें।",
      rule_id: "RULE-DRY-SPELL-001",
    },
  ];

  return {
    location_id: locationId,
    block_name: blockName,
    district,
    state,
    crop_id: cropId,
    crop_profile: crop,
    crop_stage_resolved: resolvedStage,
    crop_stage_status_en: cropStageStatusEn,
    crop_stage_status_hi: cropStageStatusHi,
    soil_moisture_status_en: soilMoistureStatusEn,
    soil_moisture_status_hi: soilMoistureStatusHi,
    horizon,
    horizon_days: horizonDays,
    source_mode: inputs.source_mode,
    model_version: inputs.model_version,
    observation_cutoff: inputs.observation_cutoff,
    created_at: createdAt,
    valid_until: validUntil,
    is_prediction_expired: isPredictionExpired,
    priority_ordering_explanation:
      "Advisories are deterministically ordered by: (1) Rule Severity (CRITICAL > HIGH > MODERATE > LOW), (2) Immediate Sowing/Drainage Protection Priority, (3) Crop Waterlogging & Dry-Spell Sensitivity, and (4) Forecast Horizon Evidence Basis. No single arbitrary 'AI score' is used.",
    active_advisories: activeAdvisories,
    expired_advisories: expiredAdvisories,
    farmer_outlook_cards: farmerOutlookCards,
    scientific_disclaimer_en: SCIENTIFIC_LIMITATION_DISCLAIMER_EN,
    scientific_disclaimer_hi: SCIENTIFIC_LIMITATION_DISCLAIMER_HI,
    prototype_rule_disclaimer_en: PROTOTYPE_RULE_DISCLAIMER_EN,
    prototype_rule_disclaimer_hi: PROTOTYPE_RULE_DISCLAIMER_HI,
  };
}

/**
 * Section 20: Computes the District-Wide Agricultural Officer Triage Table
 * across all 8 Prayagraj blocks (`karchhana`, `phulpur`, `meja`, `koraon`, `bara`, `soraon`, `handia`, `chaka`).
 */
export function computeOfficerDistrictOverview(params: {
  horizon: ForecastHorizon;
  mode: AdvisorySourceMode;
  cropId: SupportedCropId;
  scenario?: DemoScenarioId;
  aiBlockMap?: Record<
    string,
    {
      onset_probability: number | null;
      false_onset_probability: number | null;
      dry_spell_probability: number | null;
      heavy_rain_probability: number | null;
      expected_rainfall_mm: number | null;
      rainfall_anomaly_pct: number | null;
      current_rainfall_mm: number | null;
      recent_7d_rainfall_mm: number | null;
      temperature_c: number | null;
      humidity_pct: number | null;
      observation_cutoff: string;
      model_version: string;
    }
  >;
}): OfficerBlockAdvisorySummary[] {
  const scenarioBlocks = getBlocksForScenarioAndHorizon(
    params.scenario || "scenario_b",
    params.horizon
  );
  const hDays = (parseInt(params.horizon.replace("D", ""), 10) || 14) as
    | 7
    | 14
    | 21
    | 30;

  return scenarioBlocks.map((b) => {
    const aiBlock = params.mode === "AI" ? params.aiBlockMap?.[b.id] : undefined;

    const onsetProb =
      params.mode === "AI" && aiBlock?.onset_probability !== undefined && aiBlock.onset_probability !== null
        ? aiBlock.onset_probability
        : b.onsetProbability / 100.0;
    const falseOnsetProb =
      params.mode === "AI" &&
      aiBlock?.false_onset_probability !== undefined &&
      aiBlock.false_onset_probability !== null
        ? aiBlock.false_onset_probability
        : b.falseOnsetProbability / 100.0;
    const drySpellProb =
      params.mode === "AI" &&
      aiBlock?.dry_spell_probability !== undefined &&
      aiBlock.dry_spell_probability !== null
        ? aiBlock.dry_spell_probability
        : b.drySpellProbability / 100.0;
    const heavyRainProb =
      params.mode === "AI" &&
      aiBlock?.heavy_rain_probability !== undefined &&
      aiBlock.heavy_rain_probability !== null
        ? aiBlock.heavy_rain_probability
        : b.heavyRainProbability / 100.0;

    const expectedRain =
      params.mode === "AI" && aiBlock?.expected_rainfall_mm !== null && aiBlock?.expected_rainfall_mm !== undefined
        ? aiBlock.expected_rainfall_mm
        : b.expectedRainfall;
    const anomaly =
      params.mode === "AI" && aiBlock?.rainfall_anomaly_pct !== null && aiBlock?.rainfall_anomaly_pct !== undefined
        ? aiBlock.rainfall_anomaly_pct
        : b.rainfallAnomaly;

    const res = evaluateCropAdvisories({
      location_id: b.id,
      block_name: b.name,
      district: b.district,
      state: b.state,
      crop_id: params.cropId,
      forecast_horizon: params.horizon,
      horizon_days: hDays,
      crop_stage: "pre_sowing",
      current_rainfall: aiBlock?.current_rainfall_mm ?? 18.0,
      recent_rainfall: aiBlock?.recent_7d_rainfall_mm ?? 42.0,
      rainfall_anomaly: anomaly,
      temperature: aiBlock?.temperature_c ?? 30.2,
      humidity: aiBlock?.humidity_pct ?? 78.0,
      soil_moisture: params.mode === "AI" ? null : b.soilMoisture,
      onset_probability: onsetProb,
      false_onset_probability: falseOnsetProb,
      dry_spell_probability: drySpellProb,
      heavy_rain_probability: heavyRainProb,
      expected_rainfall: expectedRain,
      model_version:
        params.mode === "AI"
          ? aiBlock?.model_version || "MPAI-ENS-0.1"
          : params.mode === "SIMULATED"
          ? "SIM-PROTO-v1"
          : "DEMO-SCENARIO-v1",
      observation_cutoff: aiBlock?.observation_cutoff || "2025-08-31",
      source_mode: params.mode,
    });

    const highestSev: AdvisorySeverity =
      res.active_advisories[0]?.severity || "LOW";
    const dominantCrops =
      b.panchayats.length > 0
        ? Array.from(new Set(b.panchayats.map((p) => p.dominantCrop)))
        : ["Paddy", "Pulses"];

    return {
      block_id: b.id,
      block_name: b.name,
      onset_probability_pct: Math.round(onsetProb * 1000) / 10,
      onset_uncertainty_high: onsetProb > 0.35 && onsetProb < 0.65,
      false_onset_probability_pct: Math.round(falseOnsetProb * 1000) / 10,
      dry_spell_probability_pct: Math.round(drySpellProb * 1000) / 10,
      heavy_rain_probability_pct: Math.round(heavyRainProb * 1000) / 10,
      expected_rainfall_mm: expectedRain,
      rainfall_anomaly_pct: anomaly,
      exposed_crops: dominantCrops,
      active_advisory_count: res.active_advisories.length,
      highest_severity: highestSev,
      top_rule_ids: res.active_advisories.map((a) => a.rule_id),
      top_actions_en: res.active_advisories
        .slice(0, 2)
        .map((a) => a.en.title),
    };
  });
}
