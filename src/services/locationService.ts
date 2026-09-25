import { getSupabaseClient } from "@/lib/supabase";
import {
  MOCK_BLOCKS,
  getBlocksForScenarioAndHorizon,
} from "@/data/mockData";
import { LocationRow } from "@/types/database";
import { Block, DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

/**
 * Retrieves all location records from Supabase `locations` table.
 * Falls back seamlessly to centralized Demo Data Engine if Supabase is unavailable.
 */
export async function getLocations(): Promise<LocationRow[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("locations")
        .select("*")
        .order("block", { ascending: true });
      if (!error && data && data.length > 0) {
        return data as LocationRow[];
      }
    } catch {
      // Fallback to local demo dataset below
    }
  }

  return MOCK_BLOCKS.map((b) => ({
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
 * Retrieves all 8 Prayagraj Block profiles combining `locations` and `forecast_predictions`.
 */
export async function getBlocks(
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Block[]> {
  const horizonDays =
    horizon === "7D" ? 7 : horizon === "14D" ? 14 : horizon === "21D" ? 21 : 30;
  const localBlocks = getBlocksForScenarioAndHorizon(scenario, horizon);
  const client = getSupabaseClient();

  if (client && scenario === "scenario_b") {
    try {
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
 * Retrieves a single Block by its location ID (`karchhana`, `phulpur`, `meja`, etc.).
 */
export async function getBlockById(
  blockId: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Block> {
  const blocks = await getBlocks(horizon, scenario);
  return blocks.find((b) => b.id === blockId) || blocks[0];
}
