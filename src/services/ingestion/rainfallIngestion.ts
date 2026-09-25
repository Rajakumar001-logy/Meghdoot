import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { MOCK_BLOCKS } from '@/data/mockData';
import { DataSourceStatusRow, RainfallObservationRow } from '@/types/database';
import { fetchExternalRainfallObservations } from '../providers/rainfallProvider';
import { normalizeRainfallObservation } from '../normalization/rainfallNormalizer';

const LOCAL_RAINFALL_CACHE_KEY = 'monsoonpulse_stored_rainfall_obs_v1';
const LOCAL_RAINFALL_STATUS_KEY = 'monsoonpulse_rainfall_source_status_v1';

export interface RainfallSyncResult {
  liveFetchSucceeded: boolean;
  usedStoredFallback: boolean;
  latestObservation: RainfallObservationRow | null;
  history: RainfallObservationRow[];
  status: DataSourceStatusRow;
}

function getLocalRainfallCache(blockId: string): RainfallObservationRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_RAINFALL_CACHE_KEY);
    if (!raw) return [];
    const map = JSON.parse(raw) as Record<string, RainfallObservationRow[]>;
    return map[blockId] || [];
  } catch {
    return [];
  }
}

function setLocalRainfallCache(blockId: string, rows: RainfallObservationRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(LOCAL_RAINFALL_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, RainfallObservationRow[]>) : {};
    map[blockId] = rows;
    window.localStorage.setItem(LOCAL_RAINFALL_CACHE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function getStoredRainfallSourceStatus(): DataSourceStatusRow {
  const defaultStatus: DataSourceStatusRow = {
    id: 'src-rainfall-nasa-power',
    source_name: 'Rainfall Data',
    provider: 'NASA POWER Agroclimatology / Open-Meteo Precipitation',
    status: 'healthy',
    last_successful_fetch: null,
    last_attempted_fetch: null,
    error_message: null,
  };
  if (typeof window === 'undefined') return defaultStatus;
  try {
    const raw = window.localStorage.getItem(LOCAL_RAINFALL_STATUS_KEY);
    return raw ? (JSON.parse(raw) as DataSourceStatusRow) : defaultStatus;
  } catch {
    return defaultStatus;
  }
}

function saveRainfallSourceStatus(status: DataSourceStatusRow): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_RAINFALL_STATUS_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }
}

/**
 * Scheduler-ready Rainfall Ingestion Service
 * Fetches NASA POWER / Open-Meteo daily rainfall observations (mm/day),
 * validates & normalizes quality flags, and stores in Supabase `rainfall_observations`.
 */
export async function syncRainfallData(
  blockId: string,
  simulateOffline = false
): Promise<RainfallSyncResult> {
  const block = MOCK_BLOCKS.find((b) => b.id === blockId) || MOCK_BLOCKS[0];
  const [lat, lon] = block ? block.coordinates : [25.28, 81.94];
  const normalDailyMm = block ? Number((block.expectedRainfallMm / 14).toFixed(1)) : 8.5;
  const nowIso = new Date().toISOString();
  const prevStatus = getStoredRainfallSourceStatus();

  const providerResult = await fetchExternalRainfallObservations(
    blockId,
    lat,
    lon,
    normalDailyMm,
    simulateOffline
  );
  const client = getSupabaseClient();

  if (providerResult.success && providerResult.latest) {
    const normalizedHistory = (providerResult.history || [providerResult.latest]).map((item) =>
      normalizeRainfallObservation(item)
    );
    const latestNormalized =
      normalizedHistory[normalizedHistory.length - 1] ||
      normalizeRainfallObservation(providerResult.latest);

    setLocalRainfallCache(blockId, normalizedHistory);

    const updatedStatus: DataSourceStatusRow = {
      id: 'src-rainfall-nasa-power',
      source_name: 'Rainfall Data',
      provider: providerResult.providerName,
      status: 'healthy',
      last_successful_fetch: nowIso,
      last_attempted_fetch: nowIso,
      error_message: null,
    };
    saveRainfallSourceStatus(updatedStatus);

    if (isSupabaseConfigured() && client) {
      try {
        await client
          .from('rainfall_observations')
          .upsert(normalizedHistory, { onConflict: 'location_id,observation_date' });
        await client.from('data_source_status').upsert(updatedStatus, {
          onConflict: 'source_name',
        });
      } catch {
        // Non-fatal if migration not run yet
      }
    }

    return {
      liveFetchSucceeded: true,
      usedStoredFallback: false,
      latestObservation: latestNormalized,
      history: normalizedHistory,
      status: updatedStatus,
    };
  }

  // Fallback to Supabase `rainfall_observations` or local cache
  let storedHistory: RainfallObservationRow[] = [];
  if (isSupabaseConfigured() && client) {
    try {
      const { data } = await client
        .from('rainfall_observations')
        .select('*')
        .eq('location_id', blockId)
        .order('observation_date', { ascending: true })
        .limit(15);
      if (data && data.length > 0) {
        storedHistory = data as RainfallObservationRow[];
      }
    } catch {
      // ignore
    }
  }

  if (storedHistory.length === 0) {
    storedHistory = getLocalRainfallCache(blockId);
  }

  const latestStored = storedHistory.length > 0 ? storedHistory[storedHistory.length - 1] : null;
  const fallbackStatus: DataSourceStatusRow = {
    id: 'src-rainfall-nasa-power',
    source_name: 'Rainfall Data',
    provider: providerResult.providerName,
    status: latestStored ? 'degraded' : 'offline',
    last_successful_fetch: prevStatus.last_successful_fetch,
    last_attempted_fetch: nowIso,
    error_message: providerResult.error || 'External rainfall API unreachable',
  };
  saveRainfallSourceStatus(fallbackStatus);

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
    usedStoredFallback: Boolean(latestStored),
    latestObservation: latestStored,
    history: storedHistory,
    status: fallbackStatus,
  };
}
