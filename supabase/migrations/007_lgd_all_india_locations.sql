-- ============================================================================
-- MONSOONPULSE AI — MIGRATION 007: ALL-INDIA LOCAL GOVERNMENT DIRECTORY (LGD)
-- EXPANSION & COVERAGE INTEGRITY
--
-- Objective:
-- 1. Extends `public.locations` with official LGD identifiers:
--    - state_lgd_code
--    - state_name
--    - district_lgd_code
--    - district_name
--    - block_lgd_code
--    - block_name
--    - is_active
--    - data_coverage ('FULL', 'WEATHER_ONLY', 'LOCATION_ONLY', 'GIS_ONLY', 'AI_FORECAST_UNAVAILABLE')
-- 2. Preserves the 8 validated Prayagraj prototype blocks (with FULL coverage)
-- 3. Seeds reference test districts (Madhya Pradesh -> Jabalpur, UP -> Gorakhpur)
-- 4. Creates performance indexes on all LGD codes and compound hierarchies
-- ============================================================================

-- 1. Extend locations schema
ALTER TABLE public.locations
    ADD COLUMN IF NOT EXISTS state_lgd_code INTEGER,
    ADD COLUMN IF NOT EXISTS state_name TEXT,
    ADD COLUMN IF NOT EXISTS district_lgd_code INTEGER,
    ADD COLUMN IF NOT EXISTS district_name TEXT,
    ADD COLUMN IF NOT EXISTS block_lgd_code INTEGER,
    ADD COLUMN IF NOT EXISTS block_name TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS data_coverage TEXT DEFAULT 'LOCATION_ONLY'
        CHECK (data_coverage IN ('FULL', 'WEATHER_ONLY', 'LOCATION_ONLY', 'GIS_ONLY', 'AI_FORECAST_UNAVAILABLE')),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- 2. Map & preserve existing Prayagraj blocks (District LGD 120, State LGD 9, FULL coverage)
UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 837,
    block_name = 'Karchhana',
    block = 'Karchhana',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'karchhana';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 844,
    block_name = 'Phulpur',
    block = 'Phulpur',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'phulpur';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 843,
    block_name = 'Meja',
    block = 'Meja',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'meja';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 840,
    block_name = 'Koraon',
    block = 'Koraon',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'koraon';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 836,
    block_name = 'Bara',
    block = 'Bara',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'bara';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 848,
    block_name = 'Soraon',
    block = 'Soraon',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'soraon';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 834,
    block_name = 'Handia',
    block = 'Handia',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'handia';

UPDATE public.locations SET
    state_lgd_code = 9,
    state_name = 'Uttar Pradesh',
    state = 'Uttar Pradesh',
    district_lgd_code = 120,
    district_name = 'Prayagraj',
    district = 'Prayagraj',
    block_lgd_code = 832,
    block_name = 'Chaka',
    block = 'Chaka',
    is_active = true,
    data_coverage = 'FULL',
    updated_at = now()
WHERE id = 'chaka';

-- 3. Seed Reference Jabalpur LGD Blocks (Madhya Pradesh, District 399, State 23, LOCATION_ONLY coverage)
INSERT INTO public.locations (id, state_lgd_code, state_name, state, district_lgd_code, district_name, district, block_lgd_code, block_name, block, panchayat, latitude, longitude, soil_type, is_active, data_coverage)
VALUES
    ('lgd-block-3866', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3866, 'Jabalpur', 'Jabalpur', '', 23.1815, 79.9864, 'Medium Black Soil', true, 'LOCATION_ONLY'),
    ('lgd-block-3867', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3867, 'Kundam', 'Kundam', '', 23.2389, 80.3701, 'Red & Black Mixed', true, 'LOCATION_ONLY'),
    ('lgd-block-3868', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3868, 'Majhouli', 'Majhouli', '', 23.5134, 79.9482, 'Clayey Alluvium', true, 'LOCATION_ONLY'),
    ('lgd-block-3869', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3869, 'Panagar', 'Panagar', '', 23.2974, 80.0076, 'Deep Black Soil', true, 'LOCATION_ONLY'),
    ('lgd-block-3870', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3870, 'Patan', 'Patan', '', 23.2842, 79.7042, 'Sandy Loam', true, 'LOCATION_ONLY'),
    ('lgd-block-3871', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3871, 'Shahpura', 'Shahpura', '', 23.1415, 79.6648, 'Black Cotton Soil', true, 'LOCATION_ONLY'),
    ('lgd-block-3872', 23, 'Madhya Pradesh', 'Madhya Pradesh', 399, 'Jabalpur', 'Jabalpur', 3872, 'Sihora', 'Sihora', '', 23.4912, 80.1174, 'Lateritic Soil', true, 'LOCATION_ONLY')
