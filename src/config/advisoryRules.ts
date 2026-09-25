/**
 * MonsoonPulse AI — Configurable Crop Profiles, Thresholds & Deterministic Rules
 * (src/config/advisoryRules.ts)
 *
 * Prompt 8 Requirements 1, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16, 24, 27, 28:
 * - Stores configurable crop agronomic metadata for Paddy, Maize, Pulses,
 *   Soybean, Cotton, and Wheat.
 * - Defines boundary-exact probability thresholds (0.30, 0.60, 0.80) and
 *   IMD-aligned heavy rainfall categories.
 * - Defines 12 independently testable deterministic rules with reviewed
 *   English and Hindi (Unicode) templates.
 */

import {
  AdvisorySeverity,
  CanonicalGrowthStage,
  CropProfileMetadata,
  DecisionCategory,
  SupportedCropId,
} from "@/types/advisory";

export const SCIENTIFIC_LIMITATION_DISCLAIMER_EN =
  "MonsoonPulse AI provides experimental decision support based on model outputs and available observations. Agricultural recommendations should be validated against local agronomic conditions and official extension guidance before operational deployment.";

export const SCIENTIFIC_LIMITATION_DISCLAIMER_HI =
  "मानसूनपल्स एआई (MonsoonPulse AI) मॉडल के परिणामों और उपलब्ध प्रेक्षणों के आधार पर प्रयोगात्मक निर्णय-सहायता प्रदान करता है। किसी भी कृषि कार्य को अपनाने से पहले स्थानीय कृषि परिस्थितियों और आधिकारिक कृषि विस्तार मार्गदर्शन से पुष्टि अवश्य करें।";

export const PROTOTYPE_RULE_DISCLAIMER_EN =
  "These are prototype decision-support rules and are not official agricultural advisories.";

export const PROTOTYPE_RULE_DISCLAIMER_HI =
  "ये प्रोटोटाइप निर्णय-सहायता नियम हैं और आधिकारिक सरकारी कृषि परामर्श नहीं हैं।";

/**
 * Configurable Probability & Meteorological Thresholds (Sections 5, 6, 7, 8, 26)
 * Tested at exact boundary values: 0.30, 0.60, 0.80
 */
export const ADVISORY_THRESHOLDS = {
  // Probability band cutoffs [0.00, 1.00]
  probability: {
    low_max: 0.3, // < 0.30 is LOW
    moderate_min: 0.3, // >= 0.30 is MODERATE
    high_min: 0.6, // >= 0.60 is HIGH
    critical_min: 0.8, // >= 0.80 is CRITICAL / VERY HIGH
  },

  // Sowing & Onset rules (Section 5)
  onset: {
    favorable_min_prob: 0.6, // >= 0.60 onset probability required for SOW_NOW
    low_onset_max_prob: 0.3, // <= 0.30 onset probability triggers DELAY_SOWING
    min_recent_7d_rain_mm: 20.0, // Minimum recent 7D rainfall (mm) for adequate seedbed moisture
  },

  // False onset rules (Section 6)
  false_onset: {
    alert_min_prob: 0.3, // >= 0.30 triggers MONITOR_FALSE_ONSET_RISK
    delay_sowing_min_prob: 0.6, // >= 0.60 triggers DELAY_SOWING
    critical_min_prob: 0.8, // >= 0.80 triggers CRITICAL severity
  },

  // Dry spell rules (Section 7)
  dry_spell: {
    monitor_min_prob: 0.3, // >= 0.30 triggers MONITOR_DRY_SPELL
    action_min_prob: 0.6, // >= 0.60 triggers IRRIGATION_REQUIRED / moisture conservation
    critical_min_prob: 0.8, // >= 0.80 triggers CRITICAL severity
  },

  // Heavy rainfall & IMD daily intensity categories (Section 8)
  heavy_rain: {
    watch_min_prob: 0.3, // >= 0.30 triggers REDUCE_AVOID_IRRIGATION / drainage watch
    prepare_min_prob: 0.6, // >= 0.60 triggers HEAVY_RAIN_PREPARATION & DRAINAGE_PREPARATION
    critical_min_prob: 0.8, // >= 0.80 triggers CRITICAL severity
    imd_daily_mm: {
      heavy_min: 64.5,
      heavy_max: 115.5,
      very_heavy_min: 115.6,
      very_heavy_max: 204.4,
      extremely_heavy_min: 204.5,
    },
  },

  // Soil moisture thresholds (only used when soil_moisture !== null)
  soil_moisture: {
    deficit_max_pct: 35.0,
    adequate_min_pct: 45.0,
    saturated_min_pct: 80.0,
  },
} as const;

