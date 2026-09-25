import {
  Alert,
  Block,
  ClimateIndex,
  Crop,
  CropAdvisory,
  DailyForecastPoint,
  DemoScenarioId,
  DemoScenarioMeta,
  FalseOnsetRuleEvaluation,
  Farmer,
  Forecast,
  ForecastHorizon,
  RiskLevel,
  User,
  WeatherObservation,
} from "@/types/monsoon";

export const DEMO_SCENARIOS: DemoScenarioMeta[] = [
  {
    id: "scenario_a",
    code: "Scenario A",
    label: "Scenario A — Favorable Monsoon",
    shortLabel: "Scenario A: Favorable Monsoon",
    description:
      "Strong Somali Jet & MJO Phase 4 active burst: high onset probability, minimal break-monsoon dry spell, and optimal sowing moisture.",
    ensoPhase: "La Niña Watch (-0.45 °C)",
    iodPhase: "Strong Positive (+0.82 °C)",
    mjoPhase: "Phase 4 (Bay of Bengal)",
    mjoAmplitude: 1.8,
  },
  {
    id: "scenario_b",
    code: "Scenario B",
    label: "Scenario B — False Onset",
    shortLabel: "Scenario B: False Onset",
    description:
      "Hackathon Showcase: Initial 15–18 June shower (78% onset signal) followed by a deceptive 8–11 day break-monsoon dry spell (68% false onset risk).",
    ensoPhase: "Neutral (-0.18 °C)",
    iodPhase: "Positive (+0.64 °C)",
    mjoPhase: "Phase 3",
    mjoAmplitude: 1.4,
  },
  {
    id: "scenario_c",
    code: "Scenario C",
    label: "Scenario C — Prolonged Break",
    shortLabel: "Scenario C: Prolonged Break",
    description:
      "Sub-tropical ridge intrusion suppresses convection across Southern & Trans-Yamuna blocks for 11–14 days, triggering high moisture stress.",
    ensoPhase: "Warm Neutral (+0.38 °C)",
    iodPhase: "Neutral (+0.12 °C)",
    mjoPhase: "Phase 7 (Suppressed)",
    mjoAmplitude: 1.5,
  },
  {
    id: "scenario_d",
    code: "Scenario D",
    label: "Scenario D — Heavy Rainfall",
    shortLabel: "Scenario D: Heavy Rainfall",
    description:
      "Deep Bay of Bengal depression tracks along the Gangetic trough, producing intense >140 mm multi-day downpours and waterlogging risk.",
    ensoPhase: "Neutral (-0.22 °C)",
    iodPhase: "Positive (+0.74 °C)",
    mjoPhase: "Phase 4 (Convective Peak)",
    mjoAmplitude: 2.1,
  },
];

export const CURRENT_OFFICER: User = {
  id: "usr-up-prg-01",
  name: "Dr. Rajeshwar Verma",
  role: "Agricultural Officer",
  state: "Uttar Pradesh",
  district: "Prayagraj",
  assignedBlocks: [
    "karchhana",
    "phulpur",
    "meja",
    "koraon",
    "bara",
    "soraon",
    "handia",
    "chaka",
  ],
  email: "dd-agri.prayagraj@up.gov.in",
};

export const OFFICER_SUMMARY_METRICS = {
  totalBlocksMonitored: 128,
  highRiskBlocks: 23,
  potentialFalseOnsetBlocks: 17,
  advisoriesGenerated: 84,
  farmersReached: 12540,
};

export const STATE_DISTRICTS: Record<string, string[]> = {
  "Uttar Pradesh": ["Prayagraj", "Varanasi", "Gorakhpur", "Lucknow", "Jhansi"],
  "Madhya Pradesh": ["Jabalpur", "Rewa", "Bhopal"],
  Bihar: ["Patna", "Gaya", "Bhagalpur"],
};

/**
 * Baseline 14D Scenario B (False Onset Showcase) Block Profiles for Prayagraj
 * Guaranteed exact metrics:
 * - Karchhana: Onset 78%, False Onset 68%, Dry Spell 62%, Heavy Rain 34%, Anomaly -18%, Dry Spell 8-11 days
 * - Phulpur: Onset 81%, False Onset 19%, Dry Spell 57%, Heavy Rain 23%, Expected Rain 112 mm, Anomaly -12%, Confidence 76%
 * - Meja: Onset 52%, False Onset 74%, Dry Spell 76%, Heavy Rain 18%
 * - Koraon: Onset 43%, False Onset 71%, Dry Spell 79%, Heavy Rain 15%
 */
