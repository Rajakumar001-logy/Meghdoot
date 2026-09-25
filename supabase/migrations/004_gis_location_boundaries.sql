-- =============================================================================
-- Migration 004: GIS Location Boundaries & Spatial Metadata
-- (supabase/migrations/004_gis_location_boundaries.sql)
--
-- Prompt 7 Requirement 5:
-- 1. Extends `public.locations` with `geometry_source` and `geometry_version`
--    without storing bulky GeoJSON blobs inside `locations` rows.
-- 2. Creates `public.location_boundaries` (`id`, `location_id`, `block_id`,
--    `geometry`, `source`, `source_url`, `version`, `created_at`, `updated_at`)
--    referencing `public.locations(id)` via exact `block_id`.
-- =============================================================================

ALTER TABLE public.locations
    ADD COLUMN IF NOT EXISTS geometry_source TEXT DEFAULT 'LGD District 130 / Census 2011 District 175 Verified Centroid (WGS84)',
    ADD COLUMN IF NOT EXISTS geometry_version TEXT DEFAULT 'PRAYAGRAJ-GIS-WGS84-v1';

CREATE TABLE IF NOT EXISTS public.location_boundaries (
    id TEXT PRIMARY KEY,
    location_id TEXT NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
    block_id TEXT NOT NULL UNIQUE,
    geometry JSONB NOT NULL,
    geometry_mode TEXT NOT NULL DEFAULT 'centroid_fallback',
    crs TEXT NOT NULL DEFAULT 'EPSG:4326',
    source TEXT NOT NULL,
    source_url TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'PRAYAGRAJ-GIS-WGS84-v1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_boundaries_block_id
    ON public.location_boundaries (block_id);

ALTER TABLE public.location_boundaries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read location_boundaries" ON public.location_boundaries;
CREATE POLICY "Allow public read location_boundaries"
    ON public.location_boundaries FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public upsert location_boundaries" ON public.location_boundaries;
CREATE POLICY "Allow public upsert location_boundaries"
    ON public.location_boundaries FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update location_boundaries" ON public.location_boundaries;
CREATE POLICY "Allow public update location_boundaries"
    ON public.location_boundaries FOR UPDATE USING (true);
