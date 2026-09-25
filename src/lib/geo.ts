/**
 * GeoJSON Normalization, Validation & Spatial Coordinate Utilities
 * (src/lib/geo.ts)
 *
 * Prompt 7 Requirements 3, 4, 17, 25:
 * - Normalizes and validates GeoJSON in WGS84 / EPSG:4326.
 * - Verifies all 8 expected Supabase `block_id`s are present with zero duplicates
 *   and valid WGS84 coordinates.
 * - Explicitly detects whether features use official Polygon boundaries or
 *   the non-fabricated Centroid Fallback (`"Boundary data unavailable — displaying block centroids."`).
 */

import {
  BlockGeoJSONCollection,
  BlockGeoJSONFeature,
  GISMapLayerOption,
  GISValidationResult,
} from "@/types/gis";

export const EXPECTED_PRAYAGRAJ_BLOCK_IDS: readonly string[] = [
  "karchhana",
  "phulpur",
  "meja",
  "koraon",
  "bara",
  "soraon",
  "handia",
  "chaka",
] as const;

export const PRAYAGRAJ_DISTRICT_CENTER: [number, number] = [25.32, 81.97];

export const PRAYAGRAJ_DISTRICT_BOUNDS: [[number, number], [number, number]] = [
  [24.88, 81.62], // South-West [lat, lon]
  [25.70, 82.28], // North-East [lat, lon]
];

export const GIS_MAP_LAYERS: GISMapLayerOption[] = [
  {
    id: "monsoon_onset",
    code: "A",
    label: "A. Monsoon Onset Risk",
    shortLabel: "Monsoon Onset",
    description:
      "Displays calibrated probability of sustained monsoon onset within the selected forecast horizon (Delay Risk = 1 − P_onset).",
    unit: "%",
  },
  {
    id: "false_onset",
    code: "B",
    label: "B. False Onset Risk",
    shortLabel: "False Onset",
    description:
      "Probability of an initial pre-monsoon shower burst followed by a ≥6-day post-sowing dry spell.",
    unit: "%",
  },
  {
    id: "dry_spell",
    code: "C",
    label: "C. Dry Spell Risk",
    shortLabel: "Dry Spell",
    description:
      "Probability of a prolonged break-monsoon phase (≥7 consecutive or near-consecutive dry days < 2.5 mm/day).",
    unit: "%",
  },
  {
    id: "heavy_rain",
    code: "D",
    label: "D. Heavy Rain Risk",
    shortLabel: "Heavy Rain",
    description:
      "Probability of an IMD Heavy Rainfall event (≥64.5 mm/day) within the selected forecast window.",
    unit: "%",
  },
  {
    id: "expected_rainfall",
    code: "E",
    label: "E. Expected Rainfall",
    shortLabel: "Expected Rainfall",
    description:
      "Cumulative block-level expected rainfall (mm) predicted by the XGBoost regression head (no spatial contour interpolation).",
    unit: "mm",
  },
  {
    id: "rainfall_anomaly",
    code: "F",
    label: "F. Rainfall Anomaly",
    shortLabel: "Rainfall Anomaly",
    description:
      "Percentage departure of predicted cumulative rainfall from block climatological normal.",
    unit: "%",
  },
  {
    id: "overall_agricultural_risk",
    code: "G",
    label: "G. Overall Agricultural Risk",
    shortLabel: "Overall Agri Risk",
    description:
      "Explicit weighted composite: 0.25×(1−P_onset) + 0.30×P_false_onset + 0.30×P_dry_spell + 0.15×P_heavy_rain.",
    unit: "%",
  },
];

/**
 * Checks if a [lon, lat] pair lies within valid WGS84 / EPSG:4326 coordinates for India / Uttar Pradesh.
 */
