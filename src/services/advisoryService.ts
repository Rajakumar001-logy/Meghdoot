import { getSupabaseClient } from "@/lib/supabase";
import {
  MOCK_CROPS,
  generateCropAdvisoryForSelection,
} from "@/data/mockData";
import { CropAdvisoryRow, CropRow } from "@/types/database";
import {
  Crop,
  CropAdvisory,
  DemoScenarioId,
  ForecastHorizon,
} from "@/types/monsoon";

/**
 * Retrieves crop catalog from Supabase `crops` table with fallback to `MOCK_CROPS`.
 */
export async function getCrops(): Promise<Crop[]> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client.from("crops").select("*");
      if (!error && data && data.length > 0) {
        return (data as CropRow[]).map((row) => {
          const match =
            MOCK_CROPS.find((c) => c.id === row.id) || MOCK_CROPS[0];
          return {
            ...match,
            id: row.id,
            name: row.name,
          };
        });
      }
    } catch {
      // Fallback to MOCK_CROPS
    }
  }
  return MOCK_CROPS;
}

/**
 * Retrieves crop advisory from Supabase `crop_advisories` for a given
 * `location_id`, `crop_id`, and `horizon_days`, merging with prototype rule details.
 */
export async function getCropAdvisory(
  locationId: string,
  cropId: string,
  horizon: ForecastHorizon = "14D",
  growthStage: string = "Nursery / Pre-sowing",
  scenario: DemoScenarioId = "scenario_b"
): Promise<CropAdvisory> {
  const computed = generateCropAdvisoryForSelection(
    locationId,
    cropId,
    growthStage,
    horizon,
    scenario
  );

  const horizonDays =
    horizon === "7D" ? 7 : horizon === "14D" ? 14 : horizon === "21D" ? 21 : 30;
  const client = getSupabaseClient();

  if (client && scenario === "scenario_b") {
    try {
      const { data, error } = await client
        .from("crop_advisories")
        .select("*")
        .eq("location_id", locationId)
        .eq("crop_id", cropId)
        .eq("horizon_days", horizonDays)
        .maybeSingle();

      if (!error && data) {
        const row = data as CropAdvisoryRow;
        return {
          ...computed,
          headlineAdvisory: row.advisory_text || computed.headlineAdvisory,
          confidence: Number(row.confidence) || computed.confidence,
        };
      }
    } catch {
      // Fallback to computed advisory
    }
  }

  return computed;
}
