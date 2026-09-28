import { getSupabaseClient } from "@/lib/supabase";
import {
  MOCK_BLOCKS,
  STATE_DISTRICTS,
  getBlocksForScenarioAndHorizon,
} from "@/data/mockData";
import { LocationRow } from "@/types/database";
import { Block, DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

export interface HierarchyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Retrieves list of available states.
 * Connects to Supabase `locations` if configured, merged with hierarchical fallback registry.
 */
export async function getStates(): Promise<string[]> {
  const fallbackStates = Object.keys(STATE_DISTRICTS);
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from("locations").select("state");
      if (!error && data && data.length > 0) {
        const dbStates = Array.from(
          new Set(data.map((r: any) => r.state).filter(Boolean))
        ) as string[];
        return Array.from(new Set([...fallbackStates, ...dbStates]));
      }
    } catch {
      // Fallback
    }
  }
  return fallbackStates;
}

/**
 * Retrieves list of available districts for a given state.
 * Strictly verifies state relationship.
 */
export async function getDistrictsForState(state: string): Promise<string[]> {
  const normalizedState = state?.trim();
  const fallbackDistricts = STATE_DISTRICTS[normalizedState] || [];
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("locations")
        .select("district")
        .ilike("state", normalizedState);
      if (!error && data && data.length > 0) {
        const dbDistricts = Array.from(
          new Set(data.map((r: any) => r.district).filter(Boolean))
        ) as string[];
        return Array.from(new Set([...fallbackDistricts, ...dbDistricts]));
      }
    } catch {
      // Fallback
    }
  }
  return fallbackDistricts;
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
      // Fallback to local demo dataset below
    }
  }

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
    created_at: "2026-06-12T06:00:00Z",
  }));
}

/**
 * Retrieves Block profiles combining `locations` and `forecast_predictions`.
 * When `district` and/or `state` is specified, strictly filters to that district.
 * If the district has no blocks in the database or fallback, returns an empty array [].
 */
export async function getBlocks(
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b",
  district?: string,
  state?: string
): Promise<Block[]> {
  const horizonDays =
    horizon === "7D" ? 7 : horizon === "14D" ? 14 : horizon === "21D" ? 21 : 30;

  // Base scenario blocks
  let localBlocks = getBlocksForScenarioAndHorizon(scenario, horizon);

  // If district/state is specified, strictly filter localBlocks
  if (state) {
    localBlocks = localBlocks.filter(
      (b) => b.state.toLowerCase() === state.trim().toLowerCase()
    );
  }
  if (district) {
    localBlocks = localBlocks.filter(
      (b) => b.district.toLowerCase() === district.trim().toLowerCase()
    );
  }

  const client = getSupabaseClient();
  if (client && scenario === "scenario_b") {
    try {
      let locQuery = client.from("locations").select("*");
      if (state) locQuery = locQuery.ilike("state", state.trim());
      if (district) locQuery = locQuery.ilike("district", district.trim());
      const { data: dbLocs } = await locQuery;

      // If we filtered by district and DB returned empty array, return []
      if (district && dbLocs && dbLocs.length === 0) {
        return [];
      }

      const { data: predRows, error } = await client
        .from("forecast_predictions")
        .select("*")
        .eq("horizon_days", horizonDays);

      if (!error && predRows && predRows.length > 0) {
        return localBlocks.map((lb) => {
          const row = predRows.find((r: any) => r.location_id === lb.id);
          if (!row) return lb;
          return {
            ...lb,
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
      // Fallback to localBlocks
    }
  }

  return localBlocks;
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
 * Retrieves a single Block by its location ID (`karchhana`, `phulpur`, `meja`, etc.).
 */
export async function getBlockById(
  blockId: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Block | null> {
  if (!blockId) return null;
  const blocks = await getBlocks(horizon, scenario);
  return blocks.find((b) => b.id === blockId) || null;
}

/**
 * Development-time validation to verify that:
 * 1. The selected district belongs to the selected state.
 * 2. If blockId is specified, the block strictly belongs to the selected district and state.
 * Logs an error in development if an invalid combination is detected.
 */
export function validateLocationHierarchy(
  state: string,
  district: string,
  blockId?: string | null
): HierarchyValidationResult {
  const normState = state?.trim();
  const normDistrict = district?.trim();

  // 1. Verify district belongs to state
  const allowedDistricts = STATE_DISTRICTS[normState];
  if (allowedDistricts && !allowedDistricts.includes(normDistrict)) {
    const error = `LocationHierarchy Error: District "${normDistrict}" does not belong to State "${normState}". Allowed: [${allowedDistricts.join(", ")}].`;
    if (process.env.NODE_ENV !== "production") {
      console.error(`[LocationHierarchy Violation] ${error}`);
    }
    return { valid: false, error };
  }

  // 2. If blockId is provided, verify block belongs to district and state
  if (blockId && blockId.trim() !== "") {
    const normBlockId = blockId.trim().toLowerCase();
    const foundBlock = MOCK_BLOCKS.find((b) => b.id.toLowerCase() === normBlockId);
    if (foundBlock) {
      if (
        foundBlock.district.toLowerCase() !== normDistrict.toLowerCase() ||
        foundBlock.state.toLowerCase() !== normState.toLowerCase()
      ) {
        const error = `LocationHierarchy Error: Block "${blockId}" belongs to "${foundBlock.district}, ${foundBlock.state}", not "${normDistrict}, ${normState}".`;
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
