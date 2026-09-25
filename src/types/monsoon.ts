export type ForecastHorizon = "7D" | "14D" | "21D" | "30D";

export type RiskLevel = "Low" | "Moderate" | "High" | "Very High";

export type RiskFilterType =
  | "monsoon_onset"
  | "false_onset"
  | "dry_spell"
  | "heavy_rainfall"
  | "expected_rainfall"
  | "rainfall_deficit"
  | "overall_agricultural_risk";

export type DemoScenarioId =
  | "scenario_a" // Scenario A — Favorable Monsoon
  | "scenario_b" // Scenario B — False Onset (Default Hackathon Showcase)
  | "scenario_c" // Scenario C — Prolonged Break
  | "scenario_d"; // Scenario D — Heavy Rainfall

export type FarmerLanguage = "Hindi" | "English";

export interface DemoScenarioMeta {
  id: DemoScenarioId;
  code: string;
  label: string;
  shortLabel: string;
  description: string;
  ensoPhase: string;
  iodPhase: string;
  mjoPhase: string;
  mjoAmplitude: number;
}

export interface User {
  id: string;
  name: string;
  role: "Agricultural Officer" | "Block Coordinator" | "Climate Scientist" | "Farmer";
  state: string;
  district: string;
  assignedBlocks: string[];
  email: string;
}

export interface Location {
  state: string;
  district: string;
  blockId: string;
  blockName: string;
  panchayatId?: string;
  panchayatName?: string;
}

export interface Panchayat {
  id: string;
  name: string;
  blockId: string;
  farmersCount: number;
  soilMoistureIndex: number; // %
  dominantCrop: string;
  onsetProbability: number;
  drySpellRisk: number;
}

export interface Block {
  id: string;
  name: string;
  district: string;
  state: string;
  coordinates: [number, number]; // [lat, lng] center
  polygon: [number, number][]; // boundary polygon coordinates
  panchayats: Panchayat[];
  farmersRegistered: number;
  cultivatedAreaHa: number;
  soilType: string;
  irrigationCoverage: number; // %
  // Standardized centralized block fields
  onsetProbability: number;
  falseOnsetProbability: number;
  falseOnsetRisk: number; // alias kept for full backward compatibility
  drySpellProbability: number;
  drySpellRisk: number; // alias kept for full backward compatibility
  heavyRainProbability: number;
  heavyRainfallRisk: number; // alias kept for full backward compatibility
  rainfallAnomaly: number;
  rainfallAnomalyPct: number; // alias kept for full backward compatibility
  expectedRainfall: number;
  expectedRainfallMm: number; // alias kept for full backward compatibility
  confidence: number;
  expectedDrySpellDays: string;
  onsetWindow: string;
  soilMoisture: number;
  riskLevel: RiskLevel;
  mainIssue: string;
  recommendedAdvisory: string;
}

export interface ClimateIndex {
  id: "ENSO" | "IOD" | "MJO";
  name: string;
  fullName: string;
  currentPhase: string;
  amplitude?: number;
  indexValue: string;
  influence: "Low" | "Moderate" | "High";
  impactOnRegion: string;
  rainfallProbabilityDelta: string;
  description: string;
  teleconnectionMechanism: string;
  updatedAt: string;
}

export interface WeatherObservation {
  id: string;
  blockId: string;
  observedAt: string;
  temperatureMaxC: number;
  temperatureMinC: number;
  humidityPct: number;
  soilMoisturePct: number;
  windSpeedKmh: number;
  cumulativeRain7dMm: number;
}

export interface DailyForecastPoint {
  dayIndex: number;
  dateLabel: string;
  isoDate: string;
  predictedMm: number;
  historicalAvgMm: number;
  uncertaintyLowMm: number;
  uncertaintyHighMm: number;
  uncertaintyBand: [number, number];
  phaseLabel: "Pre-Onset" | "Onset Surge" | "Break / Dry Spell" | "Active Monsoon";
  falseOnsetFlag?: boolean;
}