export const MOCK_BLOCKS: Block[] = [
  {
    id: "karchhana",
    name: "Karchhana Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.28, 81.94],
    polygon: [
      [25.35, 81.86],
      [25.36, 82.02],
      [25.22, 82.01],
      [25.21, 81.85],
    ],
    farmersRegistered: 1620,
    cultivatedAreaHa: 15800,
    soilType: "Clayey Loam",
    irrigationCoverage: 52,
    onsetProbability: 78,
    falseOnsetProbability: 68,
    falseOnsetRisk: 68,
    drySpellProbability: 62,
    drySpellRisk: 62,
    heavyRainProbability: 34,
    heavyRainfallRisk: 34,
    rainfallAnomaly: -18,
    rainfallAnomalyPct: -18,
    expectedRainfall: 94,
    expectedRainfallMm: 94,
    confidence: 78,
    expectedDrySpellDays: "8–11 days",
    onsetWindow: "15–19 June",
    soilMoisture: 34,
    riskLevel: "High",
    mainIssue: "False onset warning (68%): 8–11 day post-shower dry spell",
    recommendedAdvisory:
      "Delay rainfed paddy sowing by 5–7 days; prepare supplemental irrigation",
    panchayats: [
      {
        id: "p-karch-1",
        name: "Bhita Gram Panchayat",
        blockId: "karchhana",
        farmersCount: 490,
        soilMoistureIndex: 34,
        dominantCrop: "Paddy",
        onsetProbability: 78,
        drySpellRisk: 62,
      },
      {
        id: "p-karch-2",
        name: "Kaundhiyara Cluster",
        blockId: "karchhana",
        farmersCount: 530,
        soilMoistureIndex: 31,
        dominantCrop: "Pulses",
        onsetProbability: 76,
        drySpellRisk: 64,
      },
    ],
  },
  {
    id: "phulpur",
    name: "Phulpur Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.55, 82.09],
    polygon: [
      [25.61, 82.01],
      [25.62, 82.16],
      [25.52, 82.18],
      [25.49, 82.04],
    ],
    farmersRegistered: 1840,
    cultivatedAreaHa: 14200,
    soilType: "Alluvial Loam",
    irrigationCoverage: 64,
    onsetProbability: 81,
    falseOnsetProbability: 19,
    falseOnsetRisk: 19,
    drySpellProbability: 57,
    drySpellRisk: 57,
    heavyRainProbability: 23,
    heavyRainfallRisk: 23,
    rainfallAnomaly: -12,
    rainfallAnomalyPct: -12,
    expectedRainfall: 112,
    expectedRainfallMm: 112,
    confidence: 76,
    expectedDrySpellDays: "5–7 days",
    onsetWindow: "14–18 June",
    soilMoisture: 48,
    riskLevel: "Moderate",
    mainIssue: "Mid-window 5–7 day break-monsoon risk after initial onset",
    recommendedAdvisory:
      "Stagger paddy nursery sowing; retain canal water in farm ponds",
    panchayats: [
      {
        id: "p-phulpur-1",
        name: "Mailahan Gram Panchayat",
        blockId: "phulpur",
        farmersCount: 420,
        soilMoistureIndex: 48,
        dominantCrop: "Paddy",
        onsetProbability: 82,
        drySpellRisk: 55,
      },
      {
        id: "p-phulpur-2",
        name: "Bairagiya Gram Panchayat",
        blockId: "phulpur",
        farmersCount: 385,
        soilMoistureIndex: 44,
        dominantCrop: "Paddy",
        onsetProbability: 80,
        drySpellRisk: 59,
      },
    ],
  },
  {
    id: "meja",
    name: "Meja Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.14, 82.11],
    polygon: [
      [25.22, 82.02],
      [25.23, 82.21],
      [25.06, 82.20],
      [25.07, 82.01],
    ],
    farmersRegistered: 1490,
    cultivatedAreaHa: 16900,
    soilType: "Vindhyan Red & Gravel",
    irrigationCoverage: 36,
    onsetProbability: 52,
    falseOnsetProbability: 74,
    falseOnsetRisk: 74,
    drySpellProbability: 76,
    drySpellRisk: 76,
    heavyRainProbability: 18,
    heavyRainfallRisk: 18,
    rainfallAnomaly: -29,
    rainfallAnomalyPct: -29,
    expectedRainfall: 72,
    expectedRainfallMm: 72,
    confidence: 83,
    expectedDrySpellDays: "9–12 days",
    onsetWindow: "21–26 June",
    soilMoisture: 26,
    riskLevel: "Very High",
    mainIssue: "Prolonged 9–12 day break-monsoon phase & 74% false-onset trap",
    recommendedAdvisory:
      "Switch upland plots to drought-tolerant pulses (Arhar/Moong); delay rainfed paddy",
    panchayats: [
      {
        id: "p-meja-1",
        name: "Sirsa Gram Panchayat",
        blockId: "meja",
        farmersCount: 540,
        soilMoistureIndex: 26,
        dominantCrop: "Pulses",
        onsetProbability: 53,
        drySpellRisk: 78,
      },
      {
        id: "p-meja-2",
        name: "Kohdar Upland Panchayat",
        blockId: "meja",
        farmersCount: 470,
        soilMoistureIndex: 23,
        dominantCrop: "Soybean",
        onsetProbability: 51,
        drySpellRisk: 74,
      },
    ],
  },
  {
    id: "koraon",
    name: "Koraon Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [24.99, 82.06],
    polygon: [
      [25.06, 81.95],
      [25.06, 82.18],
      [24.91, 82.17],
      [24.92, 81.94],
    ],
    farmersRegistered: 1750,
    cultivatedAreaHa: 18400,
    soilType: "Rocky Sandy Loam",
    irrigationCoverage: 33,
    onsetProbability: 43,
    falseOnsetProbability: 71,
    falseOnsetRisk: 71,
    drySpellProbability: 79,
    drySpellRisk: 79,
    heavyRainProbability: 15,
    heavyRainfallRisk: 15,
    rainfallAnomaly: -34,
    rainfallAnomalyPct: -34,
    expectedRainfall: 64,
    expectedRainfallMm: 64,
    confidence: 84,
    expectedDrySpellDays: "10–13 days",
    onsetWindow: "23–28 June",
    soilMoisture: 24,
    riskLevel: "Very High",
    mainIssue: "Severe 10–13 day dry spell & 71% false-onset trap risk",
    recommendedAdvisory:
      "Delay sowing by 7 days; activate diesel pump & tube-well contingency",
    panchayats: [
      {
        id: "p-koraon-1",
        name: "Mahuli Gram Panchayat",
        blockId: "koraon",
        farmersCount: 620,
        soilMoistureIndex: 24,
        dominantCrop: "Paddy",
        onsetProbability: 43,
        drySpellRisk: 79,
      },
    ],
  },
  {
    id: "bara",
    name: "Bara Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.25, 81.73],
    polygon: [
      [25.32, 81.64],
      [25.32, 81.82],
      [25.18, 81.82],
      [25.18, 81.64],
    ],
    farmersRegistered: 1180,
    cultivatedAreaHa: 14400,
    soilType: "Sandy Clay Loam",
    irrigationCoverage: 44,
    onsetProbability: 69,
    falseOnsetProbability: 64,
    falseOnsetRisk: 64,
    drySpellProbability: 67,
    drySpellRisk: 67,
    heavyRainProbability: 22,
    heavyRainfallRisk: 22,
    rainfallAnomaly: -22,
    rainfallAnomalyPct: -22,
    expectedRainfall: 86,
    expectedRainfallMm: 86,
    confidence: 80,
    expectedDrySpellDays: "8–10 days",
    onsetWindow: "17–22 June",
    soilMoisture: 32,
    riskLevel: "High",
    mainIssue: "False onset probability 64% followed by 8–10 day dry spell",
    recommendedAdvisory:
      "Hold direct-seeded rice; apply mulching for early vegetable & maize plots",
    panchayats: [
      {
        id: "p-bara-1",
        name: "Lalgopalganj South Panchayat",
        blockId: "bara",
        farmersCount: 390,
        soilMoistureIndex: 32,
        dominantCrop: "Maize",
        onsetProbability: 69,
        drySpellRisk: 67,
      },
    ],
  },
  {
    id: "soraon",
    name: "Soraon Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.6, 81.85],
    polygon: [
      [25.67, 81.77],
      [25.67, 81.94],
      [25.53, 81.94],
      [25.53, 81.77],
    ],
    farmersRegistered: 1520,
    cultivatedAreaHa: 13100,
    soilType: "Fertile Gangetic Alluvium",
    irrigationCoverage: 78,
    onsetProbability: 85,
    falseOnsetProbability: 18,
    falseOnsetRisk: 18,
    drySpellProbability: 38,
    drySpellRisk: 38,
    heavyRainProbability: 42,
    heavyRainfallRisk: 42,
    rainfallAnomaly: +4,
    rainfallAnomalyPct: +4,
    expectedRainfall: 134,
    expectedRainfallMm: 134,
    confidence: 82,
    expectedDrySpellDays: "3–4 days",
    onsetWindow: "13–17 June",
    soilMoisture: 62,
    riskLevel: "Low",
    mainIssue: "Favorable onset window with localized heavy spell Day 11–13",
    recommendedAdvisory:
      "Proceed with paddy nursery preparation; clear field drainage channels",
    panchayats: [
      {
        id: "p-soraon-1",
        name: "Mewalal Baghiya Panchayat",
        blockId: "soraon",
        farmersCount: 510,
        soilMoistureIndex: 62,
        dominantCrop: "Paddy",
        onsetProbability: 85,
        drySpellRisk: 38,
      },
    ],
  },
  {
    id: "handia",
    name: "Handia Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.38, 82.19],
    polygon: [
      [25.46, 82.11],
      [25.46, 82.28],
      [25.31, 82.28],
      [25.31, 82.11],
    ],
    farmersRegistered: 1410,
    cultivatedAreaHa: 12900,
    soilType: "Loamy Alluvial",
    irrigationCoverage: 68,
    onsetProbability: 79,
    falseOnsetProbability: 28,
    falseOnsetRisk: 28,
    drySpellProbability: 49,
    drySpellRisk: 49,
    heavyRainProbability: 58,
    heavyRainfallRisk: 58,
    rainfallAnomaly: +11,
    rainfallAnomalyPct: +11,
    expectedRainfall: 148,
    expectedRainfallMm: 148,
    confidence: 79,
    expectedDrySpellDays: "4–6 days",
    onsetWindow: "14–18 June",
    soilMoisture: 57,
    riskLevel: "Moderate",
    mainIssue: "High intensity heavy rainfall risk (58%) in Week 2",
    recommendedAdvisory:
      "Strengthen bunds in low-lying paddy plots; avoid basal urea before heavy rain",
    panchayats: [
      {
        id: "p-handia-1",
        name: "Saidabad Gram Panchayat",
        blockId: "handia",
        farmersCount: 480,
        soilMoistureIndex: 57,
        dominantCrop: "Paddy",
        onsetProbability: 79,
        drySpellRisk: 49,
      },
    ],
  },
  {
    id: "chaka",
    name: "Chaka Block",
    district: "Prayagraj",
    state: "Uttar Pradesh",
    coordinates: [25.39, 81.86],
    polygon: [
      [25.44, 81.8],
      [25.44, 81.93],
      [25.35, 81.93],
      [25.35, 81.8],
    ],
    farmersRegistered: 940,
    cultivatedAreaHa: 8600,
    soilType: "Alluvial Silt",
    irrigationCoverage: 74,
    onsetProbability: 83,
    falseOnsetProbability: 21,
    falseOnsetRisk: 21,
    drySpellProbability: 41,
    drySpellRisk: 41,
    heavyRainProbability: 35,
    heavyRainfallRisk: 35,
    rainfallAnomaly: -4,
    rainfallAnomalyPct: -4,
    expectedRainfall: 124,
    expectedRainfallMm: 124,
    confidence: 81,
    expectedDrySpellDays: "3–5 days",
    onsetWindow: "14–18 June",
    soilMoisture: 58,
    riskLevel: "Low",
    mainIssue: "Near-normal onset trajectory; minor 4-day dry window",
    recommendedAdvisory:
      "Optimal window for medium-duration paddy nursery sowing",
    panchayats: [
      {
        id: "p-chaka-1",
        name: "Dandi Gram Panchayat",
        blockId: "chaka",
        farmersCount: 340,
        soilMoistureIndex: 58,
        dominantCrop: "Paddy",
        onsetProbability: 83,
        drySpellRisk: 41,
      },
    ],
  },
];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

