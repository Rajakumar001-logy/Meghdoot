import { getSupabaseClient } from "@/lib/supabase";
import { FarmerMessageRow } from "@/types/database";
import { FarmerLanguage, ForecastHorizon } from "@/types/monsoon";

const FARMER_MESSAGES_STORAGE_KEY = "monsoonpulse_farmer_messages_v1";

export interface StoredFarmerMessage extends FarmerMessageRow {
  block_name: string;
  crop_name: string;
  horizon: ForecastHorizon;
  farmers_reached: number;
  timestamp_label: string;
}

const DEFAULT_MESSAGES: StoredFarmerMessage[] = [
  {
    id: "WA-UP-849201",
    location_id: "karchhana",
    block_name: "Karchhana Block",
    crop_id: "paddy",
    crop_name: "Paddy",
    language: "Hindi",
    channel: "WhatsApp",
    horizon: "14D",
    farmers_reached: 1620,
    message:
      "🌧️ मानसून अपडेट (Karchhana Block)\nआपके क्षेत्र में अगले 14 दिनों में लंबे सूखे की संभावना 62% है।\nधान की बुवाई 5–7 दिन टालने पर विचार करें और वैकल्पिक सिंचाई की व्यवस्था तैयार रखें।",
    status: "simulated",
    timestamp_label: "Today, 08:15 AM",
    created_at: "2026-06-12T08:15:00Z",
  },
  {
    id: "SMS-UP-732110",
    location_id: "phulpur",
    block_name: "Phulpur Block",
    crop_id: "paddy",
    crop_name: "Paddy",
    language: "Hindi",
    channel: "SMS",
    horizon: "14D",
    farmers_reached: 1840,
    message:
      "🌧️ मानसून अपडेट (Phulpur Block)\nआपके क्षेत्र में अगले 14 दिनों में लंबे सूखे की संभावना 57% है।\nधान की बुवाई 5–7 दिन टालने पर विचार करें और वैकल्पिक सिंचाई की व्यवस्था तैयार रखें।",
    status: "simulated",
    timestamp_label: "Today, 08:12 AM",
    created_at: "2026-06-12T08:12:00Z",
  },
];

export function getPersistedFarmerMessages(): StoredFarmerMessage[] {
  if (typeof window === "undefined") return DEFAULT_MESSAGES;
  try {
    const raw = window.localStorage.getItem(FARMER_MESSAGES_STORAGE_KEY);
    if (!raw) return DEFAULT_MESSAGES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
}

/**
 * Retrieves farmer messages from Supabase `farmer_messages` table merged with local history.
 */
export async function getFarmerMessages(
  locationId?: string
): Promise<StoredFarmerMessage[]> {
  const localList = getPersistedFarmerMessages();
  const client = getSupabaseClient();

  if (client) {
    try {
      let query = client
        .from("farmer_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (locationId) {
        query = query.eq("location_id", locationId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const dbMapped: StoredFarmerMessage[] = (
          data as FarmerMessageRow[]
        ).map((row) => ({
          ...row,
          block_name: `${
            row.location_id.charAt(0).toUpperCase() + row.location_id.slice(1)
          } Block`,
          crop_name:
            row.crop_id.charAt(0).toUpperCase() + row.crop_id.slice(1),
          horizon: "14D",
          farmers_reached: 1620,
          timestamp_label: new Date(row.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }));
        return dbMapped;
      }
    } catch {
      // Fallback to localList
    }
  }

  return localList;
}

/**
 * Inserts a newly generated farmer message into Supabase `farmer_messages`
 * with `status = "simulated"` AND persists locally across page refreshes.
 */
export async function recordFarmerMessageInDb(params: {
  locationId: string;
  blockName: string;
  cropId: string;
  cropName: string;
  language: FarmerLanguage;
  channel: "WhatsApp" | "SMS" | "Mobile App";
  horizon: ForecastHorizon;
  farmersReached: number;
  message: string;
}): Promise<StoredFarmerMessage> {
  const prefix = params.channel === "WhatsApp" ? "WA-UP" : "SMS-UP";
  const id = `${prefix}-${Math.floor(100000 + Math.random() * 900000)}`;
  const nowIso = new Date().toISOString();
  const timeLabel = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const record: StoredFarmerMessage = {
    id,
    location_id: params.locationId,
    block_name: params.blockName,
    crop_id: params.cropId,
    crop_name: params.cropName,
    language: params.language,
    channel: params.channel,
    horizon: params.horizon,
    farmers_reached: params.farmersReached,
    message: params.message,
    status: "simulated",
    timestamp_label: `Just now (${timeLabel})`,
    created_at: nowIso,
  };

  // Persist locally so refresh retains history
  if (typeof window !== "undefined") {
    const existing = getPersistedFarmerMessages();
    const updated = [record, ...existing].slice(0, 25);
    try {
      window.localStorage.setItem(
        FARMER_MESSAGES_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch {
      // Ignore storage error
    }
  }

  // Insert into Supabase `farmer_messages` table with status = "simulated"
  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("farmer_messages").insert({
        id: record.id,
        location_id: record.location_id,
        crop_id: record.crop_id,
        language: record.language,
        channel: record.channel,
        message: record.message,
        status: "simulated",
        created_at: record.created_at,
      });
    } catch {
      // Fallback already persisted
    }
  }

  return record;
}
