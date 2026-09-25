# MonsoonPulse AI — Real GIS & Block-Level Spatial Intelligence Architecture (`MPAI-ENS-0.1`)

## 1. Boundary Source & Administrative Hierarchy
MonsoonPulse AI maps the 8 administrative blocks of **Prayagraj District**, **Uttar Pradesh** (`LGD State Code: 9`, `LGD District Code: 130`, `Census 2011 District Code: 175`):

| `block_id` | Block Name | Administrative Type | LGD Block Code | Census 2011 Subdistrict | WGS84 Centroid (`lat, lon`) |
|---|---|---|---|---|---|
| `karchhana` | Karchhana | Tehsil & CD Block | `13001` | `00891` | `25.2838°N, 81.9361°E` |
| `phulpur` | Phulpur | Tehsil & CD Block | `13002` | `00887` | `25.5469°N, 82.0886°E` |
| `meja` | Meja | Tehsil & CD Block | `13003` | `00892` | `25.1433°N, 82.1114°E` |
| `koraon` | Koraon | Tehsil & CD Block | `13004` | `00893` | `24.9856°N, 82.0669°E` |
| `bara` | Bara | Tehsil & CD Block | `13005` | `00890` | `25.2575°N, 81.7192°E` |
| `soraon` | Soraon | Tehsil & CD Block | `13006` | `00886` | `25.6033°N, 81.8492°E` |
| `handia` | Handia | Tehsil & CD Block | `13007` | `00888` | `25.3786°N, 82.1869°E` |
| `chaka` | Chaka | CD Block (under Karchhana Tehsil) | `13008` | `00889-CD` | `25.3942°N, 81.8639°E` |

### Why Centroid Fallback Mode is Active (`Zero Fabricated Polygons`)
In Uttar Pradesh, 7 of the 8 Prayagraj units (`Karchhana`, `Phulpur`, `Meja`, `Koraon`, `Bara`, `Soraon`, `Handia`) are both Tehsils and Community Development (CD) Blocks, while `Chaka` (`Naini / Chaka`) is a CD Block nested inside `Karchhana` Tehsil. Official cadastral polygons for mixed Tehsil + CD Block boundaries are served interactively via UP Bhunaksha / NIC BharatMaps rather than an open public static polygon GeoJSON.

Following **Section 3 (`NO FAKE POLYGONS`)**:
- The old 4-vertex rectangular coordinates and fake SVG polygons were removed.
- Authoritative WGS84 (`EPSG:4326`) block headquarters centroids from LGD (`District 130`) and Census 2011 (`District 175`) are stored in `public/gis/prayagraj_blocks.geojson`.
- The map explicitly displays the required banner:
  > **`"Boundary data unavailable — displaying block centroids."`**
- If an official multi-vertex polygon GeoJSON is placed at `public/gis/prayagraj_blocks_polygons.geojson`, `src/lib/gisServer.ts` automatically detects, validates, and renders the polygon geometries without code changes.

---

## 2. Coordinate Reference System (CRS)
- **Standard**: `EPSG:4326` (`WGS84`)
- **GeoJSON Coordinate Order**: `[longitude, latitude]` (`[81.7192, 25.2575]`)
- **Leaflet LatLng Order**: `[latitude, longitude]` (`[25.2575, 81.7192]`)
- **Validation**: `validateGeoJSON()` in `src/lib/geo.ts` verifies every coordinate pair satisfies `-90 <= lat <= 90` and `-180 <= lon <= 180`, contains no `NaN`/`null` coordinates, and covers all 8 canonical Prayagraj block IDs.

---

## 3. GeoJSON Structure (`public/gis/prayagraj_blocks.geojson`)
```json
{
  "type": "FeatureCollection",
  "crs": {
    "type": "name",
    "properties": { "name": "urn:ogc:def:crs:OGC:1.3:CRS84" }
  },
  "metadata": {
    "geometry_mode": "centroid_fallback",
    "fallback_banner": "Boundary data unavailable — displaying block centroids.",
    "geometry_source": "Government of India LGD (District 130) / Census of India 2011 (District 175) Official Block Headquarters Centroids",
    "geometry_version": "LGD-2024.1-CENTROID-FALLBACK"
  },
  "features": [ ... ]
}
```

---

