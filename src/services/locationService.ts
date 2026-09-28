import { getSupabaseClient } from "@/lib/supabase";
import {
  MOCK_BLOCKS,
  getBlocksForScenarioAndHorizon,
} from "@/data/mockData";
import { LocationRow, LocationDataCoverage } from "@/types/database";
import { Block, DemoScenarioId, ForecastHorizon } from "@/types/monsoon";
import statesData from "@/data/lgd/states.json";
import districtsData from "@/data/lgd/districts.json";

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
          const blocksList: Block[] = dbLocs.map((loc: any) => ({
            id: loc.id,
            name: loc.block_name || (loc.block.endsWith(" Block") ? loc.block : `${loc.block} Block`),
            district: loc.district_name || loc.district,
            state: loc.state_name || loc.state,
            dataCoverage: (loc.data_coverage || "LOCATION_ONLY") as LocationDataCoverage,
            stateLgdCode: loc.state_lgd_code,
            districtLgdCode: loc.district_lgd_code,
            blockLgdCode: loc.block_lgd_code,
            coordinates: [loc.latitude || 23.0, loc.longitude || 80.0],
            polygon: [],
            panchayats: [],
            farmersRegistered: 0,
            cultivatedAreaHa: 0,
            soilType: loc.soil_type || "Undetermined",
            irrigationCoverage: 0,
            onsetProbability: 0,
            falseOnsetProbability: 0,
            falseOnsetRisk: 0,
            drySpellProbability: 0,
            drySpellRisk: 0,
            heavyRainProbability: 0,
            heavyRainfallRisk: 0,
            rainfallAnomaly: 0,
            rainfallAnomalyPct: 0,
            expectedRainfall: 0,
            expectedRainfallMm: 0,
            confidence: 0,
            expectedDrySpellDays: "N/A",
            onsetWindow: "N/A",
            soilMoisture: 0,
            riskLevel: "Low",
            mainIssue: "AI forecast unavailable for this location",
            recommendedAdvisory: "AI forecast unavailable for this location",
          }));
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
      const blocksList: Block[] = rawLgdBlocks.map((b: any) => ({
        id: b.id || `lgd-block-${b.code}`,
        name: b.name.endsWith(" Block") ? b.name : `${b.name} Block`,
        district: b.districtName || normDistrict,
        state: b.stateName || normState || "",
        dataCoverage: (b.dataCoverage || "LOCATION_ONLY") as LocationDataCoverage,
        stateLgdCode: b.stateCode,
        districtLgdCode: b.districtCode,
        blockLgdCode: b.code,
        coordinates: [b.latitude || 23.0, b.longitude || 80.0],
        polygon: [],
        panchayats: [],
        farmersRegistered: 0,
        cultivatedAreaHa: 0,
        soilType: b.soilType || "Undetermined",
        irrigationCoverage: 0,
        onsetProbability: 0,
        falseOnsetProbability: 0,
        falseOnsetRisk: 0,
        drySpellProbability: 0,
        drySpellRisk: 0,
        heavyRainProbability: 0,
        heavyRainfallRisk: 0,
        rainfallAnomaly: 0,
        rainfallAnomalyPct: 0,
        expectedRainfall: 0,
        expectedRainfallMm: 0,
        confidence: 0,
        expectedDrySpellDays: "N/A",
        onsetWindow: "N/A",
        soilMoisture: 0,
        riskLevel: "Low",
        mainIssue: "AI forecast unavailable for this location",
        recommendedAdvisory: "AI forecast unavailable for this location",
      }));
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