export function isValidWGS84Coord(lon: unknown, lat: unknown): boolean {
  if (typeof lon !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return false;
  // Valid WGS84 bounds & India regional sanity bounds (Lon 68..98 E, Lat 6..38 N)
  return lon >= 68.0 && lon <= 98.0 && lat >= 6.0 && lat <= 38.0;
}

/**
 * Validates a GeoJSON Feature's geometry in WGS84 (Point, Polygon, or MultiPolygon).
 */
export function isValidFeatureGeometry(feature: BlockGeoJSONFeature): boolean {
  if (!feature || !feature.geometry || !feature.geometry.type) return false;
  const { type, coordinates } = feature.geometry;
  if (!Array.isArray(coordinates) || coordinates.length === 0) return false;

  if (type === "Point") {
    const [lon, lat] = coordinates as number[];
    return isValidWGS84Coord(lon, lat);
  }

  if (type === "Polygon") {
    const rings = coordinates as number[][][];
    if (!Array.isArray(rings[0]) || rings[0].length < 4) return false;
    return rings[0].every((pt) => Array.isArray(pt) && isValidWGS84Coord(pt[0], pt[1]));
  }

  if (type === "MultiPolygon") {
    const polys = coordinates as number[][][][];
    if (!Array.isArray(polys[0]) || !Array.isArray(polys[0][0]) || polys[0][0].length < 4) {
      return false;
    }
    return polys[0][0].every(
      (pt) => Array.isArray(pt) && isValidWGS84Coord(pt[0], pt[1])
    );
  }

  return false;
}

/**
 * Requirement 4: validateGeoJSON()
 * Validates:
 * - valid GeoJSON FeatureCollection
 * - valid geometry & WGS84 coordinates
 * - no missing block_id
 * - no duplicate block_id
 * - block_id matches expected Supabase location IDs
 */
export function validateGeoJSON(
  input: unknown,
  expectedBlockIds: readonly string[] = EXPECTED_PRAYAGRAJ_BLOCK_IDS
): GISValidationResult {
  if (
    !input ||
    typeof input !== "object" ||
    (input as BlockGeoJSONCollection).type !== "FeatureCollection" ||
    !Array.isArray((input as BlockGeoJSONCollection).features)
  ) {
    return {
      valid: false,
      feature_count: 0,
      matched_locations: 0,
      missing_blocks: [...expectedBlockIds],
      duplicate_blocks: [],
      invalid_geometries: ["root_feature_collection_invalid"],
      geometry_mode: "unavailable",
      status_message: "Boundary data unavailable.",
    };
  }

  const collection = input as BlockGeoJSONCollection;
  const seenBlockIds = new Set<string>();
  const duplicateBlocks = new Set<string>();
  const invalidGeometries: string[] = [];
  let polygonCount = 0;
  let pointCount = 0;

  for (let i = 0; i < collection.features.length; i++) {
    const feat = collection.features[i];
    const blockId = feat?.properties?.block_id
      ? String(feat.properties.block_id).trim().toLowerCase()
      : "";

    if (!blockId) {
      invalidGeometries.push(`feature_index_${i}_missing_block_id`);
      continue;
    }

    if (seenBlockIds.has(blockId)) {
      duplicateBlocks.add(blockId);
    }
    seenBlockIds.add(blockId);

    if (!isValidFeatureGeometry(feat)) {
      invalidGeometries.push(blockId);
    } else if (feat.geometry.type === "Polygon" || feat.geometry.type === "MultiPolygon") {
      polygonCount++;
    } else if (feat.geometry.type === "Point") {
      pointCount++;
    }
  }

  const missingBlocks = expectedBlockIds.filter((id) => !seenBlockIds.has(id));
  const matchedLocations = expectedBlockIds.filter((id) => seenBlockIds.has(id)).length;

  const valid =
    collection.features.length === expectedBlockIds.length &&
    missingBlocks.length === 0 &&
    duplicateBlocks.size === 0 &&
    invalidGeometries.length === 0;

  let geometryMode: "polygon_boundary" | "centroid_fallback" | "unavailable" =
    "unavailable";
  let statusMessage = "Boundary data unavailable.";

  if (valid) {
    if (polygonCount === expectedBlockIds.length) {
      geometryMode = "polygon_boundary";
      statusMessage = "Authoritative administrative block polygons active (WGS84 / EPSG:4326).";
    } else if (pointCount > 0) {
      geometryMode = "centroid_fallback";
      statusMessage = "Boundary data unavailable — displaying block centroids.";
    }
  }

  return {
    valid,
    feature_count: collection.features.length,
    matched_locations: matchedLocations,
    missing_blocks: missingBlocks,
    duplicate_blocks: Array.from(duplicateBlocks),
    invalid_geometries: invalidGeometries,
    geometry_mode: geometryMode,
    status_message: statusMessage,
  };
}

/**
 * Formats an ISO timestamp into a human-readable relative recency string
 * ("Updated X mins ago" / "Updated X hours ago") per Requirement 25.
 */
export function formatUpdatedAgo(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return "Timestamp unavailable";
  const parsed = Date.parse(isoTimestamp);
  if (Number.isNaN(parsed)) return isoTimestamp;

  const diffMs = Math.max(0, Date.now() - parsed);
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 2) return "Updated just now";
  if (diffMins < 60) return `Updated ${diffMins} mins ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `Updated ${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `Updated ${diffDays} ${diffDays === 1 ? "day" : "days"} ago`;
}