/**
 * Dynamically computes all 8 Block states for a given ForecastHorizon and DemoScenarioId.
 * Notice that for Scenario B ("scenario_b", the default) and "14D", exact baseline numbers
 * are preserved (Karchhana: 78% onset, 68% false onset, 62% dry spell, 34% heavy rain;
 * Meja: 52% onset, 74% false onset; Koraon: 43% onset, 71% false onset; Phulpur: 81% onset, 19% false onset).
 */
export function getBlocksForScenarioAndHorizon(
  scenario: DemoScenarioId = "scenario_b",
  horizon: ForecastHorizon = "14D"
): Block[] {
  const horizonOffset =
    horizon === "7D"
      ? { onset: +3, falseOnset: -4, drySpell: -6, heavyRain: -3, rainMult: 0.58, conf: +6 }
      : horizon === "14D"
      ? { onset: 0, falseOnset: 0, drySpell: 0, heavyRain: 0, rainMult: 1.0, conf: 0 }
      : horizon === "21D"
      ? { onset: +2, falseOnset: -3, drySpell: -4, heavyRain: +5, rainMult: 1.55, conf: -4 }
      : { onset: +5, falseOnset: -5, drySpell: -7, heavyRain: +8, rainMult: 2.25, conf: -8 };

  const scenarioOffset =
    scenario === "scenario_a"
      ? { onset: +14, falseOnset: -32, drySpell: -28, heavyRain: +8, anom: +18, moisture: +18 }
      : scenario === "scenario_b"
      ? { onset: 0, falseOnset: 0, drySpell: 0, heavyRain: 0, anom: 0, moisture: 0 }
      : scenario === "scenario_c"
      ? { onset: -14, falseOnset: +12, drySpell: +18, heavyRain: -12, anom: -16, moisture: -12 }
      : { onset: +10, falseOnset: -24, drySpell: -22, heavyRain: +36, anom: +28, moisture: +24 };

  return MOCK_BLOCKS.map((base) => {
    const onsetProbability = clamp(
      base.onsetProbability + horizonOffset.onset + scenarioOffset.onset,
      25,
      96
    );
    const falseOnsetProbability = clamp(
      base.falseOnsetProbability + horizonOffset.falseOnset + scenarioOffset.falseOnset,
      8,
      92
    );
    const drySpellProbability = clamp(
      base.drySpellProbability + horizonOffset.drySpell + scenarioOffset.drySpell,
      14,
      94
    );
    const heavyRainProbability = clamp(
      base.heavyRainProbability + horizonOffset.heavyRain + scenarioOffset.heavyRain,
      10,
      92
    );
    const rainfallAnomaly = clamp(
      base.rainfallAnomaly + scenarioOffset.anom + (horizon === "30D" ? 4 : 0),
      -48,
      +45
    );
    const expectedRainfall = Math.round(
      base.expectedRainfall *
        horizonOffset.rainMult *
        (scenario === "scenario_d" ? 1.38 : scenario === "scenario_c" ? 0.72 : scenario === "scenario_a" ? 1.18 : 1.0)
    );
    const confidence = clamp(base.confidence + horizonOffset.conf, 58, 93);
    const soilMoisture = clamp(base.soilMoisture + scenarioOffset.moisture, 16, 86);

    const maxThreat = Math.max(falseOnsetProbability, drySpellProbability, heavyRainProbability);
    const riskLevel: RiskLevel =
      maxThreat >= 72
        ? "Very High"
        : maxThreat >= 58
        ? "High"
        : maxThreat >= 38
        ? "Moderate"
        : "Low";

    let mainIssue = base.mainIssue;
    let recommendedAdvisory = base.recommendedAdvisory;
    let expectedDrySpellDays = base.expectedDrySpellDays;

    if (scenario === "scenario_a") {
      expectedDrySpellDays = "2–4 days";
      mainIssue = `Favorable onset (${onsetProbability}%) with balanced soil moisture (${soilMoisture}%)`;
      recommendedAdvisory = "Proceed with timely Kharif sowing and basal nutrient application";
    } else if (scenario === "scenario_c") {
      expectedDrySpellDays = "11–14 days";
      mainIssue = `Prolonged break-monsoon dry spell (${drySpellProbability}%) & ${rainfallAnomaly}% anomaly`;
      recommendedAdvisory = "Withhold rainfed sowing; switch uplands to drought-hardy pulses & mulching";
    } else if (scenario === "scenario_d") {
      expectedDrySpellDays = "1–3 days";
      mainIssue = `Elevated heavy rainfall & waterlogging risk (${heavyRainProbability}%)`;
      recommendedAdvisory = "Open perimeter field drains; postpone urea top-dressing until rain subsides";
    } else if (horizon !== "14D") {
      mainIssue = `${horizon} Window: False onset ${falseOnsetProbability}% | Break risk ${drySpellProbability}%`;
    }

    return {
      ...base,
      onsetProbability,
      falseOnsetProbability,
      falseOnsetRisk: falseOnsetProbability,
      drySpellProbability,
      drySpellRisk: drySpellProbability,
      heavyRainProbability,
      heavyRainfallRisk: heavyRainProbability,
      rainfallAnomaly,
      rainfallAnomalyPct: rainfallAnomaly,
      expectedRainfall,
      expectedRainfallMm: expectedRainfall,
      confidence,
      soilMoisture,
      expectedDrySpellDays,
      riskLevel,
      mainIssue,
      recommendedAdvisory,
    };
  });
}

/**
 * Prototype Decision Logic for False Onset Detection (Section 8)
 */
export function evaluateFalseOnsetRuleEngine(
  block: Block,
  scenario: DemoScenarioId
): FalseOnsetRuleEvaluation {
  const initialRainBurstMm =
    scenario === "scenario_d"
      ? 92
      : scenario === "scenario_a"
      ? 68
      : block.id === "karchhana"
      ? 58
      : Math.round(block.expectedRainfall * 0.48);

  const initialRainHigh = initialRainBurstMm >= 35;
  const peakSoilMoisturePct = clamp(block.soilMoisture + 21, 38, 82);
  const soilMoistureTempIncrease = peakSoilMoisturePct >= 48;
  const subsequentRainProbPct = clamp(100 - block.drySpellProbability, 12, 85);
  const subsequentRainDrop = subsequentRainProbPct <= 45;
  const drySpellHigh = block.drySpellProbability >= 55;

  const ruleTriggered =
    initialRainHigh &&
    soilMoistureTempIncrease &&
    subsequentRainDrop &&
    drySpellHigh;

  const recommendedAction =
    block.falseOnsetProbability >= 60
      ? "Delay rainfed sowing by 5–7 days and prepare supplemental irrigation."
      : block.falseOnsetProbability >= 40
      ? "Stagger nursery sowing and monitor 72-hour soil moisture retention."
      : "Favorable onset stability — proceed with standard Kharif seedbed preparation.";

  return {
    initialRainHigh,
    initialRainBurstMm,
    soilMoistureTempIncrease,
    peakSoilMoisturePct,
    subsequentRainDrop,
    subsequentRainProbPct,
    drySpellHigh,
    computedFalseOnsetProbability: block.falseOnsetProbability,
    expectedDrySpellDays: block.expectedDrySpellDays,
    recommendedAction,
    ruleTriggered,
  };
}

