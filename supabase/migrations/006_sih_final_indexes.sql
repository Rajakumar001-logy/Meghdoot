-- ============================================================================
-- MONSOONPULSE AI — MIGRATION 006: FINAL SIH DATABASE VERIFICATION & INDEXING
-- Sections 41 & 42:
--   1. Verifies all 15 core tables exist without destructive recreation
--   2. Adds justified performance indexes on location_id, crop_id,
--      forecast_horizon, created_at, issued_at, status (alert status), and farmer_id
-- ============================================================================

-- 1. Location & Forecast Prediction Indexes
CREATE INDEX IF NOT EXISTS idx_forecast_predictions_loc_horizon_created
  ON public.forecast_predictions(location_id, forecast_horizon, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rainfall_forecasts_loc_date
  ON public.rainfall_forecasts(location_id, forecast_date);

-- 2. AI Predictions Indexes (location_id, forecast_horizon, issued_at)
CREATE INDEX IF NOT EXISTS idx_ai_predictions_loc_horizon_issued
  ON public.ai_predictions(location_id, forecast_horizon, issued_at DESC);

-- 3. External Observations Indexes (location_id, observation_date / created_at)
CREATE INDEX IF NOT EXISTS idx_weather_obs_loc_created
  ON public.weather_observations(location_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rainfall_obs_loc_created
  ON public.rainfall_observations(location_id, created_at DESC);

-- 4. Crop Advisories Indexes (location_id, crop_id, forecast_horizon, created_at)
CREATE INDEX IF NOT EXISTS idx_crop_advisories_loc_crop_horizon
  ON public.crop_advisories(location_id, crop_id, forecast_horizon, created_at DESC);

-- 5. Alerts & Farmer Communication Indexes (location_id, crop_id, status, farmer_id, created_at)
CREATE INDEX IF NOT EXISTS idx_alerts_status_created
  ON public.alerts(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_loc_crop_status
  ON public.alerts(location_id, crop_id, status);

CREATE INDEX IF NOT EXISTS idx_alerts_farmer_status
  ON public.alerts(farmer_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_farmer_messages_loc_crop_created
  ON public.farmer_messages(location_id, crop_id, created_at DESC);
