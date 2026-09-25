import { getSupabaseClient } from "@/lib/supabase";
import { buildForecastForBlock } from "@/data/mockData";
import { RainfallForecastRow } from "@/types/database";
import {
  DailyForecastPoint,
  DemoScenarioId,
  ForecastHorizon,
} from "@/types/monsoon";

/**
 * Retrieves daily rainfall forecast records from Supabase `rainfall_forecasts`
 * based on `location_id` and `horizon_days` (7, 14, 21, or 30 days).
 * Includes predicted_rainfall, historical_average, p10, and p90.
 */
export async function getRainfallForecast(
  locationId: string,
  horizonDays: number = 14,
  scenario: DemoScenarioId = "scenario_b"
): Promise<DailyForecastPoint[]> {
  const horizon: ForecastHorizon =
    horizonDays === 7
      ? "7D"
      : horizonDays === 14
      ? "14D"
      : horizonDays === 21
      ? "21D"
      : "30D";

  const localSeries = buildForecastForBlock(
    locationId,
    horizon,
    scenario
  ).dailySeries;

  const client = getSupabaseClient();
  if (client && scenario === "scenario_b") {
    try {
      const { data, error } = await client
        .from("rainfall_forecasts")
        .select("*")
        .eq("location_id", locationId)
        .lte("horizon_days", horizonDays)
        .order("forecast_date", { ascending: true })
        .limit(horizonDays);

      if (!error && data && data.length > 0) {
        return (data as RainfallForecastRow[]).map((row, idx) => {
          const fallbackPoint = localSeries[idx] || localSeries[0];
          const pred = Number(row.predicted_rainfall);
          const avg = Number(row.historical_average);
          const p10 = Number(row.p10);
          const p90 = Number(row.p90);
          return {
            dayIndex: idx + 1,
            dateLabel: fallbackPoint?.dateLabel || row.forecast_date.slice(5),
            isoDate: row.forecast_date,
            predictedMm: pred,
            historicalAvgMm: avg,
            uncertaintyLowMm: p10,
            uncertaintyHighMm: p90,
            uncertaintyBand: [p10, p90],
            phaseLabel: fallbackPoint?.phaseLabel || "Active Monsoon",
            falseOnsetFlag: fallbackPoint?.falseOnsetFlag,
          };
        });
      }
    } catch {
      // Fallback to localSeries
    }
  }

  return localSeries;
}
