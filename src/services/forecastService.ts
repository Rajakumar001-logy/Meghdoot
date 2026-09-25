import { getSupabaseClient } from "@/lib/supabase";
import {
  buildForecastForBlock,
  getBlocksForScenarioAndHorizon,
} from "@/data/mockData";
import { ForecastPredictionRow } from "@/types/database";
import { DemoScenarioId, Forecast, ForecastHorizon } from "@/types/monsoon";
import { getRainfallForecast } from "./rainfallService";

export function horizonToDays(horizon: ForecastHorizon): 7 | 14 | 21 | 30 {
  if (horizon === "7D") return 7;
  if (horizon === "14D") return 14;
  if (horizon === "21D") return 21;
  return 30;
}

export function daysToHorizon(days: number): ForecastHorizon {
  if (days === 7) return "7D";
  if (days === 14) return "14D";
  if (days === 21) return "21D";
  return "30D";
}

/**
 * Retrieves forecast prediction from Supabase `forecast_predictions` + `rainfall_forecasts`
 * for a given `location_id` and `horizon_days`, falling back to the local Demo Data Engine.
 */
export async function getForecast(
  locationId: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Forecast> {
  const baseForecast = buildForecastForBlock(locationId, horizon, scenario);
  const horizonDays = horizonToDays(horizon);
  const client = getSupabaseClient();

  if (client && scenario === "scenario_b") {
    try {
      const { data: row, error } = await client
        .from("forecast_predictions")
        .select("*")
        .eq("location_id", locationId)
        .eq("horizon_days", horizonDays)
        .maybeSingle();

      const series = await getRainfallForecast(locationId, horizonDays, scenario);

      if (!error && row) {
        const typed = row as ForecastPredictionRow;
        return {
          ...baseForecast,
          onsetProbability: Number(typed.onset_probability),
          falseOnsetRisk: Number(typed.false_onset_probability),
          falseOnsetWarningProbability: Number(typed.false_onset_probability),
          breakMonsoonRisk: Number(typed.dry_spell_probability),
          heavyRainfallRisk: Number(typed.heavy_rain_probability),
          expectedRainfallMm: Number(typed.expected_rainfall),
          rainfallAnomalyPct: Number(typed.rainfall_anomaly),
          confidence: Number(typed.confidence),
          dailySeries: series,
        };
      }
    } catch {
      // Fallback to local baseForecast
    }
  }

  return baseForecast;
}

/**
 * Retrieves forecast by Block ID (`karchhana`, `phulpur`, `meja`, etc.).
 */
export async function getForecastByBlock(
  blockId: string,
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Forecast> {
  return getForecast(blockId, horizon, scenario);
}

/**
 * Retrieves all block forecast predictions for a specific horizon (7, 14, 21, or 30 days).
 */
export async function getForecastByHorizon(
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<ForecastPredictionRow[]> {
  const horizonDays = horizonToDays(horizon);
  const client = getSupabaseClient();

  if (client && scenario === "scenario_b") {
    try {
      const { data, error } = await client
        .from("forecast_predictions")
        .select("*")
        .eq("horizon_days", horizonDays);

      if (!error && data && data.length > 0) {
        return data as ForecastPredictionRow[];
      }
    } catch {
      // Fallback below
    }
  }

  const blocks = getBlocksForScenarioAndHorizon(scenario, horizon);
  return blocks.map((b) => ({
    id: `fp-${b.id}-${horizonDays}`,
    location_id: b.id,
    forecast_date: "2026-06-12",
    horizon_days: horizonDays,
    onset_probability: b.onsetProbability,
    false_onset_probability: b.falseOnsetProbability,
    dry_spell_probability: b.drySpellProbability,
    heavy_rain_probability: b.heavyRainProbability,
    expected_rainfall: b.expectedRainfall,
    rainfall_anomaly: b.rainfallAnomaly,
    confidence: b.confidence,
    risk_level: b.riskLevel,
    created_at: "2026-06-12T06:00:00Z",
  }));
}
