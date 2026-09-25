import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_BLOCKS } from '@/data/mockData';
import { DataSourceStatusRow, WeatherObservationRow } from '@/types/database';
import { fetchExternalWeatherObservation } from '../providers/weatherProvider';
import { normalizeWeatherObservation } from '../normalization/weatherNormalizer';

const LOCAL_WEATHER_CACHE_KEY = 'monsoonpulse_stored_weather_obs_v1';
const LOCAL_WEATHER_STATUS_KEY = 'monsoonpulse_weather_source_status_v1';

export interface WeatherSyncResult {
  liveFetchSucceeded: boolean;
  usedStoredFallback: boolean;
  observation: WeatherObservationRow | null;
  status: DataSourceStatusRow;
}

function getLocalWeatherCache(blockId: string): WeatherObservationRow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_WEATHER_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, WeatherObservationRow>;
    return map[blockId] || null;
  } catch {
    return null;
  }
}

function setLocalWeatherCache(blockId: string, obs: WeatherObservationRow): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(LOCAL_WEATHER_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, WeatherObservationRow>) : {};
    map[blockId] = obs;
    window.localStorage.setItem(LOCAL_WEATHER_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export function getStoredWeatherSourceStatus(): DataSourceStatusRow {
  const defaultStatus: DataSourceStatusRow = {
    id: 'src-weather-open-meteo',
    source_name: 'Weather Data',
    provider: 'Open-Meteo Weather & ERA5 Reanalysis API',
    status: 'healthy',
    last_successful_fetch: null,
    last_attempted_fetch: null,
    error_message: null,
  };
  if (typeof window === 'undefined') return defaultStatus;
  try {
    const raw = window.localStorage.getItem(LOCAL_WEATHER_STATUS_KEY);
    return raw ? (JSON.parse(raw) as DataSourceStatusRow) : defaultStatus;
  } catch {
    return defaultStatus;
  }
}

function saveWeatherSourceStatus(status: DataSourceStatusRow): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_WEATHER_STATUS_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }
}

/**
 * Scheduler-ready Weather Ingestion Service
 * 1. Fetches real weather observations from Open-Meteo for the block's coordinates
 * 2. Normalizes & validates values + quality_flag
 * 3. Upserts into Supabase `weather_observations` and `data_source_status`
 * 4. If external API fails, falls back to the latest stored Supabase/cached observation
 */
export async function syncWeatherData(
  blockId: string,
  simulateOffline = false
): Promise<WeatherSyncResult> {
  const block = MOCK_BLOCKS.find((b) => b.id === blockId) || MOCK_BLOCKS[0];
  const [lat, lon] = block ? block.coordinates : [25.28, 81.94];
  const nowIso = new Date().toISOString();
  const prevStatus = getStoredWeatherSourceStatus();

  const providerResult = await fetchExternalWeatherObservation(blockId, lat, lon, simulateOffline);
  const client = getSupabaseClient();

  if (providerResult.success && providerResult.data) {
    const normalized = normalizeWeatherObservation(providerResult.data);
    setLocalWeatherCache(blockId, normalized);

    const updatedStatus: DataSourceStatusRow = {
      id: 'src-weather-open-meteo',
      source_name: 'Weather Data',
      provider: providerResult.providerName,
      status: 'healthy',
      last_successful_fetch: nowIso,
      last_attempted_fetch: nowIso,
      error_message: null,
    };
    saveWeatherSourceStatus(updatedStatus);

    // Persist to Supabase if configured
    if (isSupabaseConfigured() && client) {
      try {
        await client.from('weather_observations').upsert(
          {
            id: normalized.id,
            location_id: normalized.location_id,
            observation_date: normalized.observation_date,
            precipitation_mm: normalized.precipitation_mm,
            temperature_c: normalized.temperature_c,
            humidity: normalized.humidity,
            pressure: normalized.pressure,
            wind_speed: normalized.wind_speed,
            source: normalized.source,
            quality_flag: normalized.quality_flag,
            created_at: normalized.created_at,
          },
          { onConflict: 'location_id,observation_date' }
        );

        await client.from('data_source_status').upsert(updatedStatus, {
          onConflict: 'source_name',
        });
      } catch {
        // Non-fatal if Supabase table migration hasn't been applied yet
      }
    }

    return {
      liveFetchSucceeded: true,
      usedStoredFallback: false,
      observation: normalized,
      status: updatedStatus,
    };
  }

  // External fetch failed -> try to retrieve latest stored observation from Supabase first, then local cache
  let storedObs: WeatherObservationRow | null = null;
  if (isSupabaseConfigured() && client) {
    try {
      const { data } = await client
        .from('weather_observations')
        .select('*')
        .eq('location_id', blockId)
        .order('observation_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        storedObs = data as WeatherObservationRow;
      }
    } catch {
      // ignore and fall back to local cache
    }
  }

  if (!storedObs) {
    storedObs = getLocalWeatherCache(blockId);
  }

  const fallbackStatus: DataSourceStatusRow = {
    id: 'src-weather-open-meteo',
    source_name: 'Weather Data',
    provider: providerResult.providerName,
    status: storedObs ? 'degraded' : 'offline',
    last_successful_fetch: prevStatus.last_successful_fetch,
    last_attempted_fetch: nowIso,
    error_message: providerResult.error || 'External weather API unreachable',
  };
  saveWeatherSourceStatus(fallbackStatus);

  if (isSupabaseConfigured() && client) {
    try {
      await client.from('data_source_status').upsert(fallbackStatus, {
        onConflict: 'source_name',
      });
    } catch {
      // ignore
    }
  }

  return {
    liveFetchSucceeded: false,
    usedStoredFallback: Boolean(storedObs),
    observation: storedObs,
    status: fallbackStatus,
  };
}
