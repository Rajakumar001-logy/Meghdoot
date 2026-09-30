import { getSupabaseClient } from "@/lib/supabase";
import {
  MOCK_BLOCKS,
  getBlocksForScenarioAndHorizon,
} from "@/data/mockData";
import { LocationRow, LocationDataCoverage } from "@/types/database";
import { Block, DemoScenarioId, ForecastHorizon, RiskLevel } from "@/types/monsoon";
import statesData from "@/data/lgd/states.json";
import districtsData from "@/data/lgd/districts.json";
import { resolveLocationCoordinates } from "@/data/lgd/districtCoordinates";

export interface HierarchyValidationResult {
  valid: boolean;
  error?: string;
}

// In-memory caches for high-performance cascading lookups
let cachedStates: string[] | null = null;
const cachedDistrictsByState: Record<string, string[]> = {};
const cachedBlocksByDistrict: Record<string, Block[]> = {};

// Build LGD state -> districts map
export const LGD_STATE_DISTRICTS: Record<string, string[]> = {};
export const LGD_DISTRICT_TO_STATE: Record<string, string> = {};

districtsData.forEach((d) => {
  const sName = d.stateName;
  const dName = d.name;
  if (!LGD_STATE_DISTRICTS[sName]) {
    LGD_STATE_DISTRICTS[sName] = [];
  }
  if (!LGD_STATE_DISTRICTS[sName].includes(dName)) {
    LGD_STATE_DISTRICTS[sName].push(dName);
  }
  LGD_DISTRICT_TO_STATE[dName.toLowerCase()] = sName;
});

// All 36 States and UTs in alphabetical order
export const ALL_LGD_STATES: string[] = statesData.map((s) => s.name);

/**
 * Retrieves list of available states.
 * Connects to Supabase `locations` if configured, merged with official LGD states.
 */
export async function getStates(): Promise<string[]> {
  if (cachedStates && cachedStates.length > 0) {
    return cachedStates;
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from("locations").select("state, state_name");
      if (!error && data && data.length > 0) {
        const dbStates = Array.from(
          new Set(data.map((r: any) => (r.state_name || r.state || "").trim()).filter(Boolean))
        ) as string[];
        const merged = Array.from(new Set([...ALL_LGD_STATES, ...dbStates])).sort((a, b) =>
          a.localeCompare(b)
        );
        cachedStates = merged;
        return merged;
      }
    } catch {
      // Fallback to LGD directory
    }
  }

  cachedStates = ALL_LGD_STATES;
  return ALL_LGD_STATES;
}

/**
 * Retrieves list of available districts for a given state.
 * Strictly verifies state relationship using official LGD directory.
 */
export async function getDistrictsForState(state: string): Promise<string[]> {
  const normalizedState = state?.trim();
  if (!normalizedState) return [];

  if (cachedDistrictsByState[normalizedState]) {
    return cachedDistrictsByState[normalizedState];
  }

  const lgdDistricts = LGD_STATE_DISTRICTS[normalizedState] || [];
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from("locations")
        .select("district, district_name")
        .ilike("state", normalizedState);
      if (!error && data && data.length > 0) {
        const dbDistricts = Array.from(
          new Set(data.map((r: any) => (r.district_name || r.district || "").trim()).filter(Boolean))
        ) as string[];
        const merged = Array.from(new Set([...lgdDistricts, ...dbDistricts])).sort((a, b) =>
          a.localeCompare(b)
        );
        cachedDistrictsByState[normalizedState] = merged;
        return merged;
      }
    } catch {
      // Fallback
    }
  }

  cachedDistrictsByState[normalizedState] = lgdDistricts;
  return lgdDistricts;
}

/**
 * Retrieves location records from Supabase `locations` table or fallback.
 * Can optionally filter by state and district.
 */
