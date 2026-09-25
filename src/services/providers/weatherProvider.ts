import { RawWeatherInput } from '../normalization/weatherNormalizer';

export interface WeatherProviderResult {
  success: boolean;
  providerName: string;
  data?: RawWeatherInput;
  error?: string;
}

/**
 * External Weather Observation Provider (Open-Meteo Weather & ERA5 Reanalysis API)
 * Fetches real block-coordinate observations via the server-side ingestion proxy
 * (or directly from Open-Meteo if executed server-side).
 */
export async function fetchExternalWeatherObservation(
  blockId: string,
  latitude: number,
  longitude: number,
  simulateOffline = false
): Promise<WeatherProviderResult> {
  const providerName = 'Open-Meteo Weather & ERA5 Reanalysis API';

  if (simulateOffline) {
    return {
      success: false,
      providerName,
      error: 'Simulated external weather API outage (Offline test mode enabled)',
    };
  }

  try {
    const res = await fetch(
      `/api/ingest?type=weather&blockId=${encodeURIComponent(blockId)}&lat=${latitude}&lon=${longitude}&simulateOffline=${simulateOffline}`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status} from weather ingestion endpoint`);
    }

    const json = await res.json();
    if (!json.ok || !json.weather) {
      throw new Error(json.error || 'Missing weather payload from Open-Meteo provider');
    }

    return {
      success: true,
      providerName: json.weather.source || providerName,
      data: {
        location_id: blockId,
        observation_date: json.weather.observation_date,
        temperature_c: json.weather.temperature_c,
        humidity_pct: json.weather.humidity_pct,
        pressure_hpa: json.weather.pressure_hpa,
        wind_speed_kmh: json.weather.wind_speed_kmh,
        rainfall_mm: json.weather.rainfall_mm,
        source: json.weather.source || providerName,
      },
    };
  } catch (err) {
    return {
      success: false,
      providerName,
      error: err instanceof Error ? err.message : 'Network error connecting to Open-Meteo',
    };
  }
}