const BASE_30_DAY_SERIES: DailyForecastPoint[] = [
  { dayIndex: 1, dateLabel: "12 Jun", isoDate: "2026-06-12", predictedMm: 2.1, historicalAvgMm: 3.4, uncertaintyLowMm: 0.5, uncertaintyHighMm: 4.8, uncertaintyBand: [0.5, 4.8], phaseLabel: "Pre-Onset" },
  { dayIndex: 2, dateLabel: "13 Jun", isoDate: "2026-06-13", predictedMm: 4.5, historicalAvgMm: 3.8, uncertaintyLowMm: 1.2, uncertaintyHighMm: 8.1, uncertaintyBand: [1.2, 8.1], phaseLabel: "Pre-Onset" },
  { dayIndex: 3, dateLabel: "14 Jun", isoDate: "2026-06-14", predictedMm: 9.8, historicalAvgMm: 4.2, uncertaintyLowMm: 5.0, uncertaintyHighMm: 14.5, uncertaintyBand: [5.0, 14.5], phaseLabel: "Pre-Onset" },
  { dayIndex: 4, dateLabel: "15 Jun", isoDate: "2026-06-15", predictedMm: 18.4, historicalAvgMm: 5.1, uncertaintyLowMm: 12.1, uncertaintyHighMm: 25.0, uncertaintyBand: [12.1, 25.0], phaseLabel: "Onset Surge" },
  { dayIndex: 5, dateLabel: "16 Jun", isoDate: "2026-06-16", predictedMm: 24.2, historicalAvgMm: 5.8, uncertaintyLowMm: 16.5, uncertaintyHighMm: 33.4, uncertaintyBand: [16.5, 33.4], phaseLabel: "Onset Surge" },
  { dayIndex: 6, dateLabel: "17 Jun", isoDate: "2026-06-17", predictedMm: 16.0, historicalAvgMm: 6.2, uncertaintyLowMm: 9.8, uncertaintyHighMm: 22.8, uncertaintyBand: [9.8, 22.8], phaseLabel: "Onset Surge" },
  { dayIndex: 7, dateLabel: "18 Jun", isoDate: "2026-06-18", predictedMm: 7.4, historicalAvgMm: 6.9, uncertaintyLowMm: 3.2, uncertaintyHighMm: 12.1, uncertaintyBand: [3.2, 12.1], phaseLabel: "Onset Surge" },
  { dayIndex: 8, dateLabel: "19 Jun", isoDate: "2026-06-19", predictedMm: 1.8, historicalAvgMm: 7.4, uncertaintyLowMm: 0.2, uncertaintyHighMm: 4.5, uncertaintyBand: [0.2, 4.5], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 9, dateLabel: "20 Jun", isoDate: "2026-06-20", predictedMm: 0.6, historicalAvgMm: 7.9, uncertaintyLowMm: 0.0, uncertaintyHighMm: 2.2, uncertaintyBand: [0.0, 2.2], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 10, dateLabel: "21 Jun", isoDate: "2026-06-21", predictedMm: 0.2, historicalAvgMm: 8.3, uncertaintyLowMm: 0.0, uncertaintyHighMm: 1.8, uncertaintyBand: [0.0, 1.8], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 11, dateLabel: "22 Jun", isoDate: "2026-06-22", predictedMm: 0.0, historicalAvgMm: 8.8, uncertaintyLowMm: 0.0, uncertaintyHighMm: 1.4, uncertaintyBand: [0.0, 1.4], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 12, dateLabel: "23 Jun", isoDate: "2026-06-23", predictedMm: 0.4, historicalAvgMm: 9.1, uncertaintyLowMm: 0.0, uncertaintyHighMm: 2.0, uncertaintyBand: [0.0, 2.0], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 13, dateLabel: "24 Jun", isoDate: "2026-06-24", predictedMm: 0.9, historicalAvgMm: 9.5, uncertaintyLowMm: 0.0, uncertaintyHighMm: 2.8, uncertaintyBand: [0.0, 2.8], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 14, dateLabel: "25 Jun", isoDate: "2026-06-25", predictedMm: 1.2, historicalAvgMm: 10.1, uncertaintyLowMm: 0.2, uncertaintyHighMm: 3.6, uncertaintyBand: [0.2, 3.6], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 15, dateLabel: "26 Jun", isoDate: "2026-06-26", predictedMm: 1.9, historicalAvgMm: 10.6, uncertaintyLowMm: 0.4, uncertaintyHighMm: 4.9, uncertaintyBand: [0.4, 4.9], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 16, dateLabel: "27 Jun", isoDate: "2026-06-27", predictedMm: 3.2, historicalAvgMm: 11.0, uncertaintyLowMm: 1.0, uncertaintyHighMm: 7.2, uncertaintyBand: [1.0, 7.2], phaseLabel: "Break / Dry Spell", falseOnsetFlag: true },
  { dayIndex: 17, dateLabel: "28 Jun", isoDate: "2026-06-28", predictedMm: 8.6, historicalAvgMm: 11.4, uncertaintyLowMm: 4.2, uncertaintyHighMm: 14.8, uncertaintyBand: [4.2, 14.8], phaseLabel: "Active Monsoon" },
  { dayIndex: 18, dateLabel: "29 Jun", isoDate: "2026-06-29", predictedMm: 15.8, historicalAvgMm: 11.9, uncertaintyLowMm: 9.4, uncertaintyHighMm: 23.5, uncertaintyBand: [9.4, 23.5], phaseLabel: "Active Monsoon" },
  { dayIndex: 19, dateLabel: "30 Jun", isoDate: "2026-06-30", predictedMm: 21.4, historicalAvgMm: 12.2, uncertaintyLowMm: 13.8, uncertaintyHighMm: 31.0, uncertaintyBand: [13.8, 31.0], phaseLabel: "Active Monsoon" },
  { dayIndex: 20, dateLabel: "01 Jul", isoDate: "2026-07-01", predictedMm: 19.2, historicalAvgMm: 12.5, uncertaintyLowMm: 11.6, uncertaintyHighMm: 27.9, uncertaintyBand: [11.6, 27.9], phaseLabel: "Active Monsoon" },
  { dayIndex: 21, dateLabel: "02 Jul", isoDate: "2026-07-02", predictedMm: 14.0, historicalAvgMm: 12.8, uncertaintyLowMm: 8.2, uncertaintyHighMm: 21.4, uncertaintyBand: [8.2, 21.4], phaseLabel: "Active Monsoon" },
  { dayIndex: 22, dateLabel: "03 Jul", isoDate: "2026-07-03", predictedMm: 11.5, historicalAvgMm: 13.0, uncertaintyLowMm: 6.5, uncertaintyHighMm: 18.2, uncertaintyBand: [6.5, 18.2], phaseLabel: "Active Monsoon" },
  { dayIndex: 23, dateLabel: "04 Jul", isoDate: "2026-07-04", predictedMm: 9.8, historicalAvgMm: 13.2, uncertaintyLowMm: 5.0, uncertaintyHighMm: 16.0, uncertaintyBand: [5.0, 16.0], phaseLabel: "Active Monsoon" },
  { dayIndex: 24, dateLabel: "05 Jul", isoDate: "2026-07-05", predictedMm: 13.4, historicalAvgMm: 13.5, uncertaintyLowMm: 7.4, uncertaintyHighMm: 20.6, uncertaintyBand: [7.4, 20.6], phaseLabel: "Active Monsoon" },
  { dayIndex: 25, dateLabel: "06 Jul", isoDate: "2026-07-06", predictedMm: 26.8, historicalAvgMm: 13.8, uncertaintyLowMm: 16.0, uncertaintyHighMm: 39.2, uncertaintyBand: [16.0, 39.2], phaseLabel: "Active Monsoon" },
  { dayIndex: 26, dateLabel: "07 Jul", isoDate: "2026-07-07", predictedMm: 29.4, historicalAvgMm: 14.0, uncertaintyLowMm: 18.2, uncertaintyHighMm: 43.0, uncertaintyBand: [18.2, 43.0], phaseLabel: "Active Monsoon" },
  { dayIndex: 27, dateLabel: "08 Jul", isoDate: "2026-07-08", predictedMm: 17.6, historicalAvgMm: 14.2, uncertaintyLowMm: 10.4, uncertaintyHighMm: 26.8, uncertaintyBand: [10.4, 26.8], phaseLabel: "Active Monsoon" },
  { dayIndex: 28, dateLabel: "09 Jul", isoDate: "2026-07-09", predictedMm: 12.1, historicalAvgMm: 14.5, uncertaintyLowMm: 6.8, uncertaintyHighMm: 19.5, uncertaintyBand: [6.8, 19.5], phaseLabel: "Active Monsoon" },
  { dayIndex: 29, dateLabel: "10 Jul", isoDate: "2026-07-10", predictedMm: 10.4, historicalAvgMm: 14.6, uncertaintyLowMm: 5.6, uncertaintyHighMm: 17.0, uncertaintyBand: [5.6, 17.0], phaseLabel: "Active Monsoon" },
  { dayIndex: 30, dateLabel: "11 Jul", isoDate: "2026-07-11", predictedMm: 14.2, historicalAvgMm: 14.8, uncertaintyLowMm: 8.1, uncertaintyHighMm: 22.4, uncertaintyBand: [8.1, 22.4], phaseLabel: "Active Monsoon" },
];

