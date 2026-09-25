import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

/**
 * Checks whether valid Supabase credentials are provided in environment variables.
 * Never hardcodes credentials in source code.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      supabaseUrl.startsWith("http") &&
      !supabaseUrl.includes("placeholder")
  );
};

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client when NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY are configured, or null when running in
 * local Demo fallback mode.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();

export const SUPABASE_SCHEMA_SQL = `-- ============================================================================
-- MonsoonPulse AI — Production PostgreSQL / Supabase Schema & Seed Script
-- Tables: locations, climate_indices, forecast_predictions, rainfall_forecasts,
--         crops, crop_advisories, alerts, farmer_messages
-- ============================================================================

-- 1. LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  block TEXT NOT NULL,
  panchayat TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  soil_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. CLIMATE INDICES TABLE
CREATE TABLE IF NOT EXISTS climate_indices (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  enso_index NUMERIC(5,2) NOT NULL,
  enso_phase TEXT NOT NULL,
  iod_index NUMERIC(5,2) NOT NULL,
  iod_phase TEXT NOT NULL,
  mjo_phase TEXT NOT NULL,
  mjo_amplitude NUMERIC(4,2) NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. FORECAST PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS forecast_predictions (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (7, 14, 21, 30)),
  onset_probability NUMERIC(5,2) NOT NULL,
  false_onset_probability NUMERIC(5,2) NOT NULL,
  dry_spell_probability NUMERIC(5,2) NOT NULL,
  heavy_rain_probability NUMERIC(5,2) NOT NULL,
  expected_rainfall NUMERIC(6,1) NOT NULL,
  rainfall_anomaly NUMERIC(5,2) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. RAINFALL FORECASTS TABLE
CREATE TABLE IF NOT EXISTS rainfall_forecasts (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL,
  predicted_rainfall NUMERIC(6,1) NOT NULL,
  historical_average NUMERIC(6,1) NOT NULL,
  p10 NUMERIC(6,1) NOT NULL,
  p90 NUMERIC(6,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CROPS TABLE
CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CROP ADVISORIES TABLE
CREATE TABLE IF NOT EXISTS crop_advisories (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (7, 14, 21, 30)),
  risk_condition TEXT NOT NULL,
  advisory_text TEXT NOT NULL,
  advisory_text_hi TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. ALERTS TABLE
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. FARMER MESSAGES TABLE
CREATE TABLE IF NOT EXISTS farmer_messages (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulated',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ROW LEVEL SECURITY (RLS) POLICIES FOR ANON/PUBLIC PROTOTYPE ACCESS
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE climate_indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainfall_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE crop_advisories ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE farmer_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read on locations" ON locations FOR SELECT USING (true);
CREATE POLICY "Allow public read on climate_indices" ON climate_indices FOR SELECT USING (true);
CREATE POLICY "Allow public read on forecast_predictions" ON forecast_predictions FOR SELECT USING (true);
CREATE POLICY "Allow public read on rainfall_forecasts" ON rainfall_forecasts FOR SELECT USING (true);
CREATE POLICY "Allow public read on crops" ON crops FOR SELECT USING (true);
CREATE POLICY "Allow public read on crop_advisories" ON crop_advisories FOR SELECT USING (true);
CREATE POLICY "Allow public read on alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "Allow public update on alerts" ON alerts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read on farmer_messages" ON farmer_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert on farmer_messages" ON farmer_messages FOR INSERT WITH CHECK (status = 'simulated');
`;