export interface FalseOnsetRuleEvaluation {
  initialRainHigh: boolean;
  initialRainBurstMm: number;
  soilMoistureTempIncrease: boolean;
  peakSoilMoisturePct: number;
  subsequentRainDrop: boolean;
  subsequentRainProbPct: number;
  drySpellHigh: boolean;
  computedFalseOnsetProbability: number;
  expectedDrySpellDays: string;
  recommendedAction: string;
  ruleTriggered: boolean;
}

export interface Forecast {
  blockId: string;
  blockName: string;
  district: string;
  state: string;
  horizon: ForecastHorizon;
  scenario: DemoScenarioId;
  uncertaintyTier: "Lower Uncertainty (±15%)" | "Moderate Uncertainty (±24%)" | "Higher Uncertainty (±35%)" | "Highest Uncertainty (±46%)";
  generatedAt: string;
  // KPI probabilities
  onsetProbability: number;
  onsetStatus: "Favorable" | "Delayed" | "Uncertain" | "Active";
  breakMonsoonRisk: number;
  breakMonsoonStatus: "Low" | "Moderate" | "Elevated" | "Severe";
  heavyRainfallRisk: number;
  heavyRainfallStatus: "Low" | "Moderate" | "Elevated" | "High";
  rainfallAnomalyPct: number;
  rainfallAnomalyStatus: "Above Normal" | "Near Normal" | "Below Normal" | "Deficit";
  expectedRainfallMm: number;
  soilMoisturePct: number;
  // Monsoon Status Card
  currentStatusLabel: string;
  expectedOnsetWindow: string;
  confidence: number;
  falseOnsetRisk: number;
  expectedActivePhaseDays: string;
  expectedDrySpellDays: string;
  // False Onset Early Warning
  falseOnsetWarningProbability: number;
  falseOnsetRecommendedAction: string;
  falseOnsetRuleEngine: FalseOnsetRuleEvaluation;
  // Daily time series
  dailySeries: DailyForecastPoint[];
}

export interface RiskPrediction {
  blockId: string;
  blockName: string;
  horizon: ForecastHorizon;
  onsetProbability: number;
  falseOnsetRisk: number;
  drySpellRisk: number;
  heavyRainfallRisk: number;
  rainfallDeficitRisk: number;
  expectedRainfallMm: number;
  rainfallAnomalyPct: number;
  confidence: number;
  overallRisk: RiskLevel;
}

export interface Crop {
  id: string;
  name: string;
  hindiName: string;
  season: "Kharif" | "Rabi" | "Zaid";
  waterRequirementMm: string;
  criticalMoistureStage: string;
  stages: string[];
  iconName: string;
}

export interface CropAdvisory {
  id: string;
  blockId: string;
  blockName: string;
  cropId: string;
  cropName: string;
  growthStage: string;
  horizon: ForecastHorizon;
  rainfallProbability: number;
  drySpellProbability: number;
  falseOnsetProbability: number;
  heavyRainProbability: number;
  soilMoisturePct: number;
  riskLevel: RiskLevel;
  headlineAdvisory: string;
  triggeredRuleSummary: string;
  probabilityToRiskSummary: {
    probabilityText: string;
    riskText: string;
    actionText: string;
  };
  actions: string[];
  irrigationRecommendation: string;
  sowingWindowGuidance: string;
  confidence: number;
  generatedAt: string;
}

export interface Alert {
  id: string;
  severity: "high" | "warning" | "watch";
  severityLabel: "HIGH PRIORITY" | "WARNING" | "WATCH";
  title: string;
  message: string;
  affectedBlocksCount: number;
  affectedBlocks: string[];
  timestamp: string;
  read: boolean;
  category: "Dry Spell" | "False Onset" | "Rainfall Anomaly" | "Heavy Rain";
  ruleOrigin?: string;
}

export interface Farmer {
  id: string;
  name: string;
  hindiName: string;
  phone: string;
  blockId: string;
  blockName: string;
  panchayatName: string;
  primaryCrop: string;
  landSizeAcres: number;
  preferredLanguage: "Hindi" | "English";
  preferredChannel: "WhatsApp" | "SMS" | "Mobile App";
  lastAdvisorySentAt?: string;
}