export function buildForecastForBlock(
  blockId: string,
  horizon: ForecastHorizon,
  scenario: DemoScenarioId = "scenario_b"
): Forecast {
  const blocks = getBlocksForScenarioAndHorizon(scenario, horizon);
  const block = blocks.find((b) => b.id === blockId) || blocks[0];
  const daysLimit =
    horizon === "7D" ? 7 : horizon === "14D" ? 14 : horizon === "21D" ? 21 : 30;

  // Horizon-specific uncertainty multiplier (7D: Lower, 14D: Moderate, 21D: Higher, 30D: Highest)
  const uncertaintySpread =
    horizon === "7D"
      ? 0.15
      : horizon === "14D"
      ? 0.24
      : horizon === "21D"
      ? 0.35
      : 0.46;

  const uncertaintyTier =
    horizon === "7D"
      ? "Lower Uncertainty (±15%)"
      : horizon === "14D"
      ? "Moderate Uncertainty (±24%)"
      : horizon === "21D"
      ? "Higher Uncertainty (±35%)"
      : "Highest Uncertainty (±46%)";

  // Block-specific & Scenario-specific curve shaping
  const blockFactor =
    MOCK_BLOCKS.find((b) => b.id === block.id)?.expectedRainfall! / 94;

  const dailySeries = BASE_30_DAY_SERIES.slice(0, daysLimit).map((point) => {
    let rawPred = point.predictedMm * blockFactor;

    // Modify daily trajectory according to Demo Scenario
    if (scenario === "scenario_a") {
      // Favorable monsoon fills in the mid-June break window
      if (point.dayIndex >= 8 && point.dayIndex <= 16) {
        rawPred = point.historicalAvgMm * 1.15 * blockFactor;
      } else {
        rawPred = rawPred * 1.12;
      }
    } else if (scenario === "scenario_c") {
      // Prolonged break suppresses rainfall Days 6-18
      if (point.dayIndex >= 6 && point.dayIndex <= 19) {
        rawPred = Math.max(0, point.predictedMm * 0.25);
      }
    } else if (scenario === "scenario_d") {
      // Heavy rainfall spikes Days 10-16
      if (point.dayIndex >= 9 && point.dayIndex <= 16) {
        rawPred = (point.historicalAvgMm + 19.5) * blockFactor;
      } else {
        rawPred = rawPred * 1.25;
      }
    }

    const pred = Number(rawPred.toFixed(1));
    // Widen uncertainty progressively with dayIndex and horizon spread
    const progressiveFactor = uncertaintySpread * (1 + point.dayIndex * 0.018);
    const low = Number(Math.max(0, pred * (1 - progressiveFactor)).toFixed(1));
    const high = Number((pred * (1 + progressiveFactor) + 1.4).toFixed(1));

    const phaseLabel =
      scenario === "scenario_a" && point.phaseLabel === "Break / Dry Spell"
        ? "Active Monsoon"
        : scenario === "scenario_d" && point.dayIndex >= 9 && point.dayIndex <= 16
        ? "Active Monsoon"
        : point.phaseLabel;

    return {
      ...point,
      predictedMm: pred,
      uncertaintyLowMm: low,
      uncertaintyHighMm: high,
      uncertaintyBand: [low, high] as [number, number],
      phaseLabel,
    };
  });

  const falseOnsetRuleEngine = evaluateFalseOnsetRuleEngine(block, scenario);

  return {
    blockId: block.id,
    blockName: block.name,
    district: block.district,
    state: block.state,
    horizon,
    scenario,
    uncertaintyTier,
    generatedAt: "2026-06-12T06:00:00Z",
    onsetProbability: block.onsetProbability,
    onsetStatus:
      block.onsetProbability >= 75
        ? "Favorable"
        : block.onsetProbability >= 55
        ? "Uncertain"
        : "Delayed",
    breakMonsoonRisk: block.drySpellProbability,
    breakMonsoonStatus:
      block.drySpellProbability >= 70
        ? "Severe"
        : block.drySpellProbability >= 55
        ? "Elevated"
        : block.drySpellProbability >= 35
        ? "Moderate"
        : "Low",
    heavyRainfallRisk: block.heavyRainProbability,
    heavyRainfallStatus:
      block.heavyRainProbability >= 55
        ? "High"
        : block.heavyRainProbability >= 30
        ? "Moderate"
        : "Low",
    rainfallAnomalyPct: block.rainfallAnomaly,
    rainfallAnomalyStatus:
      block.rainfallAnomaly <= -25
        ? "Deficit"
        : block.rainfallAnomaly < -5
        ? "Below Normal"
        : block.rainfallAnomaly <= 5
        ? "Near Normal"
        : "Above Normal",
    expectedRainfallMm: block.expectedRainfall,
    soilMoisturePct: block.soilMoisture,
    currentStatusLabel:
      scenario === "scenario_a"
        ? "Active Onset Surge"
        : scenario === "scenario_c"
        ? "Sub-Seasonal Break Alert"
        : scenario === "scenario_d"
        ? "Heavy Monsoon Surge Watch"
        : "Potential Onset Window",
    expectedOnsetWindow: block.onsetWindow,
    confidence: block.confidence,
    falseOnsetRisk: block.falseOnsetProbability,
    expectedActivePhaseDays:
      scenario === "scenario_a" ? "9–12 days" : "4–7 days",
    expectedDrySpellDays: block.expectedDrySpellDays,
    falseOnsetWarningProbability: block.falseOnsetProbability,
    falseOnsetRecommendedAction: falseOnsetRuleEngine.recommendedAction,
    falseOnsetRuleEngine,
    dailySeries,
  };
}