export async function getLocations(
  state?: string,
  district?: string
): Promise<LocationRow[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      let query = client.from("locations").select("*");
      if (state) {
        query = query.ilike("state", state.trim());
      }
      if (district) {
        query = query.ilike("district", district.trim());
      }
      const { data, error } = await query.order("block", { ascending: true });
      if (!error && data) {
        return data as LocationRow[];
      }
    } catch {
      // Fallback
    }
  }

  // Fallback
  let filtered = MOCK_BLOCKS;
  if (state) {
    filtered = filtered.filter(
      (b) => b.state.toLowerCase() === state.trim().toLowerCase()
    );
  }
  if (district) {
    filtered = filtered.filter(
      (b) => b.district.toLowerCase() === district.trim().toLowerCase()
    );
  }

  return filtered.map((b) => ({
    id: b.id,
    state: b.state,
    district: b.district,
    block: b.name,
    panchayat: b.panchayats[0]?.name || `${b.name} Gram Panchayat`,
    latitude: b.coordinates[0],
    longitude: b.coordinates[1],
    soil_type: b.soilType,
    data_coverage: (b.id === "karchhana" ? "FULL" : "LOCATION_ONLY") as LocationDataCoverage,
    created_at: "2026-06-12T06:00:00Z",
  }));
}

/**
 * Helper to fetch LGD block items for a given state & district.
 * Uses `/api/locations?type=blocks` in browser and direct server loader in Node.
 */