/**
 * Section 1 & Section 9: Configurable Crop Profiles for the 6 Supported Crops
 */
export const CROP_PROFILES: Record<SupportedCropId, CropProfileMetadata> = {
  paddy: {
    crop_id: "paddy",
    name: "Paddy / Rice",
    scientific_name: "Oryza sativa",
    local_names: {
      en: "Paddy / Rice",
      hi: "धान (चावल)",
    },
    season: "Kharif",
    sowing_window: {
      months: [6, 7],
      label_en: "June – July (Kharif Onset Window)",
      label_hi: "जून – जुलाई (खरीफ मानसून आगमन अवधि)",
    },
    harvesting_window: {
      months: [10, 11],
      label_en: "October – November",
      label_hi: "अक्टूबर – नवंबर",
    },
    water_requirement: "1100–1250 mm (High standing-water tolerance)",
    rainfall_requirement: {
      min_mm: 900,
      max_mm: 1300,
      optimal_14d_sowing_rain_mm: 75,
      label: "900–1300 mm seasonal; >=75 mm/14D for puddling & transplanting",
    },
    temperature_range: {
      min_c: 22,
      max_c: 36,
      label: "22°C – 36°C",
    },
    critical_growth_stages: [
      {
        id: "pre_sowing",
        label_en: "Nursery & Seedbed Preparation",
        label_hi: "नर्सरी एवं खेत की तैयारी",
      },
      {
        id: "germination",
        label_en: "Seedling / Transplanting",
        label_hi: "रोपाई एवं अंकुरण अवस्था",
      },
      {
        id: "vegetative",
        label_en: "Active Tillering",
        label_hi: "कल्ले फूटने की अवस्था",
      },
      {
        id: "flowering",
        label_en: "Panicle Initiation & Flowering",
        label_hi: "बाली निकलने एवं फूल आने की अवस्था",
      },
      {
        id: "grain_filling",
        label_en: "Milking & Grain Filling",
        label_hi: "दाना भरने की अवस्था",
      },
      {
        id: "harvest",
        label_en: "Maturity & Harvest",
        label_hi: "पकने एवं कटाई की अवस्था",
      },
    ],
    excess_rain_sensitivity: "MODERATE",
    dry_spell_sensitivity: "HIGH",
    waterlogging_sensitivity: "LOW",
    suitable_blocks: [
      "karchhana",
      "phulpur",
      "soraon",
      "handia",
      "chaka",
      "bara",
      "meja",
      "koraon",
    ],
    suitability_note_en:
      "Well suited across Gangetic alluvial blocks (Phulpur, Soraon, Handia, Karchhana, Chaka); requires supplemental irrigation in Vindhyan upland pockets of Meja and Koraon during break-monsoon spells.",
    suitability_note_hi:
      "गंगा-यमुना दोआब के जलोढ़ विकासखंडों (फूलपुर, सोरांव, हंडिया, करछना, चाका) के लिए उपयुक्त; मेजा और कोरांव के पठारी क्षेत्रों में सूखे दौर के दौरान पूरक सिंचाई आवश्यक है।",
  },

  maize: {
    crop_id: "maize",
    name: "Maize",
    scientific_name: "Zea mays",
    local_names: {
      en: "Maize (Corn)",
      hi: "मक्का",
    },
    season: "Kharif",
    sowing_window: {
      months: [6, 7],
      label_en: "Mid-June – July (Well-drained ridges)",
      label_hi: "मध्य जून – जुलाई (मेड़ पर बुवाई)",
    },
    harvesting_window: {
      months: [9, 10],
      label_en: "September – October",
      label_hi: "सितंबर – अक्टूबर",
    },
    water_requirement: "500–650 mm (Sensitive to standing water >24 hours)",
    rainfall_requirement: {
      min_mm: 500,
      max_mm: 750,
      optimal_14d_sowing_rain_mm: 45,
      label: "500–750 mm seasonal; requires well-drained root zone",
    },
    temperature_range: {
      min_c: 21,
      max_c: 34,
      label: "21°C – 34°C",
    },
    critical_growth_stages: [
      {
        id: "pre_sowing",
        label_en: "Ridge & Furrow Preparation",
        label_hi: "मेड़ एवं नाली की तैयारी",
      },
      {
        id: "germination",
        label_en: "Emergence & Early Seedling",
        label_hi: "अंकुरण एवं प्रारंभिक पौध अवस्था",
      },
      {
        id: "vegetative",
        label_en: "Knee-High Vegetative Stage",
        label_hi: "घुटने तक बढ़वार की अवस्था",
      },
      {
        id: "flowering",
        label_en: "Tasseling & Silking",
        label_hi: "नर एवं मादा मंजरी (Tasseling/Silking) अवस्था",
      },
      {
        id: "grain_filling",
        label_en: "Cob & Grain Filling",
        label_hi: "भुट्टे में दाना भरने की अवस्था",
      },
      {
        id: "harvest",
        label_en: "Harvest",
        label_hi: "कटाई की अवस्था",
      },
    ],
    excess_rain_sensitivity: "HIGH",
    dry_spell_sensitivity: "MODERATE",
    waterlogging_sensitivity: "HIGH",
    suitable_blocks: [
      "phulpur",
      "soraon",
      "handia",
      "karchhana",
      "chaka",
      "bara",
      "meja",
    ],
    suitability_note_en:
      "Highly sensitive to root-zone waterlogging; must be sown on raised ridges with open field drainage channels.",
    suitability_note_hi:
      "जलभराव के प्रति अत्यंत संवेदनशील; जल निकासी नालियों के साथ ऊँची मेड़ों पर ही बुवाई करें।",
  },

  pulses: {
    crop_id: "pulses",
    name: "Pulses (Arhar / Moong / Urad)",
    scientific_name: "Cajanus cajan / Vigna radiata",
    local_names: {
      en: "Pulses (Pigeon Pea / Green Gram)",
      hi: "दलहन (अरहर / मूंग / उड़द)",
    },
    season: "Kharif",
    sowing_window: {
      months: [6, 7],
      label_en: "Late June – July (Raised bed sowing)",
      label_hi: "जून का अंतिम सप्ताह – जुलाई (मेड़/उथली क्यारी बुवाई)",
    },
    harvesting_window: {
      months: [10, 11, 12, 1, 2],
      label_en: "Oct–Nov (Moong/Urad) / Jan–Mar (Arhar)",
      label_hi: "अक्टूबर–नवंबर (मूंग/उड़द) / जनवरी–मार्च (अरहर)",
    },
    water_requirement: "350–450 mm (Low water requirement; intolerant to waterlogging)",
    rainfall_requirement: {
      min_mm: 350,
      max_mm: 550,
      optimal_14d_sowing_rain_mm: 35,
      label: "350–550 mm seasonal; avoid excessive moisture",
    },
    temperature_range: {
      min_c: 20,
      max_c: 35,
      label: "20°C – 35°C",
    },
    critical_growth_stages: [
      {
        id: "pre_sowing",
        label_en: "Raised Bed Preparation",
        label_hi: "मेड़/उठी हुई क्यारी की तैयारी",
      },
      {
        id: "germination",
        label_en: "Sowing & Germination",
        label_hi: "बुवाई एवं अंकुरण",
      },
      {
        id: "vegetative",
        label_en: "Vegetative Branching",
        label_hi: "शाखाएं बनने की अवस्था",
      },
      {
        id: "flowering",
        label_en: "Flowering",
        label_hi: "फूल आने की अवस्था",
      },
      {
        id: "grain_filling",
        label_en: "Pod Development & Seed Fill",
        label_hi: "फली बनने एवं दाना भरने की अवस्था",
      },
      {
        id: "harvest",
        label_en: "Pod Maturity & Harvest",
        label_hi: "पकने एवं कटाई की अवस्था",
      },
    ],
    excess_rain_sensitivity: "HIGH",
    dry_spell_sensitivity: "LOW",
    waterlogging_sensitivity: "HIGH",
    suitable_blocks: [
      "meja",
      "koraon",
      "bara",
      "karchhana",
      "phulpur",
      "soraon",
      "handia",
      "chaka",
    ],
    suitability_note_en:
      "Well suited to upland and well-drained loamy soils across Meja, Koraon, Bara, and Karchhana; requires strict drainage protection during heavy rain.",
    suitability_note_hi:
      "मेजा, कोरांव, बारा और करछना की ऊँची एवं दोमट भूमि के लिए विशेष उपयुक्त; भारी वर्षा में जल निकासी अत्यंत आवश्यक है।",
  },

  soybean: {
    crop_id: "soybean",
    name: "Soybean",
    scientific_name: "Glycine max",
    local_names: {
      en: "Soybean",
      hi: "सोयाबीन",
    },
    season: "Kharif",
    sowing_window: {
      months: [6, 7],
      label_en: "Late June – Mid-July (Requires >=75 mm cumulative moisture)",
      label_hi: "जून का अंतिम सप्ताह – मध्य जुलाई (पर्याप्त नमी पर बुवाई)",
    },
    harvesting_window: {
      months: [10],
      label_en: "October",
      label_hi: "अक्टूबर",
    },
    water_requirement: "450–600 mm (Sensitive to both germination drought & waterlogging)",
    rainfall_requirement: {
      min_mm: 450,
      max_mm: 650,
      optimal_14d_sowing_rain_mm: 60,
      label: "450–650 mm; sensitive to dry spell right after sowing and waterlogging",
    },
    temperature_range: {
      min_c: 22,
      max_c: 33,
      label: "22°C – 33°C",
    },
    critical_growth_stages: [
      {
        id: "pre_sowing",
        label_en: "Broad-Bed Furrow Prep",
        label_hi: "चौड़ी क्यारी एवं नाली (BBF) तैयारी",
      },
      {
        id: "germination",
        label_en: "Sowing & Germination",
        label_hi: "बुवाई एवं अंकुरण",
      },
      {
        id: "vegetative",
        label_en: "Vegetative Nodulation",
        label_hi: "वानस्पतिक वृद्धि एवं गांठ बनना",
      },
      {
        id: "flowering",
        label_en: "Flowering",
        label_hi: "फूल आने की अवस्था",
      },
      {
        id: "grain_filling",
        label_en: "Pod Filling",
        label_hi: "फली में दाना भरने की अवस्था",
      },
      {
        id: "harvest",
        label_en: "Maturity & Harvest",
        label_hi: "कटाई की अवस्था",
      },
    ],
    excess_rain_sensitivity: "HIGH",
    dry_spell_sensitivity: "HIGH",
    waterlogging_sensitivity: "HIGH",
    suitable_blocks: ["meja", "koraon", "bara", "karchhana"],
    suitability_note_en:
      "Primarily suitable for well-drained upland blocks (Meja, Koraon, Bara, Karchhana); low-lying flood-prone plots in Handia/Phulpur face high waterlogging risk.",
    suitability_note_hi:
      "मुख्य रूप से मेजा, कोरांव, बारा और करछना के अच्छे जल-निकास वाले खेतों के लिए उपयुक्त; निचले जलभराव वाले क्षेत्रों में जोखिम अधिक रहता है।",
  },

  cotton: {
    crop_id: "cotton",
    name: "Cotton",
    scientific_name: "Gossypium hirsutum",
    local_names: {
      en: "Cotton",
      hi: "कपास",
    },
    season: "Kharif",
    sowing_window: {
      months: [5, 6],
      label_en: "May – June",
      label_hi: "मई – जून",
    },
    harvesting_window: {
      months: [10, 11, 12],
      label_en: "October – December",
      label_hi: "अक्टूबर – दिसंबर",
    },
    water_requirement: "650–800 mm (Requires well-drained soil; sensitive to waterlogging)",
    rainfall_requirement: {
      min_mm: 550,
      max_mm: 800,
      optimal_14d_sowing_rain_mm: 45,
      label: "550–800 mm seasonal; sensitive to standing water and boll-stage downpours",
    },
    temperature_range: {
      min_c: 24,
      max_c: 38,
      label: "24°C – 38°C",
    },
    critical_growth_stages: [
      {
        id: "pre_sowing",
        label_en: "Pre-sowing Field Prep",
        label_hi: "खेत की प्रारंभिक तैयारी",
      },
      {
        id: "germination",
        label_en: "Sowing & Seedling",
        label_hi: "बुवाई एवं अंकुरण",
      },
      {
        id: "vegetative",
        label_en: "Square Formation",
        label_hi: "पुड़िया (Square) बनने की अवस्था",
      },
      {
        id: "flowering",
        label_en: "Flowering",
        label_hi: "फूल आने की अवस्था",
      },
      {
        id: "grain_filling",
        label_en: "Boll Development",
        label_hi: "टिंडे (Boll) विकसित होने की अवस्था",
      },
      {
        id: "harvest",
        label_en: "Boll Opening & Picking",
        label_hi: "टिंडे खिलने एवं चुनाई की अवस्था",
      },
    ],
    excess_rain_sensitivity: "HIGH",
    dry_spell_sensitivity: "MODERATE",
    waterlogging_sensitivity: "HIGH",
    suitable_blocks: ["bara", "meja", "koraon"],
    suitability_note_en:
      "Non-traditional crop in eastern Gangetic Prayagraj; only limited upland black/mixed soil pockets in Bara, Meja, and Koraon are moderately suitable. Verify local extension advice before cultivation.",
    suitability_note_hi:
      "प्रयागराज क्षेत्र में गैर-पारंपरिक फसल; केवल बारा, मेजा और कोरांव की ऊँची मिश्रित/काली मिट्टी में सीमित रूप से उपयुक्त। बुवाई से पूर्व स्थानीय कृषि विज्ञान केंद्र (KVK) से परामर्श लें।",
  },

  wheat: {
    crop_id: "wheat",
    name: "Wheat",
    scientific_name: "Triticum aestivum",
    local_names: {
      en: "Wheat",
      hi: "गेहूँ",
    },
    season: "Rabi",
    sowing_window: {
      months: [11, 12],
      label_en: "November – December (Rabi Season — Off-season during Kharif Monsoon)",
      label_hi: "नवंबर – दिसंबर (रबी सीजन — खरीफ मानसून के दौरान बुवाई का समय नहीं है)",
    },
    harvesting_window: {
      months: [3, 4],
      label_en: "March – April",
      label_hi: "मार्च – अप्रैल",
    },
    water_requirement: "400–500 mm (Rabi winter crop)",
    rainfall_requirement: {
      min_mm: 350,
      max_mm: 500,
      optimal_14d_sowing_rain_mm: 0,
      label: "Rabi winter crop; relies on residual monsoon soil moisture & winter irrigation",
    },
    temperature_range: {
      min_c: 12,
      max_c: 26,
      label: "12°C – 26°C (Cool winter regime)",
    },
    critical_growth_stages: [
      {
        id: "pre_sowing",
        label_en: "Monsoon Moisture Conservation (Fallow/Bunding)",
        label_hi: "मानसून नमी संरक्षण (मेड़बंदी)",
      },
      {
        id: "germination",
        label_en: "Rabi Sowing & Emergence (Nov–Dec)",
        label_hi: "रबी बुवाई एवं अंकुरण (नवंबर–दिसंबर)",
      },
      {
        id: "vegetative",
        label_en: "Crown Root Initiation (CRI)",
        label_hi: "ताज मूल (CRI) अवस्था",
      },
      {
        id: "flowering",
        label_en: "Heading & Flowering",
        label_hi: "बाली निकलने एवं फूल आने की अवस्था",
      },
      {
        id: "grain_filling",
        label_en: "Milking & Dough Stage",
        label_hi: "दुग्धावस्था एवं दाना पुष्ट होना",
      },
      {
        id: "harvest",
        label_en: "Ripening & Harvest",
        label_hi: "पकने एवं कटाई की अवस्था",
      },
    ],
    excess_rain_sensitivity: "HIGH",
    dry_spell_sensitivity: "MODERATE",
    waterlogging_sensitivity: "HIGH",
    suitable_blocks: [
      "karchhana",
      "phulpur",
      "meja",
      "koraon",
      "bara",
      "soraon",
      "handia",
      "chaka",
    ],
    suitability_note_en:
      "Major Rabi (winter) crop across all Prayagraj blocks. Do NOT sow wheat during the June–September Kharif monsoon season; use monsoon rainfall for field bunding and residual soil moisture banking.",
    suitability_note_hi:
      "प्रयागराज के सभी विकासखंडों की प्रमुख रबी (शीतकालीन) फसल। जून–सितंबर खरीफ मानसून के दौरान गेहूँ की बुवाई न करें; इस अवधि में रबी के लिए खेत की मेड़बंदी व नमी संरक्षण करें।",
  },
};

