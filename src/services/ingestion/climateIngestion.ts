import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { ClimateIndexObservationRow, DataSourceStatusRow } from '@/types/database';
import { fetchExternalClimateSignals } from '../providers/climateProvider';
import { normalizeClimateObservation } from '../normalization/climateNormalizer';

const LOCAL_CLIMATE_CACHE_KEY = 'monsoonpulse_stored_climate_obs_v1';
const LOCAL_CLIMATE_STATUS_KEY = 'monsoonpulse_climate_source_status_v1';

export interface ClimateSyncResult {
  liveFetchSucceeded: boolean;
  usedStoredFallback: boolean;
  observations: ClimateIndexObservationRow[];
  status: DataSourceStatusRow;
}

function getLocalClimateCache(): ClimateIndexObservationRow[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_CLIMATE_CACHE_KEY);
    return raw ? (JSON.parse(raw) as ClimateIndexObservationRow[]) : [];
  } catch {
    return [];
  }
}

function setLocalClimateCache(rows: ClimateIndexObservationRow[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CLIMATE_CACHE_KEY, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

export function getStoredClimateSourceStatus(): DataSourceStatusRow {
  const defaultStatus: DataSourceStatusRow = {
    id: 'src-climate-noaa-cpc',
    source_name: 'Climate Data',
    provider: 'NOAA CPC Oceanic Niño Index & Marine SST Dipole',
    status: 'healthy',
    last_successful_fetch: null,
    last_attempted_fetch: null,
    error_message: null,
  };
  if (typeof window === 'undefined') return defaultStatus;
  try {
    const raw = window.localStorage.getItem(LOCAL_CLIMATE_STATUS_KEY);
    return raw ? (JSON.parse(raw) as DataSourceStatusRow) : defaultStatus;
  } catch {
    return defaultStatus;
  }
}

function saveClimateSourceStatus(status: DataSourceStatusRow): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LOCAL_CLIMATE_STATUS_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }
}

/**
 * Scheduler-ready Global Climate Index Ingestion Service
 * Fetches ENSO (ONI), IOD (DMI), and MJO observations, normalizes & classifies phase,
 * and stores in Supabase `climate_index_observations`.
 */
export async function syncClimateIndices(simulateOffline = false): Promise<ClimateSyncResult> {
  const nowIso = new Date().toISOString();
  const prevStatus = getStoredClimateSourceStatus();
  const providerResult = await fetchExternalClimateSignals(simulateOffline);
  const client = getSupabaseClient();

  if (providerResult.success && providerResult.signals && providerResult.signals.length > 0) {
    const normalized = providerResult.signals.map((sig) => normalizeClimateObservation(sig));
    setLocalClimateCache(normalized);

    const updatedStatus: DataSourceStatusRow = {
      id: 'src-climate-noaa-cpc',
      source_name: 'Climate Data',
      provider: providerResult.providerName,
      status: 'healthy',
      last_successful_fetch: nowIso,
      last_attempted_fetch: nowIso,
      error_message: null,
    };
    saveClimateSourceStatus(updatedStatus);

    if (isSupabaseConfigured() && client) {
      try {
        await client
          .from('climate_index_observations')
          .upsert(normalized, { onConflict: 'index_name,observation_date' });
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
      observations: normalized,
      status: updatedStatus,
    };
  }

  // Fallback to Supabase `climate_index_observations` or local cache
  let storedObs: ClimateIndexObservationRow[] = [];
  if (isSupabaseConfigured() && client) {
    try {
      const { data } = await client
        .from('climate_index_observations')
        .select('*')
        .order('observation_date', { ascending: false })
        .limit(3);
      if (data && data.length > 0) {
        storedObs = data as ClimateIndexObservationRow[];
      }
    } catch {
      // ignore
    }
  }

  if (storedObs.length === 0) {
    storedObs = getLocalClimateCache();
  }

  const fallbackStatus: DataSourceStatusRow = {
    id: 'src-climate-noaa-cpc',
    source_name: 'Climate Data',
    provider: providerResult.providerName,
    status: storedObs.length > 0 ? 'degraded' : 'offline',
    last_successful_fetch: prevStatus.last_successful_fetch,
    last_attempted_fetch: nowIso,
    error_message: providerResult.error || 'External climate index API unreachable',
  };
  saveClimateSourceStatus(fallbackStatus);

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
    usedStoredFallback: storedObs.length > 0,
    observations: storedObs,
    status: fallbackStatus,
  };
}