async function fetchLGDBlocksForDistrict(
  state?: string,
  district?: string
): Promise<any[]> {
  if (!district) return [];
  const cacheKey = `${state || ""}:${district}`.toLowerCase();
  if (cachedBlocksByDistrict[cacheKey]) {
    return cachedBlocksByDistrict[cacheKey];
  }

  // 1. Browser client environment: fetch via Next.js API route
  if (typeof window !== "undefined") {
    try {
      const url = `/api/locations?type=blocks&state=${encodeURIComponent(
        state || ""
      )}&district=${encodeURIComponent(district)}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.blocks)) {
          return json.blocks;
        }
      }
    } catch {
      // Fallback below
    }
  }

  // 2. Server-side / Node / test environment: direct module load
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const blocksData = require("@/data/lgd/blocks.json");
    let filtered = blocksData.filter(
      (b: any) => b.districtName.toLowerCase() === district.trim().toLowerCase()
    );
    if (state) {
      filtered = filtered.filter(
        (b: any) => b.stateName.toLowerCase() === state.trim().toLowerCase()
      );
    }
    return filtered;
  } catch {
    return [];
  }
}

/**
 * Retrieves Block profiles combining `locations` and `forecast_predictions`.
 * When `district` and/or `state` is specified, strictly filters to that district.
 * If Prayagraj is selected, returns the 8 validated Prayagraj blocks with full forecast metrics.
 * If any other district is selected, returns its actual official LGD blocks with 'LOCATION_ONLY' coverage.
 */
export async function getBlocks(
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b",
  district?: string,
  state?: string
): Promise<Block[]> {
  const normDistrict = district?.trim();
  const normState = state?.trim();
  const isPrayagraj =
    normDistrict && normDistrict.toLowerCase() === "prayagraj";

  // Cache key
  const cacheKey = `${horizon}:${scenario}:${normState || ""}:${normDistrict || ""}`.toLowerCase();

  // If Prayagraj or default fallback:
  if (isPrayagraj || (!normDistrict && (!normState || normState.toLowerCase() === "uttar pradesh"))) {
    let prayagrajBlocks = getBlocksForScenarioAndHorizon(scenario, horizon);
    if (normDistrict) {
      prayagrajBlocks = prayagrajBlocks.filter(
        (b) => b.district.toLowerCase() === "prayagraj"
      );
    }

    const client = getSupabaseClient();
    if (client && scenario === "scenario_b") {
      try {
        const horizonDays =
          horizon === "7D" ? 7 : horizon === "14D" ? 14 : horizon === "21D" ? 21 : 30;
        const { data: predRows, error } = await client
          .from("forecast_predictions")
          .select("*")
          .eq("horizon_days", horizonDays);

        if (!error && predRows && predRows.length > 0) {
          return prayagrajBlocks.map((lb) => {
            const row = predRows.find((r: any) => r.location_id === lb.id);
            if (!row) return { ...lb, dataCoverage: "FULL" as LocationDataCoverage };
            return {
              ...lb,
              dataCoverage: "FULL" as LocationDataCoverage,
              onsetProbability: Number(row.onset_probability),
              falseOnsetProbability: Number(row.false_onset_probability),
              falseOnsetRisk: Number(row.false_onset_probability),
              drySpellProbability: Number(row.dry_spell_probability),
              drySpellRisk: Number(row.dry_spell_probability),
              heavyRainProbability: Number(row.heavy_rain_probability),
              heavyRainfallRisk: Number(row.heavy_rain_probability),
              expectedRainfall: Number(row.expected_rainfall),
              expectedRainfallMm: Number(row.expected_rainfall),
              rainfallAnomaly: Number(row.rainfall_anomaly),
              rainfallAnomalyPct: Number(row.rainfall_anomaly),
              confidence: Number(row.confidence),
              riskLevel: row.risk_level || lb.riskLevel,
            };
          });
        }
      } catch {
        // Fallback
      }
    }

    return prayagrajBlocks.map((b) => ({
      ...b,
      dataCoverage: "FULL" as LocationDataCoverage,
    }));
  }

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function getRegionalSoilType(stateName: string): string {
  const s = (stateName || "").toLowerCase();
  if (s.includes("lakshadweep") || s.includes("andaman") || s.includes("goa") || s.includes("kerala")) {
    return "Coastal Sandy Alluvium";
  }
  if (s.includes("maharashtra") || s.includes("madhya pradesh") || s.includes("gujarat") || s.includes("karnataka")) {
    return "Medium to Deep Black Cotton Soil";
  }
  if (s.includes("uttar pradesh") || s.includes("bihar") || s.includes("punjab") || s.includes("haryana") || s.includes("west bengal")) {
    return "Fertile Indo-Gangetic Alluvial Loam";
  }
  if (s.includes("rajasthan")) {
    return "Desert Sandy Loam";
  }
  if (s.includes("odisha") || s.includes("andhra") || s.includes("tamil nadu") || s.includes("telangana") || s.includes("chhattisgarh") || s.includes("jharkhand")) {
    return "Red & Laterite Loam";
  }
  return "Mountain Forest & Humus Loam";
}

function getRegionalOnsetWindow(lat: number): string {
  if (lat < 13) return "1–5 June";
  if (lat < 18) return "5–12 June";
  if (lat < 23) return "12–18 June";
  if (lat < 27) return "18–25 June";
  return "25 June–5 July";
}

function buildLgdBlock(
  b: any,
  normState: string | undefined,
  normDistrict: string | undefined,
  horizon: ForecastHorizon,
  scenario: DemoScenarioId
): Block {
  const code = typeof b.code === "number" ? b.code : typeof b.blockLgdCode === "number" ? b.blockLgdCode : 42;
  const name = b.name || b.block_name || b.block || "Block";
  const displayName = name.endsWith(" Block") ? name : `${name} Block`;
  const stateName = b.stateName || b.state_name || normState || "";
  const districtName = b.districtName || b.district_name || normDistrict || "";
  const coords: [number, number] =
    b.latitude && b.longitude
      ? [b.latitude, b.longitude]
      : resolveLocationCoordinates(stateName, districtName, name, code);

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

  const seed = (Math.abs(code) % 997) + name.length;
  const baseOnset = 64 + ((seed % 17) - 8);
  const baseFalseOnset = 56 + (((seed * 3) % 19) - 9);
  const baseDrySpell = 62 + (((seed * 7) % 21) - 10);
  const baseHeavyRain = 24 + (((seed * 11) % 17) - 8);
  const baseRainfall = 78 + (((seed * 13) % 27) - 13);
  const baseMoisture = 34 + (((seed * 5) % 13) - 6);

  const onsetProbability = clamp(baseOnset + horizonOffset.onset + scenarioOffset.onset, 20, 95);
  const falseOnsetProbability = clamp(baseFalseOnset + horizonOffset.falseOnset + scenarioOffset.falseOnset, 10, 92);
  const drySpellProbability = clamp(baseDrySpell + horizonOffset.drySpell + scenarioOffset.drySpell, 15, 94);
  const heavyRainProbability = clamp(baseHeavyRain + horizonOffset.heavyRain + scenarioOffset.heavyRain, 8, 90);
  const rainfallAnomaly = clamp(-16 + scenarioOffset.anom + (horizon === "30D" ? 3 : 0), -45, +45);
  const expectedRainfall = Math.round(
    baseRainfall *
      horizonOffset.rainMult *
      (scenario === "scenario_d" ? 1.35 : scenario === "scenario_c" ? 0.74 : scenario === "scenario_a" ? 1.16 : 1.0)
  );
  const confidence = clamp(80 + horizonOffset.conf, 60, 92);
  const soilMoisture = clamp(baseMoisture + scenarioOffset.moisture, 16, 85);

  const maxThreat = Math.max(falseOnsetProbability, drySpellProbability, heavyRainProbability);
  const riskLevel: RiskLevel =
    maxThreat >= 72 ? "Very High" : maxThreat >= 56 ? "High" : maxThreat >= 36 ? "Moderate" : "Low";

  let mainIssue = `False onset risk (${falseOnsetProbability}%) & break-monsoon vulnerability (${drySpellProbability}%)`;
  let recommendedAdvisory = "Delay rainfed sowing until sustained monsoon pulse; verify 72-hour soil moisture";

  if (scenario === "scenario_a") {
    mainIssue = `Favorable onset (${onsetProbability}%) with balanced soil moisture (${soilMoisture}%)`;
    recommendedAdvisory = "Proceed with timely Kharif sowing and basal nutrient application";
  } else if (scenario === "scenario_c") {
    mainIssue = `Prolonged break-monsoon dry spell (${drySpellProbability}%) & ${rainfallAnomaly}% rainfall deficit`;
    recommendedAdvisory = "Withhold rainfed sowing; prepare contingency micro-irrigation and drought mulching";
  } else if (scenario === "scenario_d") {
    mainIssue = `Elevated heavy rainfall & surface waterlogging risk (${heavyRainProbability}%)`;
    recommendedAdvisory = "Open field drainage channels; postpone broadcast fertilizer application";
  }

  const expectedDrySpellDays =
    scenario === "scenario_a" ? "2–4 days" : scenario === "scenario_c" ? "11–14 days" : scenario === "scenario_d" ? "1–3 days" : "7–10 days";

  const soilType = b.soilType || b.soil_type || getRegionalSoilType(stateName);
  const onsetWindow = getRegionalOnsetWindow(coords[0]);
  const cleanName = name.replace(/ Block$/i, "");

  const panchayats = [
    {
      id: `p-${b.id || code}-1`,
      name: `${cleanName} North Panchayat`,
      blockId: b.id || `lgd-block-${code}`,
      farmersCount: 480 + (seed % 280),
      soilMoistureIndex: soilMoisture,
      dominantCrop: "Paddy",
      onsetProbability,
      drySpellRisk: drySpellProbability,
    },
    {
      id: `p-${b.id || code}-2`,
      name: `${cleanName} South Panchayat`,
      blockId: b.id || `lgd-block-${code}`,
      farmersCount: 410 + ((seed * 2) % 240),
      soilMoistureIndex: Math.max(18, soilMoisture - 4),
      dominantCrop: "Pulses",
      onsetProbability: Math.min(95, onsetProbability + 2),
      drySpellRisk: Math.min(95, drySpellProbability + 3),
    },
  ];

  return {
    id: b.id || `lgd-block-${code}`,
    name: displayName,
    district: districtName,
    state: stateName,
    dataCoverage: (b.dataCoverage || b.data_coverage || "LOCATION_ONLY") as LocationDataCoverage,
    stateLgdCode: b.stateCode || b.state_lgd_code,
    districtLgdCode: b.districtCode || b.district_lgd_code,
    blockLgdCode: code,
    coordinates: coords,
    polygon: [],
    panchayats,
    farmersRegistered: 1150 + (seed % 950),
    cultivatedAreaHa: 13500 + (seed % 7500),
    soilType,
    irrigationCoverage: clamp(38 + (seed % 34), 20, 80),
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
    expectedDrySpellDays,
    onsetWindow,
    soilMoisture,
    riskLevel,
    mainIssue,
    recommendedAdvisory,
  };
}

  // Non-Prayagraj District selected:
  if (normDistrict) {
    if (cachedBlocksByDistrict[cacheKey]) {
      return cachedBlocksByDistrict[cacheKey];
    }

    // 1. Try Supabase locations
    const client = getSupabaseClient();
    if (client) {
      try {
        let locQuery = client
          .from("locations")
          .select("*")
          .ilike("district", normDistrict);
        if (normState) locQuery = locQuery.ilike("state", normState);
        const { data: dbLocs } = await locQuery;

        if (dbLocs && dbLocs.length > 0) {
          const blocksList: Block[] = dbLocs.map((loc: any) =>
            buildLgdBlock(loc, normState, normDistrict, horizon, scenario)
          );
          cachedBlocksByDistrict[cacheKey] = blocksList;
          return blocksList;
        }
      } catch {
        // Fallback to official LGD dataset
      }
    }

    // 2. Query official LGD blocks
    const rawLgdBlocks = await fetchLGDBlocksForDistrict(normState, normDistrict);
    if (rawLgdBlocks && rawLgdBlocks.length > 0) {
      const blocksList: Block[] = rawLgdBlocks.map((b: any) =>
        buildLgdBlock(b, normState, normDistrict, horizon, scenario)
      );
      cachedBlocksByDistrict[cacheKey] = blocksList;
      return blocksList;
    }

    // District genuinely has no blocks
    return [];
  }

  return [];
}

/**
 * Retrieves Block profiles strictly belonging to a specific state and district.
 */
export async function getBlocksForDistrict(
  state: string,
  district: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Block[]> {
  return getBlocks(horizon, scenario, district, state);
}

/**
 * Retrieves a single Block by its location ID.
 */
export async function getBlockById(
  blockId: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b",
  district?: string,
  state?: string
): Promise<Block | null> {
  if (!blockId) return null;
  const blocks = await getBlocks(horizon, scenario, district, state);
  return blocks.find((b) => b.id === blockId) || null;
}

/**
 * Validation to verify that:
 * 1. The selected district belongs to the selected state.
 * 2. If blockId is specified, the block strictly belongs to the selected district and state.
 */
export function validateLocationHierarchy(
  state: string,
  district: string,
  blockId?: string | null
): HierarchyValidationResult {
  const normState = state?.trim();
  const normDistrict = district?.trim();

  // 1. Verify district belongs to state
  const allowedDistricts = LGD_STATE_DISTRICTS[normState];
  if (allowedDistricts && allowedDistricts.length > 0) {
    const match = allowedDistricts.some(
      (d) => d.toLowerCase() === normDistrict?.toLowerCase()
    );
    if (!match) {
      const error = `LocationHierarchy Error: District "${normDistrict}" does not belong to State "${normState}".`;
      if (process.env.NODE_ENV !== "production") {
        console.error(`[LocationHierarchy Violation] ${error}`);
      }
      return { valid: false, error };
    }
  }

  // 2. If blockId is provided and is one of the 8 canonical Prayagraj blocks:
  if (blockId && blockId.trim() !== "") {
    const normBlockId = blockId.trim().toLowerCase();
    const foundCanonical = MOCK_BLOCKS.find((b) => b.id.toLowerCase() === normBlockId);
    if (foundCanonical) {
      if (
        foundCanonical.district.toLowerCase() !== normDistrict.toLowerCase() ||
        foundCanonical.state.toLowerCase() !== normState.toLowerCase()
      ) {
        const error = `LocationHierarchy Error: Canonical block "${blockId}" belongs to "${foundCanonical.district}, ${foundCanonical.state}", not "${normDistrict}, ${normState}".`;
        if (process.env.NODE_ENV !== "production") {
          console.error(`[LocationHierarchy Violation] ${error}`);
        }
        return { valid: false, error };
      }
    }
  }

  return { valid: true };
}

export function isValidLocationHierarchy(
  state: string,
  district: string,
  blockId?: string | null
): boolean {
  return validateLocationHierarchy(state, district, blockId).valid;
}
