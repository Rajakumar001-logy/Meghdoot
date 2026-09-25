-- ============================================================================
-- MONSOONPULSE AI — MIGRATION 005
-- CROP-SPECIFIC AI ADVISORY & AGRICULTURAL DECISION ENGINE SCHEMA
-- (Prompt 8 — Sections 1, 14, 15, 22)
-- ============================================================================

-- 1. Extend public.crops with configurable agronomic sensitivity & seasonality metadata
ALTER TABLE IF EXISTS public.crops
  ADD COLUMN IF NOT EXISTS scientific_name TEXT,
  ADD COLUMN IF NOT EXISTS local_names JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS sowing_window JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS harvesting_window JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rainfall_requirement JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS temperature_range JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS critical_growth_stages JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS excess_rain_sensitivity TEXT DEFAULT 'MODERATE',
  ADD COLUMN IF NOT EXISTS dry_spell_sensitivity TEXT DEFAULT 'MODERATE',
  ADD COLUMN IF NOT EXISTS waterlogging_sensitivity TEXT DEFAULT 'MODERATE',
  ADD COLUMN IF NOT EXISTS suitable_blocks TEXT[] DEFAULT ARRAY['karchhana','phulpur','meja','koraon','bara','soraon','handia','chaka'];

-- 2. Extend public.crop_advisories with traceable rule_id, evidence, bilingual, and expiration fields
ALTER TABLE IF EXISTS public.crop_advisories
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS advisory_type TEXT DEFAULT 'SOWING_DECISION',
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'MODERATE',
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS action TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS forecast_horizon TEXT DEFAULT '14D',
  ADD COLUMN IF NOT EXISTS rule_id TEXT DEFAULT 'RULE-ONSET-001',
  ADD COLUMN IF NOT EXISTS model_version TEXT DEFAULT 'MPAI-ENS-0.1',
  ADD COLUMN IF NOT EXISTS source_mode TEXT DEFAULT 'AI',
  ADD COLUMN IF NOT EXISTS evidence_json JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS valid_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';

-- Prevent duplicate identical advisories per (location_id, crop_id, forecast_horizon, rule_id, language, model_version)
CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_advisories_dedup
  ON public.crop_advisories (location_id, crop_id, forecast_horizon, rule_id, language, model_version);

CREATE INDEX IF NOT EXISTS idx_crop_advisories_active_lookup
  ON public.crop_advisories (location_id, crop_id, forecast_horizon, status);
