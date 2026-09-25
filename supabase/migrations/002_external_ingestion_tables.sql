-- ============================================================================
-- MonsoonPulse AI — Migration 002: Real External Data Ingestion Tables
-- Extends existing Supabase schema with:
--   9. weather_observations
--  10. rainfall_observations
--  11. climate_index_observations
--  12. data_source_status
-- ============================================================================

-- 9. WEATHER OBSERVATIONS
CREATE TABLE IF NOT EXISTS weather_observations (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  observation_date DATE NOT NULL,
  precipitation_mm NUMERIC(6,2),
  temperature_c NUMERIC(5,2),
  humidity NUMERIC(5,2),
  wind_speed NUMERIC(5,2),
  pressure NUMERIC(6,1),
  weather_condition TEXT,
  quality_flag TEXT NOT NULL DEFAULT 'valid' CHECK (quality_flag IN ('valid', 'missing', 'estimated', 'stale', 'invalid')),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, observation_date, source)
);

-- 10. RAINFALL OBSERVATIONS
CREATE TABLE IF NOT EXISTS rainfall_observations (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  observation_date DATE NOT NULL,
  rainfall_mm NUMERIC(6,2),
  source TEXT NOT NULL,
  quality_flag TEXT NOT NULL DEFAULT 'valid' CHECK (quality_flag IN ('valid', 'missing', 'estimated', 'stale', 'invalid')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(location_id, observation_date, source)
);

-- 11. CLIMATE INDEX OBSERVATIONS (ENSO, IOD, MJO)
CREATE TABLE IF NOT EXISTS climate_index_observations (
  id TEXT PRIMARY KEY,
  observation_date DATE NOT NULL,
  index_name TEXT NOT NULL CHECK (index_name IN ('ENSO', 'IOD', 'MJO')),
  index_value NUMERIC(6,3) NOT NULL,
  phase TEXT NOT NULL,
  amplitude NUMERIC(5,2),
  quality_flag TEXT NOT NULL DEFAULT 'valid' CHECK (quality_flag IN ('valid', 'missing', 'estimated', 'stale', 'invalid')),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(observation_date, index_name, source)
);

-- 12. DATA SOURCE STATUS
CREATE TABLE IF NOT EXISTS data_source_status (
  id TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  last_successful_fetch TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'offline')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS POLICIES FOR OBSERVATION TABLES
ALTER TABLE weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainfall_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE climate_index_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read weather_observations" ON weather_observations FOR SELECT USING (true);
CREATE POLICY "Public upsert weather_observations" ON weather_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update weather_observations" ON weather_observations FOR UPDATE USING (true);

CREATE POLICY "Public read rainfall_observations" ON rainfall_observations FOR SELECT USING (true);
CREATE POLICY "Public upsert rainfall_observations" ON rainfall_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update rainfall_observations" ON rainfall_observations FOR UPDATE USING (true);

CREATE POLICY "Public read climate_index_observations" ON climate_index_observations FOR SELECT USING (true);
CREATE POLICY "Public upsert climate_index_observations" ON climate_index_observations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update climate_index_observations" ON climate_index_observations FOR UPDATE USING (true);

CREATE POLICY "Public read data_source_status" ON data_source_status FOR SELECT USING (true);
CREATE POLICY "Public upsert data_source_status" ON data_source_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update data_source_status" ON data_source_status FOR UPDATE USING (true);