/**
 * Resolves optional UI or API stage string into a canonical growth stage or null.
 * Section 10: If stage is unavailable, return null ("Growth stage not specified") and do not invent it.
 */
export function resolveCanonicalGrowthStage(
  stageInput?: string | null
): CanonicalGrowthStage | null {
  if (!stageInput || !stageInput.trim()) return null;
  const normalized = stageInput.trim().toLowerCase();
  if (
    normalized === "unspecified" ||
    normalized === "not specified" ||
    normalized === "none" ||
    normalized === "unknown"
  ) {
    return null;
  }

  if (
    normalized === "pre_sowing" ||
    normalized.includes("pre-sowing") ||
    normalized.includes("nursery") ||
    normalized.includes("seedbed") ||
    normalized.includes("tillage") ||
    normalized.includes("banking")
  ) {
    return "pre_sowing";
  }
  if (
    normalized === "germination" ||
    normalized.includes("sowing") ||
    normalized.includes("transplanting") ||
    normalized.includes("emergence")
  ) {
    return "germination";
  }
  if (
    normalized === "vegetative" ||
    normalized.includes("tillering") ||
    normalized.includes("knee-high") ||
    normalized.includes("branching") ||
    normalized.includes("nodulation") ||
    normalized.includes("square") ||
    normalized.includes("crown root")
  ) {
    return "vegetative";
  }
  if (
    normalized === "flowering" ||
    normalized.includes("panicle") ||
    normalized.includes("tasseling") ||
    normalized.includes("silking") ||
    normalized.includes("heading")
  ) {
    return "flowering";
  }
  if (
    normalized === "grain_filling" ||
    normalized.includes("grain") ||
    normalized.includes("pod") ||
    normalized.includes("boll development") ||
    normalized.includes("fill")
  ) {
    return "grain_filling";
  }
  if (
    normalized === "harvest" ||
    normalized.includes("maturity") ||
    normalized.includes("ripening") ||
    normalized.includes("opening")
  ) {
    return "harvest";
  }

  return null;
}

