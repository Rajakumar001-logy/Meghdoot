import { RawRainfallInput } from '../normalization/rainfallNormalizer';

export interface RainfallProviderResult {
  success: boolean;
  providerName: string;
  latest?: RawRainfallInput;
  history?: RawRainfallInput[];
  error?: string;
}

/**
 * External Rainfall Observation Provider (NASA POWER Agroclimatology + Open-Meteo Precipitation)
 * Fetches real daily rainfall observations (mm/day) for the given block coordinates.
 */
export async function fetchExternalRainfallObservations(
  blockId: string,
  latitude: number,
  longitude: number,
  normalDailyRainfallMm = 8.5,
  simulateOffline = false
): Promise<RainfallProviderResult> {
  const providerName = 'NASA POWER Agroclimatology / Open-Meteo Precipitation';

  if (simulateOffline) {
    return {
      success: false,
      providerName,
      error: 'Simulated external rainfall API outage (Offline test mode enabled)',
    };
  }

  try {
    const res = await fetch(
      `/api/ingest?type=rainfall&blockId=${encodeURIComponent(blockId)}&lat=${latitude}&lon=${longitude}&simulateOffline=${simulateOffline}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status} from rainfall provider`);
    }

    const json = await res.json();
    if (!json.ok || !json.rainfall) {
      throw new Error(json.error || 'Missing rainfall payload from external provider');
    }

    const rawHistory: Array<{ observation_date: string; rainfall_mm: number | null; source: string }> =
      Array.isArray(json.rainfall.history) ? json.rainfall.history : [];

    const history: RawRainfallInput[] = rawHistory.map((item) => ({
      location_id: blockId,
      observation_date: item.observation_date,
      rainfall_mm: item.rainfall_mm,
      normal_rainfall_mm: normalDailyRainfallMm,
      source: item.source || providerName,
    }));

    const latestRaw = json.rainfall.latest || rawHistory[rawHistory.length - 1];
    const latest: RawRainfallInput = {
      location_id: blockId,
      observation_date: latestRaw?.observation_date || new Date().toISOString().slice(0, 10),
      rainfall_mm: latestRaw?.rainfall_mm ?? null,
      normal_rainfall_mm: normalDailyRainfallMm,
      source: latestRaw?.source || providerName,
    };

    return {
      success: true,
      providerName: latest.source || providerName,
      latest,
      history,
    };
  } catch (err) {
    return {
      success: false,
      providerName,
      error: err instanceof Error ? err.message : 'Failed to fetch external rainfall data',
    };
  }
}
