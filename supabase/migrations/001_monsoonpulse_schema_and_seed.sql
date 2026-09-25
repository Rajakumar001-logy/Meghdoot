-- ============================================================================
-- MonsoonPulse AI — Complete Supabase PostgreSQL Schema & Seed Data
-- ============================================================================

-- 1. LOCATIONS
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

-- 2. CLIMATE INDICES
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

-- 3. FORECAST PREDICTIONS (locations -> forecast_predictions)
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

-- 4. RAINFALL FORECASTS (locations -> rainfall_forecasts)
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

-- 5. CROPS
CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CROP ADVISORIES (locations -> crop_advisories -> crops)
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

-- 7. ALERTS (locations -> alerts)
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

-- 8. FARMER MESSAGES (locations -> farmer_messages -> crops)
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

-- SEED DEMO LOCATIONS (8 Prayagraj Blocks)
INSERT INTO locations (id, state, district, block, panchayat, latitude, longitude, soil_type) VALUES
  ('karchhana', 'Uttar Pradesh', 'Prayagraj', 'Karchhana', 'Bhita Gram Panchayat', 25.28, 81.94, 'Clayey Loam'),
  ('phulpur', 'Uttar Pradesh', 'Prayagraj', 'Phulpur', 'Mailahan Gram Panchayat', 25.55, 82.09, 'Alluvial Loam'),
  ('meja', 'Uttar Pradesh', 'Prayagraj', 'Meja', 'Sirsa Gram Panchayat', 25.14, 82.11, 'Vindhyan Red & Gravel'),
  ('koraon', 'Uttar Pradesh', 'Prayagraj', 'Koraon', 'Mahuli Gram Panchayat', 24.99, 82.06, 'Rocky Sandy Loam'),
  ('bara', 'Uttar Pradesh', 'Prayagraj', 'Bara', 'Lalgopalganj South Panchayat', 25.25, 81.73, 'Sandy Clay Loam'),
  ('soraon', 'Uttar Pradesh', 'Prayagraj', 'Soraon', 'Mewalal Baghiya Panchayat', 25.60, 81.85, 'Fertile Gangetic Alluvium'),
  ('handia', 'Uttar Pradesh', 'Prayagraj', 'Handia', 'Saidabad Gram Panchayat', 25.38, 82.19, 'Loamy Alluvial'),
  ('chaka', 'Uttar Pradesh', 'Prayagraj', 'Chaka', 'Dandi Gram Panchayat', 25.39, 81.86, 'Alluvial Silt')
ON CONFLICT (id) DO NOTHING;

-- SEED DEMO CROPS (6 Crops)
INSERT INTO crops (id, name, scientific_name, category) VALUES
  ('paddy', 'Paddy', 'Oryza sativa', 'Kharif Cereal'),
  ('maize', 'Maize', 'Zea mays', 'Kharif Coarse Cereal'),
  ('pulses', 'Pulses', 'Cajanus cajan / Vigna radiata', 'Kharif Legume'),
  ('soybean', 'Soybean', 'Glycine max', 'Kharif Oilseed'),
  ('cotton', 'Cotton', 'Gossypium hirsutum', 'Kharif Commercial'),
  ('wheat', 'Wheat', 'Triticum aestivum', 'Rabi Cereal')
ON CONFLICT (id) DO NOTHING;

-- SEED CLIMATE INDICES
INSERT INTO climate_indices (id, date, enso_index, enso_phase, iod_index, iod_phase, mjo_phase, mjo_amplitude, source) VALUES
  ('clim-2026-06-12', '2026-06-12', -0.18, 'Neutral', 0.64, 'Positive', 'Phase 3', 1.4, 'Simulated climate-index scenario')
ON CONFLICT (id) DO NOTHING;
