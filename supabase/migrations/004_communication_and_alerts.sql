-- ============================================================================
-- MONSOONPULSE AI — MIGRATION 004: COMMUNICATION, ALERT DELIVERY & OFFICER ALERT CENTER
-- Implements:
--   1. `farmers` table extensions (preferred_language, preferred_channel, notification_enabled, active, updated_at)
--   2. `farmer_crops` multi-crop mapping table (1 farmer -> many crops)
--   3. `alerts` table extensions (farmer_id, advisory_id, alert_type, dedup_key, model_version, forecast_horizon, observation_cutoff, sent_at, expires_at, farmer_response)
--   4. `alert_delivery_logs` provider audit trail table
-- ============================================================================

-- 1. Extend `public.farmers` table
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

ALTER TABLE public.farmers
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'Hindi',
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT NOT NULL DEFAULT 'WhatsApp',
  ADD COLUMN IF NOT EXISTS notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Create `public.farmer_crops` table (1 farmer -> many crops)
CREATE TABLE IF NOT EXISTS public.farmer_crops (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
  crop_id TEXT NOT NULL,
  crop_stage TEXT NOT NULL DEFAULT 'sowing',
  sowing_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_farmer_crops_farmer_id
  ON public.farmer_crops(farmer_id);

CREATE INDEX IF NOT EXISTS idx_farmer_crops_crop_id
  ON public.farmer_crops(crop_id);

-- 3. Extend `public.alerts` table with full provenance, deduplication & lifecycle fields
CREATE TABLE IF NOT EXISTS public.alerts (
  id TEXT PRIMARY KEY,
  farmer_id TEXT,
  location_id TEXT NOT NULL,
  crop_id TEXT,
  advisory_id TEXT,
  alert_type TEXT NOT NULL DEFAULT 'MONSOON_ADVISORY',
  severity TEXT NOT NULL CHECK (severity IN ('CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'high', 'warning', 'watch')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'Hindi',
  channel TEXT NOT NULL DEFAULT 'WhatsApp',
  status TEXT NOT NULL DEFAULT 'GENERATED' CHECK (
    status IN (
      'GENERATED',
      'QUEUED',
      'SENT',
      'DELIVERED',
      'READ',
      'FAILED',
      'EXPIRED',
      'SIMULATED',
      'CANCELLED'
    )
  ),
  dedup_key TEXT UNIQUE,
  model_version TEXT NOT NULL DEFAULT 'MPAI-ENS-0.1',
  forecast_horizon TEXT NOT NULL DEFAULT '14D',
  observation_cutoff TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  farmer_response TEXT CHECK (
    farmer_response IS NULL OR farmer_response IN (
      'READ_ACKNOWLEDGED',
      'ACTION_TAKEN',
      'NEED_OFFICER_CALL'
    )
  )
);

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS farmer_id TEXT,
  ADD COLUMN IF NOT EXISTS crop_id TEXT,
  ADD COLUMN IF NOT EXISTS advisory_id TEXT,
  ADD COLUMN IF NOT EXISTS alert_type TEXT NOT NULL DEFAULT 'MONSOON_ADVISORY',
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'Hindi',
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'WhatsApp',
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'GENERATED',
  ADD COLUMN IF NOT EXISTS dedup_key TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT NOT NULL DEFAULT 'MPAI-ENS-0.1',
  ADD COLUMN IF NOT EXISTS forecast_horizon TEXT NOT NULL DEFAULT '14D',
  ADD COLUMN IF NOT EXISTS observation_cutoff TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS farmer_response TEXT;

CREATE INDEX IF NOT EXISTS idx_alerts_dedup_key
  ON public.alerts(dedup_key);

CREATE INDEX IF NOT EXISTS idx_alerts_location_severity
  ON public.alerts(location_id, severity, status);

CREATE INDEX IF NOT EXISTS idx_alerts_farmer_id
  ON public.alerts(farmer_id, created_at DESC);

-- 4. Create `public.alert_delivery_logs` table for provider request/response audit
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

CREATE INDEX IF NOT EXISTS idx_alert_delivery_logs_alert_id
  ON public.alert_delivery_logs(alert_id, request_timestamp DESC);

-- 5. Seed Registered Farmers & Multi-Crop Mapping (Prayagraj Blocks)
INSERT INTO public.farmers (
  id, name, phone, preferred_language, location_id, preferred_channel, notification_enabled, active
) VALUES
  ('frm-101', 'Ramesh Chandra Patel', '+919451200084', 'Hindi', 'karchhana', 'WhatsApp', TRUE, TRUE),
  ('frm-102', 'Sukhdev Prasad Maurya', '+919839000019', 'Hindi', 'phulpur', 'SMS', TRUE, TRUE),
  ('frm-103', 'Smt. Kavita Devi Bind', '+918765400062', 'Hindi', 'meja', 'WhatsApp', TRUE, TRUE),
  ('frm-104', 'Brijesh Kumar Yadav', '+919125600041', 'English', 'soraon', 'In-App', TRUE, TRUE),
  ('frm-105', 'Harishankar Shukla', '+919415300007', 'Hindi', 'koraon', 'SMS', FALSE, TRUE)
ON CONFLICT (id) DO UPDATE SET
  preferred_language = EXCLUDED.preferred_language,
  location_id = EXCLUDED.location_id,
  preferred_channel = EXCLUDED.preferred_channel,
  notification_enabled = EXCLUDED.notification_enabled,
  active = EXCLUDED.active,
  updated_at = NOW();

INSERT INTO public.farmer_crops (
  id, farmer_id, crop_id, crop_stage, sowing_date
) VALUES
  ('fc-101-paddy', 'frm-101', 'paddy', 'sowing', '2026-06-15'),
  ('fc-101-pulses', 'frm-101', 'pulses', 'sowing', '2026-06-18'),
  ('fc-102-paddy', 'frm-102', 'paddy', 'nursery', '2026-06-10'),
  ('fc-102-maize', 'frm-102', 'maize', 'sowing', '2026-06-16'),
  ('fc-103-pulses', 'frm-103', 'pulses', 'sowing', '2026-06-14'),
  ('fc-103-millets', 'frm-103', 'millets', 'vegetative', '2026-06-05'),
  ('fc-104-paddy', 'frm-104', 'paddy', 'vegetative', '2026-06-01'),
  ('fc-104-cotton', 'frm-104', 'cotton', 'vegetative', '2026-05-28'),
  ('fc-105-soybean', 'frm-105', 'soybean', 'sowing', '2026-06-16')
ON CONFLICT (id) DO UPDATE SET
  crop_stage = EXCLUDED.crop_stage,
  sowing_date = EXCLUDED.sowing_date,
  updated_at = NOW();
