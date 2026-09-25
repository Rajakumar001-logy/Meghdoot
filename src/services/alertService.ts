import { getSupabaseClient } from "@/lib/supabase";
import {
  generateDynamicAlertsForState,
  getBlocksForScenarioAndHorizon,
} from "@/data/mockData";
import { AlertRow } from "@/types/database";
import { Alert, DemoScenarioId, ForecastHorizon } from "@/types/monsoon";

const READ_ALERTS_STORAGE_KEY = "monsoonpulse_alerts_read_v1";

export function getPersistedReadAlertMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(READ_ALERTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function setPersistedReadAlertMap(map: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(READ_ALERTS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Retrieves alerts for the selected location from Supabase `alerts` table,
 * falling back to rule-generated alerts synchronized with persistent read state.
 */
export async function getAlerts(
  locationId: string = "karchhana",
  horizon: ForecastHorizon = "14D",
  scenario: DemoScenarioId = "scenario_b"
): Promise<Alert[]> {
  const persistedRead = getPersistedReadAlertMap();
  const blocks = getBlocksForScenarioAndHorizon(scenario, horizon);
  const selectedBlock =
    blocks.find((b) => b.id === locationId) || blocks[0];

  const client = getSupabaseClient();
  if (client && scenario === "scenario_b") {
    try {
      const { data, error } = await client
        .from("alerts")
        .select("*")
        .eq("location_id", locationId)
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return (data as AlertRow[]).map((row) => ({
          id: row.id,
          severity: row.severity,
          severityLabel:
            row.severity === "high"
              ? "HIGH PRIORITY"
              : row.severity === "warning"
              ? "WARNING"
              : "WATCH",
          title: row.title,
          message: row.message,
          affectedBlocksCount: 1,
          affectedBlocks: [selectedBlock.name],
          timestamp: "Supabase Record",
          read: Boolean(row.is_read || persistedRead[row.id]),
          category: row.alert_type,
        }));
      }
    } catch {
      // Fallback to rule-generated alerts below
    }
  }

  const dynamicAlerts = generateDynamicAlertsForState(
    selectedBlock,
    blocks,
    horizon
  );
  return dynamicAlerts.map((a) => ({
    ...a,
    read: Boolean(persistedRead[a.id]),
  }));
}

/**
 * Marks a single alert as read in Supabase (`alerts.is_read = true`)
 * AND persists in local storage so refreshing the page preserves `is_read = true`.
 */
export async function markAlertRead(alertId: string): Promise<boolean> {
  const map = getPersistedReadAlertMap();
  map[alertId] = true;
  setPersistedReadAlertMap(map);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from("alerts")
        .update({ is_read: true })
        .eq("id", alertId);
    } catch {
      // Local persistence already updated
    }
  }
  return true;
}

/**
 * Marks all provided alerts as read in Supabase (`alerts.is_read = true`)
 * AND persists in local storage across page refreshes.
 */
export async function markAllAlertsRead(alertIds: string[]): Promise<boolean> {
  const map = getPersistedReadAlertMap();
  alertIds.forEach((id) => {
    map[id] = true;
  });
  setPersistedReadAlertMap(map);

  const client = getSupabaseClient();
  if (client && alertIds.length > 0) {
    try {
      await client
        .from("alerts")
        .update({ is_read: true })
        .in("id", alertIds);
    } catch {
      // Local persistence already updated
    }
  }
  return true;
}