export function getClimateIndicesForScenario(
  scenario: DemoScenarioId = "scenario_b"
): ClimateIndex[] {
  const meta =
    DEMO_SCENARIOS.find((s) => s.id === scenario) || DEMO_SCENARIOS[1];

  return [
    {
      id: "ENSO",
      name: "ENSO",
      fullName: "El Niño–Southern Oscillation (Niño 3.4)",
      currentPhase:
        scenario === "scenario_b" ? "Neutral" : meta.ensoPhase.split(" (")[0],
      indexValue:
        scenario === "scenario_b"
          ? "-0.18 °C"
          : meta.ensoPhase.match(/\((.*?)\)/)?.[1] || "-0.18 °C",
      influence: scenario === "scenario_c" ? "High" : "Moderate",
      impactOnRegion:
        scenario === "scenario_c"
          ? "-9% rainfall probability"
          : "+8% rainfall probability",
      rainfallProbabilityDelta: scenario === "scenario_c" ? "-9%" : "+8%",
      description:
        "Simulated Pacific SST teleconnection index modulating Walker circulation subsidence over the Indian subcontinent.",
      teleconnectionMechanism:
        "Absence of El Niño subsidence supports upper-tropospheric easterly jets across the Indo-Gangetic plains.",
      updatedAt: "Simulated climate-index scenario • NOAA / IMD Coupled Ensemble",
    },
    {
      id: "IOD",
      name: "IOD",
      fullName: "Indian Ocean Dipole (DMI Index)",
      currentPhase:
        scenario === "scenario_b" ? "Positive" : meta.iodPhase.split(" (")[0],
      indexValue:
        scenario === "scenario_b"
          ? "+0.64 °C"
          : meta.iodPhase.match(/\((.*?)\)/)?.[1] || "+0.64 °C",
      influence: "Moderate",
      impactOnRegion:
        scenario === "scenario_c"
          ? "+2% rainfall probability"
          : "+12% rainfall probability",
      rainfallProbabilityDelta: scenario === "scenario_c" ? "+2%" : "+12%",
      description:
        "Simulated Indian Ocean sea-surface dipole strengthening cross-equatorial Somali Jet moisture transport into Uttar Pradesh.",
      teleconnectionMechanism:
        "Positive IOD intensifies low-level moisture convergence along the Monsoon Trough axis.",
      updatedAt: "Simulated climate-index scenario • INCOIS Dipole Model",
    },
    {
      id: "MJO",
      name: "MJO",
      fullName: "Madden–Julian Oscillation",
      currentPhase:
        scenario === "scenario_b" ? "Phase 3" : meta.mjoPhase.split(" (")[0],
      amplitude: meta.mjoAmplitude,
      indexValue: `${meta.mjoPhase} (Amp ${meta.mjoAmplitude})`,
      influence: "High",
      impactOnRegion:
        scenario === "scenario_c"
          ? "Suppressed convection / dry break risk"
          : "Increased active-monsoon probability",
      rainfallProbabilityDelta:
        scenario === "scenario_c" ? "-14% break" : "+15% active burst",
      description:
        "Eastward-propagating intraseasonal convective wave driving 10–20 day active and break monsoon oscillations.",
      teleconnectionMechanism:
        "Controls intraseasonal oscillations (ISO), explaining both the initial wet surge and subsequent 8–11 day break-monsoon risk.",
      updatedAt: "Simulated climate-index scenario • Sub-seasonal RMM1/RMM2",
    },
  ];
}

export const MOCK_CLIMATE_INDICES: ClimateIndex[] =
  getClimateIndicesForScenario("scenario_b");

export const MOCK_CROPS: Crop[] = [
  {
    id: "paddy",
    name: "Paddy",
    hindiName: "धान (Paddy)",
    season: "Kharif",
    waterRequirementMm: "1100–1250 mm",
    criticalMoistureStage: "Nursery Sowing & Transplanting",
    stages: [
      "Nursery / Pre-sowing",
      "Sowing / Transplanting",
      "Tillering",
      "Panicle Initiation",
      "Maturity",
    ],
    iconName: "Sprout",
  },
  {
    id: "maize",
    name: "Maize",
    hindiName: "मक्का (Maize)",
    season: "Kharif",
    waterRequirementMm: "500–650 mm",
    criticalMoistureStage: "Germination & Knee-high Stage",
    stages: [
      "Pre-sowing Seedbed",
      "Sowing & Emergence",
      "Vegetative (Knee-high)",
      "Tasseling & Silking",
      "Grain Filling",
    ],
    iconName: "Wheat",
  },
  {
    id: "pulses",
    name: "Pulses",
    hindiName: "दलहन - अरहर/मूंग (Pulses)",
    season: "Kharif",
    waterRequirementMm: "350–450 mm",
    criticalMoistureStage: "Branching & Pod Formation",
    stages: [
      "Ridge Seedbed Prep",
      "Sowing",
      "Vegetative Branching",
      "Flowering",
      "Pod Development",
    ],
    iconName: "Leaf",
  },
  {
    id: "soybean",
    name: "Soybean",
    hindiName: "सोयाबीन (Soybean)",
    season: "Kharif",
    waterRequirementMm: "450–600 mm",
    criticalMoistureStage: "Sowing (Requires >=75mm cumulative rain)",
    stages: [
      "Pre-sowing",
      "Sowing & Germination",
      "Vegetative Nodulation",
      "Flowering",
      "Pod Fill",
    ],
    iconName: "Flower2",
  },
  {
    id: "cotton",
    name: "Cotton",
    hindiName: "कपास (Cotton)",
    season: "Kharif",
    waterRequirementMm: "650–800 mm",
    criticalMoistureStage: "Square Formation & Boll Development",
    stages: [
      "Pre-sowing",
      "Sowing",
      "Square Formation",
      "Flowering",
      "Boll Opening",
    ],
    iconName: "CloudSun",
  },
  {
    id: "wheat",
    name: "Wheat",
    hindiName: "गेहूँ (Wheat)",
    season: "Rabi",
    waterRequirementMm: "400–500 mm",
    criticalMoistureStage: "Residual Soil Moisture Conservation",
    stages: [
      "Monsoon Moisture Banking",
      "Pre-sowing Tillage",
      "Crown Root Initiation",
      "Heading",
      "Grain Ripening",
    ],
    iconName: "Wheat",
  },
];

/**
 * Prototype Agronomic Rule Engine (Section 9)
 * Evaluates onsetProbability, falseOnsetProbability, drySpellProbability,
 * heavyRainProbability, and soilMoisture for the selected Block + Crop + Horizon + Scenario.
 */
