import { getSupabaseClient } from "@/lib/supabase";
import { getClimateIndicesForScenario } from "@/data/mockData";
import { ClimateIndexRow } from "@/types/database";
import { ClimateIndex, DemoScenarioId } from "@/types/monsoon";

/**
 * Retrieves climate teleconnection indices from Supabase `climate_indices` table,
 * falling back to `getClimateIndicesForScenario()`.
 */
export async function getClimateIndices(
  scenario: DemoScenarioId = "scenario_b"
): Promise<ClimateIndex[]> {
  const baseIndices = getClimateIndicesForScenario(scenario);
  const client = getSupabaseClient();

  if (client && scenario === "scenario_b") {
    try {
      const { data, error } = await client
        .from("climate_indices")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const row = data as ClimateIndexRow;
        return baseIndices.map((item) => {
          if (item.id === "ENSO") {
            return {
              ...item,
              currentPhase: row.enso_phase,
              indexValue: `${row.enso_index} °C`,
            };
          }
          if (item.id === "IOD") {
            return {
              ...item,
              currentPhase: row.iod_phase,
              indexValue: `+${row.iod_index} °C`,
            };
          }
          return {
            ...item,
            currentPhase: row.mjo_phase,
            amplitude: Number(row.mjo_amplitude),
          };
        });
      }
    } catch {
      // Fallback to baseIndices
    }
  }

  return baseIndices;
}
