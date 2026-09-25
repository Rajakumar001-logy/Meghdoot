import { RawClimateSignalInput } from '../normalization/climateNormalizer';

export interface ClimateProviderResult {
  success: boolean;
  providerName: string;
  signals?: RawClimateSignalInput[];
  error?: string;
}

/**
 * External Global Climate Signal Provider (NOAA CPC ONI + Open-Meteo Marine IOD + BOM/NOAA MJO)
 * Fetches real global teleconnection indices (ENSO, IOD, MJO).
 */
export async function fetchExternalClimateSignals(
  simulateOffline = false
): Promise<ClimateProviderResult> {
  const providerName = 'NOAA CPC Oceanic Niño Index & Marine SST Dipole';

  if (simulateOffline) {
    return {
      success: false,
      providerName,
      error: 'Simulated external climate index outage (Offline test mode enabled)',
    };
  }

  try {
    const res = await fetch(`/api/ingest?type=climate&simulateOffline=${simulateOffline}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP ${res.status} from climate provider`);
    }

    const json = await res.json();
    if (!json.ok || !json.climate) {
      throw new Error(json.error || 'Invalid climate indices payload');
    }

    const signals: RawClimateSignalInput[] = [
      json.climate.enso,
      json.climate.iod,
      json.climate.mjo,
    ].filter(Boolean);

    return {
      success: true,
      providerName: json.climate.enso?.source || providerName,
      signals,
    };
  } catch (err) {
    return {
      success: false,
      providerName,
      error: err instanceof Error ? err.message : 'Failed to fetch NOAA/Marine climate indices',
    };
  }
}