export function generateCropAdvisoryForSelection(
  blockId: string,
  cropId: string,
  growthStage: string,
  horizon: ForecastHorizon,
  scenario: DemoScenarioId = "scenario_b"
): CropAdvisory {
  const blocks = getBlocksForScenarioAndHorizon(scenario, horizon);
  const block = blocks.find((b) => b.id === blockId) || blocks[0];
  const crop = MOCK_CROPS.find((c) => c.id === cropId) || MOCK_CROPS[0];

  const {
    onsetProbability,
    falseOnsetProbability,
    drySpellProbability,
    heavyRainProbability,
    soilMoisture,
  } = block;

  const isElevatedFalseOnset = falseOnsetProbability > 60;
  const isElevatedDrySpell = drySpellProbability > 60;
  const isHeavyRainThreat = heavyRainProbability > 50;

  let headlineAdvisory = "";
  let triggeredRuleSummary = "";
  let actions: string[] = [];
  let irrigationRecommendation = "";
  let sowingWindowGuidance = "";

  if (crop.id === "paddy") {
    if (isElevatedFalseOnset || isElevatedDrySpell) {
      headlineAdvisory =
        "Delay rainfed sowing by 5–7 days and prepare supplemental irrigation.";
      triggeredRuleSummary = `Rule Triggered: IF False Onset (${falseOnsetProbability}%) > 60% OR Dry Spell (${drySpellProbability}%) > 60% → Delay rainfed Paddy sowing & stage backup water.`;
      actions = [
        "Prepare irrigation backup (borewell / canal roster check)",
        "Avoid immediate rainfed sowing during the 15–18 June initial shower",
        "Monitor next forecast update before nursery bed flooding",
        "Keep seedbed moisture under observation using straw mulching",
      ];
      irrigationRecommendation = `Maintain 2–3 cm supplemental water reserve for nursery plots during the ${block.expectedDrySpellDays} break phase.`;
      sowingWindowGuidance = `Target sowing after the ${block.expectedDrySpellDays} dry spell subsides (post-27 June active revival).`;
    } else if (isHeavyRainThreat) {
      headlineAdvisory =
        "Clear nursery drainage channels and withhold basal nitrogen top-dressing.";
      triggeredRuleSummary = `Rule Triggered: IF Heavy Rain Probability (${heavyRainProbability}%) > 50% → Prevent nursery submergence & nutrient leaching.`;
      actions = [
        "Open bund spillways in low-lying paddy nursery plots",
        "Postpone urea/DAP application until heavy downpour window passes",
        "Use raised seedbeds to prevent seedling washout",
        "Monitor water levels across Gram Panchayat tanks",
      ];
      irrigationRecommendation = "Suspend canal/tube-well pumping; prioritize excess runoff harvesting.";
      sowingWindowGuidance = "Favorable moisture for transplanting once heavy spell moderates.";
    } else {
      headlineAdvisory =
        "Proceed with timely paddy nursery bed preparation and seed treatment.";
      triggeredRuleSummary = `Rule Triggered: IF Onset (${onsetProbability}%) >= 75% AND False Onset (${falseOnsetProbability}%) <= 40% → Optimal Kharif nursery window.`;
      actions = [
        "Commence puddling and raised nursery bed preparation",
        "Treat certified paddy seed with Carbendazim / Trichoderma",
        "Harvest initial monsoon showers via field bunds",
        "Schedule transplanting in 21–25 days",
      ];
      irrigationRecommendation = "Natural rainfall sufficient; maintain 2 cm standing water.";
      sowingWindowGuidance = `Active onset window (${block.onsetWindow}) is favorable.`;
    }
  } else if (crop.id === "maize") {
    if (isElevatedFalseOnset || isElevatedDrySpell) {
      headlineAdvisory =
        "Consider delaying sowing and maintain irrigation contingency.";
      triggeredRuleSummary = `Rule Triggered: IF False Onset (${falseOnsetProbability}%) > 60% OR Soil Moisture (${soilMoisture}%) < 40% → Delay flat-bed Maize sowing & use ridge-furrow.`;
      actions = [
        "Delay dry-sowing by 4–6 days until cumulative rainfall exceeds 50 mm",
        "Sow on raised ridges to conserve furrow moisture during the break window",
        "Keep sprinkler / portable pump irrigation on standby",
        "Apply organic mulch to minimize topsoil crusting",
      ];
      irrigationRecommendation = `Apply light 30 mm life-saving irrigation if the ${block.expectedDrySpellDays} dry spell persists.`;
      sowingWindowGuidance = "Recommended sowing post active monsoon revival.";
    } else {
      headlineAdvisory =
        "Sow maize on raised ridge-and-furrow beds with adequate drainage.";
      triggeredRuleSummary = `Rule Triggered: IF Onset (${onsetProbability}%) favorable → Ridge planting maximizes germination & prevents waterlogging.`;
      actions = [
        "Plant on ridges spaced 60 cm apart to avoid root waterlogging",
        "Apply basal NPK and Zinc Sulphate in furrows",
        "Keep perimeter drainage clear during active bursts",
        "Monitor early whorl stage for fall armyworm",
      ];
      irrigationRecommendation = "No supplemental irrigation required this week.";
      sowingWindowGuidance = `Favorable sowing window: ${block.onsetWindow}.`;
    }
  } else if (crop.id === "pulses") {
    if (isElevatedDrySpell || isElevatedFalseOnset) {
      headlineAdvisory =
        "Consider drought-tolerant varieties if dry spell probability remains elevated.";
      triggeredRuleSummary = `Rule Triggered: IF Dry Spell Probability (${drySpellProbability}%) > 60% → Recommend short-duration drought-tolerant Arhar/Moong varieties.`;
      actions = [
        "Select drought-hardy varieties (Arhar IPA-203 / Moong Samrat) for upland plots",
        "Sow on raised beds after initial 40 mm soil-wetting rain",
        "Inoculate seed with Rhizobium and PSB bio-fertilizer",
        "Intercrop Arhar with short-duration Urd/Moong to hedge moisture risk",
      ];
      irrigationRecommendation = "Single life-saving furrow irrigation only if dry spell exceeds 10 days.";
      sowingWindowGuidance = "Suitable replacement crop for moisture-deficient paddy uplands.";
    } else {
      headlineAdvisory =
        "Proceed with raised-bed pulse sowing and ensure field drainage.";
      triggeredRuleSummary = `Rule Triggered: IF Heavy Rain (${heavyRainProbability}%) > 40% → Raised beds prevent Phytophthora wilt in pulses.`;
      actions = [
        "Use raised-bed planter to prevent collar rot and waterlogging",
        "Treat seed with Trichoderma viride (4g/kg seed)",
        "Maintain drainage furrows between pulse rows",
        "Avoid low-lying clay depressions for Arhar",
      ];
      irrigationRecommendation = "Zero irrigation required; focus on drainage management.";
      sowingWindowGuidance = `Sowing window active (${block.onsetWindow}).`;
    }
  } else {
    headlineAdvisory =
      isElevatedFalseOnset || isElevatedDrySpell
        ? `Delay ${crop.name} sowing by 5–7 days and prepare supplemental irrigation.`
        : `Proceed with ${crop.name} seedbed preparation on well-drained ridges.`;
    triggeredRuleSummary = `Rule Triggered: Evaluated Onset (${onsetProbability}%), False Onset (${falseOnsetProbability}%), Dry Spell (${drySpellProbability}%), and Soil Moisture (${soilMoisture}%).`;
    actions = [
      `Verify minimum 60 mm cumulative soil moisture before ${crop.name} sowing`,
      `Prepare supplemental irrigation backup for the ${block.expectedDrySpellDays} break window`,
      "Apply surface mulching to conserve root-zone moisture",
      "Monitor next 72-hour MonsoonPulse AI block forecast update",
    ];
    irrigationRecommendation = `Keep 1 life-saving irrigation cycle ready during ${block.expectedDrySpellDays} dry spell.`;
    sowingWindowGuidance = `Target sowing window: ${block.onsetWindow}.`;
  }

  const rainfallProbability = clamp(100 - drySpellProbability + 10, 22, 88);

  return {
    id: `adv-${block.id}-${crop.id}-${horizon}-${scenario}`,
    blockId: block.id,
    blockName: block.name,
    cropId: crop.id,
    cropName: crop.name,
    growthStage,
    horizon,
    rainfallProbability,
    drySpellProbability,
    falseOnsetProbability,
    heavyRainProbability,
    soilMoisturePct: soilMoisture,
    riskLevel: block.riskLevel,
    headlineAdvisory,
    triggeredRuleSummary,
    probabilityToRiskSummary: {
      probabilityText: `${drySpellProbability}% dry spell probability & ${falseOnsetProbability}% false onset risk`,
      riskText:
        isElevatedFalseOnset || isElevatedDrySpell
          ? `High seedling desiccation & moisture-stress risk (${block.expectedDrySpellDays} break)`
          : isHeavyRainThreat
          ? `Waterlogging & runoff stress risk (${heavyRainProbability}% heavy rain)`
          : `Favorable root-zone moisture (${soilMoisture}%) with low break risk`,
      actionText: headlineAdvisory,
    },
    actions,
    irrigationRecommendation,
    sowingWindowGuidance,
    confidence: clamp(block.confidence + 3, 68, 92),
    generatedAt: "2026-06-12T06:30:00Z",
  };
}

/**
 * Dynamic Alert Rule Engine (Section 12)
 * Automatically generates alerts from the active block and district block matrix:
 * - IF drySpellProbability > 60 -> HIGH PRIORITY: "Potential prolonged dry spell detected."
 * - IF falseOnsetProbability > 60 -> WARNING: "False onset probability is elevated."
 * - IF heavyRainProbability > 50 -> WARNING: "Heavy rainfall risk is elevated."
 */
