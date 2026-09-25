import {
  MOCK_WEATHER_OBSERVATION,
  buildForecastForBlock,
  generateCropAdvisoryForSelection,
  getBlocksForScenarioAndHorizon,
  getClimateIndicesForScenario,
} from "@/data/mockData";
import {
  Block,
  ClimateIndex,
  CropAdvisory,
  DemoScenarioId,
  Forecast,
  ForecastHorizon,
  WeatherObservation,
} from "@/types/monsoon";

export async function getClimateIndices(
  scenario: DemoScenarioId = "scenario_b"
): Promise<ClimateIndex[]> {
  return getClimateIndicesForScenario(scenario);
}

export async function getWeatherData(
  blockId: string = "karchhana",
  scenario: DemoScenarioId = "scenario_b",
  horizon: ForecastHorizon = "14D"
): Promise<WeatherObservation> {
  const blocks = getBlocksForScenarioAndHorizon(scenario, horizon);
  const block = blocks.find((b) => b.id === blockId) || blocks[0];
  return {
    ...MOCK_WEATHER_OBSERVATION,
    blockId: block.id,
    soilMoisturePct: block.soilMoisture,
  };
}

export async function getForecast(
  blockId: string = "karchhana",
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Forecast> {
  return buildForecastForBlock(blockId, horizon, scenario);
}

export async function getRiskMapData(
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Block[]> {
  return getBlocksForScenarioAndHorizon(scenario, horizon);
}

export async function getCropAdvisory(
  blockId: string,
  cropId: string,
  growthStage: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<CropAdvisory> {
  return generateCropAdvisoryForSelection(
    blockId,
    cropId,
    growthStage,
    horizon,
    scenario
  );
}

/**
 * Dynamically generates Hindi and English farmer messages (Section 10)
 * Changes automatically when Block, Crop, Language, Horizon, or Scenario changes.
 */
export function generateFarmerMessage(params: {
  blockName: string;
  cropName: string;
  drySpellProbability: number;
  falseOnsetProbability?: number;
  heavyRainProbability?: number;
  horizonDays: number;
  delayDays?: string;
}): { hindi: string; english: string } {
  const {
    blockName,
    cropName,
    drySpellProbability = 62,
    falseOnsetProbability = 68,
    heavyRainProbability = 34,
    horizonDays = 14,
    delayDays = "5–7",
  } = params;

  const hindiCropMap: Record<string, string> = {
    Paddy: "धान",
    Maize: "मक्का",
    Pulses: "अरहर/मूंग (दलहन)",
    Soybean: "सोयाबीन",
    Cotton: "कपास",
    Wheat: "गेहूँ",
  };

  const cropHindi = hindiCropMap[cropName] || "धान";
  const isElevatedDryOrFalse =
    drySpellProbability >= 55 || falseOnsetProbability >= 60;
  const isHeavyRain = heavyRainProbability >= 55 && !isElevatedDryOrFalse;

  let hindiActionLine = `${cropHindi} की बुवाई ${delayDays} दिन टालने पर विचार करें और वैकल्पिक सिंचाई की व्यवस्था तैयार रखें।`;
  let englishActionLine = `Consider delaying rainfed ${cropName.toLowerCase()} sowing by ${delayDays} days and keep supplemental irrigation ready.`;

  if (cropName === "Pulses" && isElevatedDryOrFalse) {
    hindiActionLine = `सूखे की स्थिति को देखते हुए ${cropHindi} की सूखा-सहनशील किस्मों का चयन करें और मेड़ पर बुवाई करें।`;
    englishActionLine = `Consider drought-tolerant ${cropName.toLowerCase()} varieties on raised beds and maintain irrigation contingency.`;
  } else if (isHeavyRain) {
    hindiActionLine = `भारी वर्षा की संभावना (${heavyRainProbability}%) को देखते हुए ${cropHindi} के खेतों में जल निकासी की व्यवस्था सुनिश्चित करें।`;
    englishActionLine = `With elevated heavy rainfall risk (${heavyRainProbability}%), clear field drainage channels for ${cropName.toLowerCase()} plots.`;
  } else if (!isElevatedDryOrFalse) {
    hindiActionLine = `अनुकूल मानसून संकेत के साथ ${cropHindi} की नर्सरी एवं बुवाई की तैयारी समय पर करें।`;
    englishActionLine = `Conditions are favorable for timely ${cropName.toLowerCase()} seedbed preparation and sowing.`;
  }

  const hindi = `🌧️ मानसून अपडेट (${blockName})

आपके क्षेत्र में अगले ${horizonDays} दिनों में लंबे सूखे की संभावना ${drySpellProbability}% है।

${hindiActionLine}

अगला पूर्वानुमान अपडेट 3 दिनों में।`;

  const english = `MONSOON UPDATE (${blockName})

Your area has an elevated probability (${drySpellProbability}%) of a prolonged dry spell over the next ${horizonDays} days.

${englishActionLine}

Next forecast update: 3 days.`;

  return { hindi, english };
}

export async function sendSMS(payload: {
  blockName: string;
  recipientsCount: number;
  language: string;
  message: string;
}): Promise<{ success: boolean; dispatchId: string; timestamp: string }> {
  await new Promise((r) => setTimeout(r, 380));
  return {
    success: true,
    dispatchId: `SMS-UP-${Math.floor(100000 + Math.random() * 900000)}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export async function sendWhatsApp(payload: {
  blockName: string;
  recipientsCount: number;
  language: string;
  message: string;
}): Promise<{ success: boolean; dispatchId: string; timestamp: string }> {
  await new Promise((r) => setTimeout(r, 380));
  return {
    success: true,
    dispatchId: `WA-UP-${Math.floor(100000 + Math.random() * 900000)}`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