/**
 * Metadata registry of all deterministic rules (Section 16)
 */
export interface AdvisoryRuleCatalogEntry {
  rule_id: string;
  decision_category: DecisionCategory;
  decision_code: "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J";
  condition_summary: string;
  default_severity: AdvisorySeverity;
  description: string;
}

export const ADVISORY_RULE_CATALOG: AdvisoryRuleCatalogEntry[] = [
  {
    rule_id: "RULE-SEASON-001",
    decision_category: "NO_IMMEDIATE_ACTION",
    decision_code: "J",
    condition_summary:
      "crop.season === 'Rabi' && evaluation_month in [5, 6, 7, 8, 9]",
    default_severity: "LOW",
    description:
      "Prevents issuing Kharif monsoon sowing advice for Rabi crops (e.g., Wheat) during June–September; advises monsoon moisture banking instead.",
  },
  {
    rule_id: "RULE-SUITABILITY-001",
    decision_category: "MONITOR_DRY_SPELL",
    decision_code: "I",
    condition_summary: "!crop.suitable_blocks.includes(location_id)",
    default_severity: "MODERATE",
    description:
      "Warns when the selected crop has limited agro-ecological suitability in the selected block (e.g., Soybean or Cotton in low-lying alluvial blocks).",
  },
  {
    rule_id: "RULE-ONSET-001",
    decision_category: "SOW_NOW",
    decision_code: "A",
    condition_summary:
      "onset_probability >= 0.60 && false_onset_probability < 0.60 && dry_spell_probability < 0.60 && recent_rainfall >= 20mm && within_sowing_window",
    default_severity: "LOW",
    description:
      "Favorable monsoon onset conditions with adequate recent rainfall and low/moderate false-onset risk.",
  },
  {
    rule_id: "RULE-ONSET-002",
    decision_category: "DELAY_SOWING",
    decision_code: "B",
    condition_summary:
      "(onset_probability <= 0.30 || false_onset_probability >= 0.60) && sowing_or_pre_sowing_context",
    default_severity: "HIGH",
    description:
      "Advises considering a sowing delay when onset probability is low (<=30%) or false onset risk is high (>=60%).",
  },
  {
    rule_id: "RULE-ONSET-003",
    decision_category: "PREPARE_FOR_SOWING",
    decision_code: "C",
    condition_summary:
      "0.30 < onset_probability < 0.60 && false_onset_probability < 0.60 && within_sowing_window",
    default_severity: "MODERATE",
    description:
      "Transitional monsoon onset window (30%–60%); recommends seedbed and bund preparation while awaiting stable cumulative showers.",
  },
  {
    rule_id: "RULE-FALSE-ONSET-001",
    decision_category: "MONITOR_FALSE_ONSET_RISK",
    decision_code: "H",
    condition_summary: "false_onset_probability >= 0.30 && within_sowing_window",
    default_severity: "HIGH",
    description:
      "Warns that early rainfall may be followed by a prolonged dry break; advises against treating an initial wet spell as stable monsoon confirmation.",
  },
  {
    rule_id: "RULE-DRY-SPELL-001",
    decision_category: "MONITOR_DRY_SPELL",
    decision_code: "I",
    condition_summary: "dry_spell_probability >= 0.30",
    default_severity: "MODERATE",
    description:
      "Generates dry-spell risk monitoring, mulching, and soil moisture conservation guidance.",
  },
  {
    rule_id: "RULE-IRRIGATION-001",
    decision_category: "IRRIGATION_REQUIRED",
    decision_code: "D",
    condition_summary:
      "dry_spell_probability >= 0.60 && (rainfall_anomaly <= -10 || soil_moisture < 35)",
    default_severity: "HIGH",
    description:
      "Recommends conditional supplemental irrigation planning ('If irrigation is available...') during high dry-spell risk.",
  },
  {
    rule_id: "RULE-IRRIGATION-002",
    decision_category: "REDUCE_AVOID_IRRIGATION",
    decision_code: "E",
    condition_summary:
      "heavy_rain_probability >= 0.30 || expected_rainfall >= crop.optimal_14d_sowing_rain_mm * 1.25",
    default_severity: "MODERATE",
    description:
      "Advises withholding or reducing irrigation ahead of expected rainfall to prevent waterlogging and nutrient leaching.",
  },
  {
    rule_id: "RULE-HEAVY-RAIN-001",
    decision_category: "HEAVY_RAIN_PREPARATION",
    decision_code: "G",
    condition_summary:
      "heavy_rain_probability >= 0.60 || expected_daily_rain >= 64.5mm",
    default_severity: "HIGH",
    description:
      "IMD-aligned heavy rainfall preparation: protect produce, postpone chemical/fertilizer sprays, and inspect field bunds.",
  },
  {
    rule_id: "RULE-DRAINAGE-001",
    decision_category: "DRAINAGE_PREPARATION",
    decision_code: "F",
    condition_summary:
      "heavy_rain_probability >= 0.30 && crop.waterlogging_sensitivity in ['MODERATE', 'HIGH']",
    default_severity: "HIGH",
    description:
      "Crop-specific drainage preparation for waterlogging-sensitive crops (Maize, Pulses, Soybean, Cotton) or submerged Paddy.",
  },
  {
    rule_id: "RULE-NO-ACTION-001",
    decision_category: "NO_IMMEDIATE_ACTION",
    decision_code: "J",
    condition_summary:
      "No elevated risk rules triggered (all risk probabilities < 0.30)",
    default_severity: "LOW",
    description:
      "Indicates balanced conditions where routine field monitoring is sufficient.",
  },
];