export function generateDynamicAlertsForState(
  selectedBlock: Block,
  allBlocks: Block[],
  horizon: ForecastHorizon
): Alert[] {
  const generated: Alert[] = [];

  const highDrySpellBlocks = allBlocks.filter((b) => b.drySpellProbability > 60);
  const highFalseOnsetBlocks = allBlocks.filter(
    (b) => b.falseOnsetProbability > 60
  );
  const highHeavyRainBlocks = allBlocks.filter(
    (b) => b.heavyRainProbability > 50
  );

  if (selectedBlock.drySpellProbability > 60 || highDrySpellBlocks.length > 0) {
    const blocksList =
      selectedBlock.drySpellProbability > 60
        ? [
            `${selectedBlock.name.replace(" Block", "")} (${selectedBlock.drySpellProbability}%)`,
            ...highDrySpellBlocks
              .filter((b) => b.id !== selectedBlock.id)
              .slice(0, 3)
              .map((b) => `${b.name.replace(" Block", "")} (${b.drySpellProbability}%)`),
          ]
        : highDrySpellBlocks.map((b) => b.name.replace(" Block", ""));

    generated.push({
      id: `dyn-dry-${selectedBlock.id}-${horizon}`,
      severity: "high",
      severityLabel: "HIGH PRIORITY",
      title: `Potential prolonged dry spell detected (${selectedBlock.expectedDrySpellDays})`,
      message: `Potential prolonged dry spell detected. ${selectedBlock.name} shows ${selectedBlock.drySpellProbability}% break-monsoon probability over ${horizon}.`,
      affectedBlocksCount: Math.max(1, highDrySpellBlocks.length),
      affectedBlocks: blocksList,
      timestamp: "Active Rule • Live Evaluation",
      read: false,
      category: "Dry Spell",
      ruleOrigin: "IF drySpellProbability > 60%",
    });
  }

  if (
    selectedBlock.falseOnsetProbability > 60 ||
    highFalseOnsetBlocks.length > 0
  ) {
    const blocksList =
      selectedBlock.falseOnsetProbability > 60
        ? [
            `${selectedBlock.name.replace(" Block", "")} (${selectedBlock.falseOnsetProbability}%)`,
            ...highFalseOnsetBlocks
              .filter((b) => b.id !== selectedBlock.id)
              .slice(0, 2)
              .map((b) => `${b.name.replace(" Block", "")} (${b.falseOnsetProbability}%)`),
          ]
        : highFalseOnsetBlocks.map((b) => `${b.name.replace(" Block", "")} (${b.falseOnsetProbability}%)`);

    generated.push({
      id: `dyn-false-${selectedBlock.id}-${horizon}`,
      severity: "warning",
      severityLabel: "WARNING",
      title: "False onset probability is elevated",
      message: `False onset probability is elevated (${selectedBlock.falseOnsetProbability}% in ${selectedBlock.name}). Delay rainfed sowing by 5–7 days.`,
      affectedBlocksCount: Math.max(1, highFalseOnsetBlocks.length),
      affectedBlocks: blocksList,
      timestamp: "Active Rule • Live Evaluation",
      read: false,
      category: "False Onset",
      ruleOrigin: "IF falseOnsetProbability > 60%",
    });
  }

  if (
    selectedBlock.heavyRainProbability > 50 ||
    highHeavyRainBlocks.length > 0
  ) {
    generated.push({
      id: `dyn-heavy-${selectedBlock.id}-${horizon}`,
      severity: "warning",
      severityLabel: "WARNING",
      title: "Heavy rainfall risk is elevated",
      message: `Heavy rainfall risk is elevated (${
        selectedBlock.heavyRainProbability > 50
          ? `${selectedBlock.heavyRainProbability}% in ${selectedBlock.name}`
          : `58% in Handia Block`
      }). Clear field drainage bunds.`,
      affectedBlocksCount: Math.max(1, highHeavyRainBlocks.length),
      affectedBlocks: highHeavyRainBlocks.map((b) => b.name.replace(" Block", "")),
      timestamp: "Active Rule • Live Evaluation",
      read: false,
      category: "Heavy Rain",
      ruleOrigin: "IF heavyRainProbability > 50%",
    });
  }

  generated.push({
    id: `dyn-watch-${selectedBlock.id}-${horizon}`,
    severity: "watch",
    severityLabel: "WATCH",
    title: "Sub-Seasonal Rainfall Anomaly Telemetry",
    message: `Rainfall anomaly in ${selectedBlock.name} is ${
      selectedBlock.rainfallAnomaly > 0
        ? `+${selectedBlock.rainfallAnomaly}%`
        : `${selectedBlock.rainfallAnomaly}%`
    } with root-zone soil moisture at ${selectedBlock.soilMoisture}%.`,
    affectedBlocksCount: allBlocks.length,
    affectedBlocks: [selectedBlock.name, "Prayagraj Cluster"],
    timestamp: `${horizon} Horizon Sync`,
    read: false,
    category: "Rainfall Anomaly",
    ruleOrigin: "Continuous Block Telemetry",
  });

  return generated;
}

export const INITIAL_ALERTS: Alert[] = generateDynamicAlertsForState(
  MOCK_BLOCKS[0],
  MOCK_BLOCKS,
  "14D"
);

export const MOCK_FARMERS: Farmer[] = [
  {
    id: "frm-101",
    name: "Ramesh Chandra Patel",
    hindiName: "रमेश चंद्र पटेल",
    phone: "+91 94512 •••84",
    blockId: "karchhana",
    blockName: "Karchhana Block",
    panchayatName: "Bhita Gram Panchayat",
    primaryCrop: "Paddy",
    landSizeAcres: 3.5,
    preferredLanguage: "Hindi",
    preferredChannel: "WhatsApp",
    lastAdvisorySentAt: "Today, 08:15 AM",
  },
  {
    id: "frm-102",
    name: "Sukhdev Prasad Maurya",
    hindiName: "सुखदेव प्रसाद मौर्य",
    phone: "+91 98390 •••19",
    blockId: "phulpur",
    blockName: "Phulpur Block",
    panchayatName: "Mailahan Panchayat",
    primaryCrop: "Paddy",
    landSizeAcres: 2.2,
    preferredLanguage: "Hindi",
    preferredChannel: "SMS",
    lastAdvisorySentAt: "Today, 08:15 AM",
  },
  {
    id: "frm-103",
    name: "Smt. Kavita Devi Bind",
    hindiName: "श्रीमती कविता देवी बिंद",
    phone: "+91 87654 •••62",
    blockId: "meja",
    blockName: "Meja Block",
    panchayatName: "Sirsa Gram Panchayat",
    primaryCrop: "Pulses",
    landSizeAcres: 4.0,
    preferredLanguage: "Hindi",
    preferredChannel: "WhatsApp",
    lastAdvisorySentAt: "Yesterday",
  },
  {
    id: "frm-104",
    name: "Brijesh Kumar Yadav",
    hindiName: "बृजेश कुमार यादव",
    phone: "+91 91256 •••41",
    blockId: "soraon",
    blockName: "Soraon Block",
    panchayatName: "Mewalal Baghiya",
    primaryCrop: "Paddy",
    landSizeAcres: 5.1,
    preferredLanguage: "English",
    preferredChannel: "Mobile App",
    lastAdvisorySentAt: "Today, 09:00 AM",
  },
  {
    id: "frm-105",
    name: "Harishankar Shukla",
    hindiName: "हरिशंकर शुक्ला",
    phone: "+91 94153 •••07",
    blockId: "koraon",
    blockName: "Koraon Block",
    panchayatName: "Mahuli Gram Panchayat",
    primaryCrop: "Soybean",
    landSizeAcres: 6.4,
    preferredLanguage: "Hindi",
    preferredChannel: "SMS",
    lastAdvisorySentAt: "Yesterday",
  },
];

export const MOCK_WEATHER_OBSERVATION: WeatherObservation = {
  id: "obs-prg-20260612",
  blockId: "karchhana",
  observedAt: "12 June 2026, 12:00 IST",
  temperatureMaxC: 39.4,
  temperatureMinC: 28.6,
  humidityPct: 58,
  soilMoisturePct: 34,
  windSpeedKmh: 18.5,
  cumulativeRain7dMm: 14.2,
};