ON CONFLICT (id) DO UPDATE SET
    state_lgd_code = EXCLUDED.state_lgd_code,
    state_name = EXCLUDED.state_name,
    district_lgd_code = EXCLUDED.district_lgd_code,
    district_name = EXCLUDED.district_name,
    block_lgd_code = EXCLUDED.block_lgd_code,
    block_name = EXCLUDED.block_name,
    data_coverage = EXCLUDED.data_coverage,
    updated_at = now();

-- 4. Seed Reference Gorakhpur LGD Blocks (Uttar Pradesh, District 145, State 9, LOCATION_ONLY coverage)
INSERT INTO public.locations (id, state_lgd_code, state_name, state, district_lgd_code, district_name, district, block_lgd_code, block_name, block, panchayat, latitude, longitude, soil_type, is_active, data_coverage)
VALUES
    ('lgd-block-1135', 9, 'Uttar Pradesh', 'Uttar Pradesh', 145, 'Gorakhpur', 'Gorakhpur', 1135, 'Campierganj', 'Campierganj', '', 26.9667, 83.2167, 'Alluvial Loam', true, 'LOCATION_ONLY'),
    ('lgd-block-1136', 9, 'Uttar Pradesh', 'Uttar Pradesh', 145, 'Gorakhpur', 'Gorakhpur', 1136, 'Chargawan', 'Chargawan', '', 26.8000, 83.3667, 'Sandy Loam', true, 'LOCATION_ONLY'),
    ('lgd-block-1147', 9, 'Uttar Pradesh', 'Uttar Pradesh', 145, 'Gorakhpur', 'Gorakhpur', 1147, 'Sahjanwa', 'Sahjanwa', '', 26.7667, 83.1833, 'Gangetic Alluvium', true, 'LOCATION_ONLY'),
    ('lgd-block-1143', 9, 'Uttar Pradesh', 'Uttar Pradesh', 145, 'Gorakhpur', 'Gorakhpur', 1143, 'Khorabar', 'Khorabar', '', 26.7167, 83.4167, 'Silty Loam', true, 'LOCATION_ONLY'),
    ('lgd-block-1145', 9, 'Uttar Pradesh', 'Uttar Pradesh', 145, 'Gorakhpur', 'Gorakhpur', 1145, 'Pipraich', 'Pipraich', '', 26.8333, 83.5167, 'Clayey Alluvium', true, 'LOCATION_ONLY')
ON CONFLICT (id) DO UPDATE SET
    state_lgd_code = EXCLUDED.state_lgd_code,
    state_name = EXCLUDED.state_name,
    district_lgd_code = EXCLUDED.district_lgd_code,
    district_name = EXCLUDED.district_name,
    block_lgd_code = EXCLUDED.block_lgd_code,
    block_name = EXCLUDED.block_name,
    data_coverage = EXCLUDED.data_coverage,
    updated_at = now();

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_locations_state_lgd_code
    ON public.locations (state_lgd_code);

CREATE INDEX IF NOT EXISTS idx_locations_district_lgd_code
    ON public.locations (district_lgd_code);

CREATE INDEX IF NOT EXISTS idx_locations_block_lgd_code
    ON public.locations (block_lgd_code);

CREATE INDEX IF NOT EXISTS idx_locations_state_district_lgd
    ON public.locations (state_lgd_code, district_lgd_code);

CREATE INDEX IF NOT EXISTS idx_locations_district_block_lgd
    ON public.locations (district_lgd_code, block_lgd_code);

CREATE INDEX IF NOT EXISTS idx_locations_state_district_names
    ON public.locations (state, district);

CREATE INDEX IF NOT EXISTS idx_locations_data_coverage
    ON public.locations (data_coverage);
