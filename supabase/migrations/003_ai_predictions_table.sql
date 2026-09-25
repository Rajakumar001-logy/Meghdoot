-- =============================================================================
-- Migration 003: Real AI Predictions Table (`ai_predictions`) — Prompt 6 Hardened
-- Stores calibrated ensemble predictions (XGBoost + Temporal LSTM + Calibration),
-- raw uncalibrated probabilities, empirical residual uncertainty intervals,
-- deterministic SHA-256 hashes (`input_hash`, `feature_hash`, `prediction_hash`),
-- validation/test sample counts, observation cutoff, and live feature drift status.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_predictions (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    initialization_date DATE NOT NULL,
    observation_cutoff DATE NOT NULL DEFAULT CURRENT_DATE,
    forecast_date DATE NOT NULL,
    horizon_days INTEGER NOT NULL CHECK (horizon_days IN (7, 14, 21, 30)),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Calibrated probabilities [0, 1]
    onset_probability NUMERIC(6, 4) NOT NULL CHECK (onset_probability >= 0 AND onset_probability <= 1),
    false_onset_probability NUMERIC(6, 4) NOT NULL CHECK (false_onset_probability >= 0 AND false_onset_probability <= 1),
    dry_spell_probability NUMERIC(6, 4) NOT NULL CHECK (dry_spell_probability >= 0 AND dry_spell_probability <= 1),
    heavy_rain_probability NUMERIC(6, 4) NOT NULL CHECK (heavy_rain_probability >= 0 AND heavy_rain_probability <= 1),

    -- Raw uncalibrated ensemble probabilities [0, 1]
    onset_raw_probability NUMERIC(6, 4) DEFAULT 0,
    false_onset_raw_probability NUMERIC(6, 4) DEFAULT 0,
    dry_spell_raw_probability NUMERIC(6, 4) DEFAULT 0,
    heavy_rain_raw_probability NUMERIC(6, 4) DEFAULT 0,

    -- Calibration metadata
    calibration_method TEXT NOT NULL DEFAULT 'isotonic',

    -- Rainfall regression & empirical 80% validation residual interval
    expected_rainfall NUMERIC(8, 2) NOT NULL CHECK (expected_rainfall >= 0),
    rainfall_anomaly NUMERIC(8, 2) NOT NULL,
    uncertainty_interval_low NUMERIC(8, 2) NOT NULL DEFAULT 0,
    uncertainty_interval_high NUMERIC(8, 2) NOT NULL DEFAULT 0,

    -- Validation & held-out test sample provenance
    validation_sample_count INTEGER NOT NULL DEFAULT 1472,
    test_sample_count INTEGER NOT NULL DEFAULT 2136,

    -- Deterministic SHA-256 provenance hashes & drift telemetry
    input_hash TEXT,
    feature_hash TEXT,
    prediction_hash TEXT,
    drift_status TEXT NOT NULL DEFAULT 'NORMAL',

    model_version TEXT NOT NULL,
    dataset_version TEXT NOT NULL DEFAULT 'PRAYAGRAJ-ERA5-HIST-2019-2025-v1',
    data_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (location_id, initialization_date, horizon_days, model_version)
);

-- Safe column additions if table was created prior to Prompt 6
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS observation_cutoff DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS onset_raw_probability NUMERIC(6, 4) DEFAULT 0;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS false_onset_raw_probability NUMERIC(6, 4) DEFAULT 0;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS dry_spell_raw_probability NUMERIC(6, 4) DEFAULT 0;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS heavy_rain_raw_probability NUMERIC(6, 4) DEFAULT 0;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS calibration_method TEXT DEFAULT 'isotonic';
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS uncertainty_interval_low NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS uncertainty_interval_high NUMERIC(8, 2) DEFAULT 0;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS validation_sample_count INTEGER DEFAULT 1472;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS test_sample_count INTEGER DEFAULT 2136;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS input_hash TEXT;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS feature_hash TEXT;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS prediction_hash TEXT;
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS drift_status TEXT DEFAULT 'NORMAL';
ALTER TABLE public.ai_predictions ADD COLUMN IF NOT EXISTS dataset_version TEXT DEFAULT 'PRAYAGRAJ-ERA5-HIST-2019-2025-v1';

CREATE INDEX IF NOT EXISTS idx_ai_predictions_loc_horizon
    ON public.ai_predictions (location_id, horizon_days, initialization_date DESC);

ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read ai_predictions" ON public.ai_predictions;
CREATE POLICY "Allow public read ai_predictions"
    ON public.ai_predictions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public upsert ai_predictions" ON public.ai_predictions;
CREATE POLICY "Allow public upsert ai_predictions"
    ON public.ai_predictions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update ai_predictions" ON public.ai_predictions;
CREATE POLICY "Allow public update ai_predictions"
    ON public.ai_predictions FOR UPDATE USING (true);