## 4. Centroid Calculation & Verification
- For `Point` geometries, `centroid_lat = coordinates[1]` and `centroid_lon = coordinates[0]`.
- For `Polygon` / `MultiPolygon` geometries (when loaded via `prayagraj_blocks_polygons.geojson` or Supabase `location_boundaries`), `extractCentroidFromGeometry()` in `src/lib/geo.ts` computes the arithmetic vertex ring mean in `EPSG:4326` while preserving the official headquarters coordinates when provided in `feature.properties`.

---

## 5. Spatial Join Architecture
Every spatial record joins deterministically on the canonical lowercase slug `block_id`:
```text
GeoJSON Feature (properties.block_id)
        │
        ├──► Supabase public.locations (block_id, geometry_source, geometry_version)
        ├──► Supabase public.location_boundaries (location_id, geojson, centroid_lat, centroid_lon)
        ├──► Real Block Observations (rainfall_mm, temp_max, humidity, pressure, wind_speed, observation_timestamp)
        └──► Real AI Predictions (MPAI-ENS-0.1: 7D, 14D, 21D, 30D calibrated probabilities & expected rainfall)
```

---

## 6. Configurable Risk Threshold Classification (`src/config/riskThresholds.ts`)
All risk bands are centralized in `src/config/riskThresholds.ts` and explicitly labeled **`"Prototype risk classification thresholds."`**:
- **LOW (`●`)**: `0% – 30%` (`#16A34A`)
- **MODERATE (`▲`)**: `30% – 60%` (`#EAB308`)
- **HIGH (`◆`)**: `60% – 80%` (`#F97316`)
- **VERY HIGH (`■`)**: `80% – 100%` (`#DC2626`)

---

## 7. Composite Overall Agricultural Risk Formula (`Layer G`)
Defined in `OVERALL_AGRICULTURAL_RISK_CONFIG` (`src/config/riskThresholds.ts`):
$$\text{Overall Agricultural Risk} = 0.25 \times (1 - P_{\text{onset}}) + 0.30 \times P_{\text{false\_onset}} + 0.30 \times P_{\text{dry\_spell}} + 0.15 \times P_{\text{heavy\_rain}}$$
- Weights sum to `1.00` (`0.25 + 0.30 + 0.30 + 0.15 = 1.00`).
- Evaluated independently for each block and each horizon (`7D`, `14D`, `21D`, `30D`).

---

## 8. Multi-Horizon Rendering (`7D | 14D | 21D | 30D`)
- `ml-service/scripts/export_gis_predictions.py` runs the trained `MPAI-ENS-0.1` (`0.6 XGBoost + 0.4 LSTM` + Isotonic/Platt calibration) artifact across all 8 Prayagraj blocks and all 4 horizons (`7D`, `14D`, `21D`, `30D`), writing `ml-service/artifacts/block_spatial_predictions.json`.
- Each horizon uses its own trained target heads (`onset_7d`, `onset_14d`, `onset_21d`, `onset_30d`, etc.) and horizon-specific historical rainfall climatology. **No horizon is ever rescaled from 14D.**

---

## 9. Failure Handling & Fallbacks
- **Boundary Fallback**: Displays `"Boundary data unavailable — displaying block centroids."` when polygon files are absent.
- **AI Prediction Failure**: In `AI FORECAST` mode, if `MPAI-ENS-0.1` predictions are unavailable, displays `"AI prediction unavailable"` and **never** silently substitutes simulated values.
- **Observation Failure**: If block weather/rainfall observations are unavailable, displays `"Latest observation unavailable"`.

---

## 10. Performance Optimizations
- GeoJSON size is `~5.1 KB` (well under the `2 MB` ceiling).
- `src/lib/gisServer.ts` caches validated GeoJSON and spatial intelligence payloads in memory on the server (`CACHE_TTL_MS = 60,000 ms`).
- `HyperlocalRiskMap.tsx` initializes the Leaflet instance once and updates the `L.layerGroup()` dynamically when switching layers, horizons, or forecast modes without reloading map tiles.

---

## 11. Known Limitations
1. Polygon boundaries default to the verified `EPSG:4326` headquarters centroid fallback (`geometry_mode: "centroid_fallback"`) until an official UP Bhunaksha / LGD polygon shapefile export is dropped into `public/gis/prayagraj_blocks_polygons.geojson`.
2. Block-level historical observations (`2019–2025`) are derived from Open-Meteo ERA5 reanalysis grid cells centered on each block's WGS84 coordinates rather than physical rain-gauge station networks.
