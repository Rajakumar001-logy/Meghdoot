-- ============================================================================
-- MONSOONPULSE AI — ONE-CLICK COMPLETE SUPABASE SCHEMA, SEED & INDEX SCRIPT
-- Project: https://rwtqspckorprtbobmcij.supabase.co
-- Run this entire file in Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ============================================================================

-- 1. CORE LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.locations (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  district TEXT NOT NULL,
  block TEXT NOT NULL,
  panchayat TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  soil_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CLIMATE INDICES TABLE
CREATE TABLE IF NOT EXISTS public.climate_indices (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  enso_index NUMERIC(5,2) NOT NULL,
  enso_phase TEXT NOT NULL,
  iod_index NUMERIC(5,2) NOT NULL,
  iod_phase TEXT NOT NULL,
  mjo_phase TEXT NOT NULL,
  mjo_amplitude NUMERIC(4,2) NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. FORECAST PREDICTIONS TABLE
CREATE TABLE IF NOT EXISTS public.forecast_predictions (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL CHECK (horizon_days IN (7, 14, 21, 30)),
  forecast_horizon TEXT DEFAULT '14D',
  onset_probability NUMERIC(5,2) NOT NULL,
  false_onset_probability NUMERIC(5,2) NOT NULL,
  dry_spell_probability NUMERIC(5,2) NOT NULL,
  heavy_rain_probability NUMERIC(5,2) NOT NULL,
  expected_rainfall NUMERIC(6,1) NOT NULL,
  rainfall_anomaly NUMERIC(5,2) NOT NULL,
  confidence NUMERIC(5,2) NOT NULL,
  risk_level TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RAINFALL FORECASTS TABLE
CREATE TABLE IF NOT EXISTS public.rainfall_forecasts (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  forecast_date DATE NOT NULL,
  horizon_days INTEGER NOT NULL,
  predicted_rainfall NUMERIC(6,1) NOT NULL,
  historical_average NUMERIC(6,1) NOT NULL,
  p10 NUMERIC(6,1) NOT NULL,
  p90 NUMERIC(6,1) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CROPS TABLE
CREATE TABLE IF NOT EXISTS public.crops (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  scientific_name TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CROP ADVISORIES TABLE
CREATE TABLE IF NOT EXISTS public.crop_advisories (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  crop_id TEXT NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
  horizon_days INTEGER NOT NULL DEFAULT 14,
  forecast_horizon TEXT NOT NULL DEFAULT '14D',
  rule_id TEXT NOT NULL DEFAULT 'RULE-FALSE-ONSET-001',
  decision_category TEXT NOT NULL DEFAULT 'DELAY_SOWING',
  severity TEXT NOT NULL DEFAULT 'HIGH',
  risk_condition TEXT NOT NULL,
  advisory_text TEXT NOT NULL,
  advisory_text_hi TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 82.0,
  model_version TEXT NOT NULL DEFAULT 'MPAI-ENS-0.1',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. FARMERS & MULTI-CROP MAPPING TABLES (Prompt 9)
CREATE TABLE IF NOT EXISTS public.farmers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_language TEXT NOT NULL DEFAULT 'Hindi',
  location_id TEXT NOT NULL,
  preferred_channel TEXT NOT NULL DEFAULT 'WhatsApp',
  notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.farmer_crops (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  crop_id TEXT NOT NULL,
  crop_stage TEXT NOT NULL DEFAULT 'sowing',
  sowing_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ALERTS & DELIVERY LOGS TABLES (Prompt 9)
CREATE TABLE IF NOT EXISTS public.alerts (
  id TEXT PRIMARY KEY,
  farmer_id TEXT,
  location_id TEXT NOT NULL,
  crop_id TEXT,
  advisory_id TEXT,
  alert_type TEXT NOT NULL DEFAULT 'MONSOON_ADVISORY',
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'Hindi',
  channel TEXT NOT NULL DEFAULT 'WhatsApp',
  status TEXT NOT NULL DEFAULT 'SIMULATED',
  dedup_key TEXT UNIQUE,
  model_version TEXT NOT NULL DEFAULT 'MPAI-ENS-0.1',
  forecast_horizon TEXT NOT NULL DEFAULT '14D',
  observation_cutoff TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  farmer_response TEXT
);

CREATE TABLE IF NOT EXISTS public.alert_delivery_logs (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  request_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  response_timestamp TIMESTAMPTZ,
  provider_message_id TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT
);

-- 9. FARMER MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.farmer_messages (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  crop_id TEXT NOT NULL,
  language TEXT NOT NULL,
  channel TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'simulated',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. EXTERNAL OBSERVATIONS & AI PREDICTIONS TABLES (Prompts 4 & 5)
CREATE TABLE IF NOT EXISTS public.weather_observations (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  observation_date DATE NOT NULL,
  precipitation_mm NUMERIC(6,2),
  rainfall_mm NUMERIC(6,2),
  temperature_c NUMERIC(5,2),
  humidity NUMERIC(5,2),
  humidity_pct NUMERIC(5,2),
  wind_speed NUMERIC(5,2),
  wind_speed_kmh NUMERIC(5,2),
  pressure NUMERIC(6,2),
  pressure_hpa NUMERIC(6,2),
  quality_flag TEXT DEFAULT 'valid',
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.rainfall_observations (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  observation_date DATE NOT NULL,
  rainfall_mm NUMERIC(6,2),
  normal_rainfall_mm NUMERIC(6,2),
  anomaly_percent NUMERIC(6,2),
  source TEXT NOT NULL,
  quality_flag TEXT DEFAULT 'valid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.climate_index_observations (
  id TEXT PRIMARY KEY,
  observation_date DATE NOT NULL,
  index_name TEXT NOT NULL,
  index_value NUMERIC(6,3),
  phase TEXT NOT NULL,
  amplitude NUMERIC(5,2),
  quality_flag TEXT DEFAULT 'valid',
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.data_source_status (
  source_name TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  last_successful_fetch TIMESTAMPTZ,
  last_error_message TEXT,
  records_ingested INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.ai_predictions (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  forecast_horizon TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  model_version TEXT NOT NULL DEFAULT 'MPAI-ENS-0.1',
  onset_probability NUMERIC(5,4),
  false_onset_probability NUMERIC(5,4),
  dry_spell_probability NUMERIC(5,4),
  heavy_rain_probability NUMERIC(5,4),
  expected_rainfall_mm NUMERIC(6,2),
  rainfall_anomaly_pct NUMERIC(6,2),
  confidence_score NUMERIC(5,4),
  observation_cutoff TIMESTAMPTZ,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. SEED 8 PRAYAGRAJ BLOCK LOCATIONS & 6 SUPPORTED CROPS
INSERT INTO public.locations (id, state, district, block, panchayat, latitude, longitude, soil_type) VALUES
  ('karchhana', 'Uttar Pradesh', 'Prayagraj', 'Karchhana Block', 'Bhita Gram Panchayat', 25.28, 81.94, 'Alluvial Clay-Loam'),
  ('phulpur', 'Uttar Pradesh', 'Prayagraj', 'Phulpur Block', 'Mailahan Panchayat', 25.55, 82.09, 'Gangetic Sandy-Loam'),
  ('meja', 'Uttar Pradesh', 'Prayagraj', 'Meja Block', 'Sirsa Gram Panchayat', 25.14, 82.12, 'Vindhyan Red-Loam'),
  ('koraon', 'Uttar Pradesh', 'Prayagraj', 'Koraon Block', 'Mahuli Gram Panchayat', 24.98, 82.06, 'Black-Clayey Mixed'),
  ('bara', 'Uttar Pradesh', 'Prayagraj', 'Bara Block', 'Lohgara Panchayat', 25.25, 81.72, 'Trans-Yamuna Loam'),
  ('soraon', 'Uttar Pradesh', 'Prayagraj', 'Soraon Block', 'Mewalal Baghiya', 25.60, 81.85, 'Fertile Alluvial Silt'),
  ('handia', 'Uttar Pradesh', 'Prayagraj', 'Handia Block', 'Saidabad Panchayat', 25.37, 82.18, 'Lowland Alluvial Loam'),
  ('chaka', 'Uttar Pradesh', 'Prayagraj', 'Chaka Block', 'Naini Dadri Panchayat', 25.39, 81.86, 'Urban-Peri Alluvial')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.crops (id, name, scientific_name, category) VALUES
  ('paddy', 'Paddy / Rice', 'Oryza sativa', 'Kharif Cereal'),
  ('maize', 'Maize', 'Zea mays', 'Kharif Coarse Cereal'),
  ('pulses', 'Pulses (Arhar / Urad / Moong)', 'Cajanus cajan / Vigna mungo', 'Kharif Pulse'),
  ('soybean', 'Soybean', 'Glycine max', 'Kharif Oilseed'),
  ('cotton', 'Cotton', 'Gossypium hirsutum', 'Kharif Cash Crop'),
  ('wheat', 'Wheat', 'Triticum aestivum', 'Rabi Cereal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.farmers (id, name, phone, preferred_language, location_id, preferred_channel, notification_enabled, active) VALUES
  ('frm-101', 'Ramesh Chandra Patel', '+919451200084', 'Hindi', 'karchhana', 'WhatsApp', TRUE, TRUE),
  ('frm-102', 'Sukhdev Prasad Maurya', '+919839000019', 'Hindi', 'phulpur', 'SMS', TRUE, TRUE),
  ('frm-103', 'Smt. Kavita Devi Bind', '+918765400062', 'Hindi', 'meja', 'WhatsApp', TRUE, TRUE),
  ('frm-104', 'Brijesh Kumar Yadav', '+919125600041', 'English', 'soraon', 'In-App', TRUE, TRUE),
  ('frm-105', 'Harishankar Shukla', '+919415300007', 'Hindi', 'koraon', 'SMS', FALSE, TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.farmer_crops (id, farmer_id, crop_id, crop_stage, sowing_date) VALUES
  ('fc-101-paddy', 'frm-101', 'paddy', 'sowing', '2026-06-15'),
  ('fc-101-pulses', 'frm-101', 'pulses', 'sowing', '2026-06-18'),
  ('fc-102-paddy', 'frm-102', 'paddy', 'nursery', '2026-06-10'),
  ('fc-102-maize', 'frm-102', 'maize', 'sowing', '2026-06-16'),
  ('fc-103-pulses', 'frm-103', 'pulses', 'sowing', '2026-06-14'),
  ('fc-104-paddy', 'frm-104', 'paddy', 'vegetative', '2026-06-01'),
  ('fc-105-soybean', 'frm-105', 'soybean', 'sowing', '2026-06-16')
ON CONFLICT (id) DO NOTHING;

-- 12. PERFORMANCE INDEXES (Migration 006)
CREATE INDEX IF NOT EXISTS idx_forecast_predictions_loc_horizon_created ON public.forecast_predictions(location_id, forecast_horizon, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_predictions_loc_horizon_issued ON public.ai_predictions(location_id, forecast_horizon, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_crop_advisories_loc_crop_horizon ON public.crop_advisories(location_id, crop_id, forecast_horizon, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status_created ON public.alerts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_farmer_status ON public.alerts(farmer_id, status, created_at DESC);
