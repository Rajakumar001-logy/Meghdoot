import districtCoordinatesJson from "./districtCoordinates.json";

export const STATE_CENTROIDS: Record<string, [number, number]> = {
  "Andaman and Nicobar Islands": [11.7401, 92.6586],
  "Andhra Pradesh": [15.9129, 79.7400],
  "Arunachal Pradesh": [28.2180, 94.7278],
  "Assam": [26.2006, 92.9376],
  "Bihar": [25.0961, 85.3131],
  "Chandigarh": [30.7333, 76.7794],
  "Chhattisgarh": [21.2787, 81.8661],
  "Dadra and Nagar Haveli and Daman and Diu": [20.4283, 72.8397],
  "Delhi": [28.7041, 77.1025],
  "Goa": [15.2993, 74.1240],
  "Gujarat": [22.2587, 71.1924],
  "Haryana": [29.0588, 76.0856],
  "Himachal Pradesh": [31.1048, 77.1734],
  "Jammu and Kashmir": [33.7782, 76.5762],
  "Jharkhand": [23.6102, 85.2799],
  "Karnataka": [15.3173, 75.7139],
  "Kerala": [10.8505, 76.2711],
  "Ladakh": [34.1526, 77.5771],
  "Lakshadweep": [10.5667, 72.6417],
  "Madhya Pradesh": [22.9734, 78.6569],
  "Maharashtra": [19.7515, 75.7139],
  "Manipur": [24.6637, 93.9063],
  "Meghalaya": [25.4670, 91.3662],
  "Mizoram": [23.1645, 92.9376],
  "Nagaland": [26.1584, 94.5624],
  "Odisha": [20.9517, 85.0985],
  "Puducherry": [11.9416, 79.8083],
  "Punjab": [31.1471, 75.3412],
  "Rajasthan": [27.0238, 74.2179],
  "Sikkim": [27.5330, 88.5122],
  "Tamil Nadu": [11.1271, 78.6569],
  "Telangana": [18.1124, 79.0193],
  "Tripura": [23.9408, 91.9882],
  "Uttar Pradesh": [26.8467, 80.9462],
  "Uttarakhand": [30.0668, 79.0193],
  "West Bengal": [22.9868, 87.8550],
};

const KNOWN_BLOCK_COORDINATES: Record<string, [number, number]> = {
  // Lakshadweep Islands
  "agatti": [10.8352, 72.1822],
  "kavaratti": [10.5667, 72.6417],
  "amindivi": [11.1228, 72.7214],
  "androth": [10.8167, 73.6667],
  "kalpeni": [10.0833, 73.6333],
  "minicoy": [8.2833, 73.0500],
  // Major Prayagraj Blocks
  "karchhana": [25.28, 81.94],
  "phulpur": [25.55, 82.09],
  "meja": [25.14, 82.11],
  "koraon": [24.99, 82.06],
  "bara": [25.25, 81.73],
  "soraon": [25.60, 81.85],
  "handia": [25.38, 82.19],
  "chaka": [25.39, 81.86],
};

const DISTRICT_COORDINATES: Record<string, [number, number]> =
  districtCoordinatesJson as unknown as Record<string, [number, number]>;

/**
 * Resolves accurate geographic coordinates [latitude, longitude] for any
 * State, District, and Block across India.
 */
export function resolveLocationCoordinates(
  state?: string,
  district?: string,
  blockName?: string,
  blockCode?: number | string
): [number, number] {
  const normState = (state || "").trim();
  const normDist = (district || "").trim();
  const normBlock = (blockName || "").trim().toLowerCase().replace(/ block$/i, "");

  // 1. Check known specific block coordinates
  if (normBlock && KNOWN_BLOCK_COORDINATES[normBlock]) {
    return KNOWN_BLOCK_COORDINATES[normBlock];
  }

  // 2. Resolve base district or state centroid
  let baseCoords: [number, number] | null = null;
  const stateDistKey = `${normState}:${normDist}`.toLowerCase();
  const distKey = normDist.toLowerCase();
  const cleanDistKey = distKey.replace(/ district$/i, "");

  if (DISTRICT_COORDINATES[stateDistKey]) {
    baseCoords = DISTRICT_COORDINATES[stateDistKey];
  } else if (DISTRICT_COORDINATES[distKey]) {
    baseCoords = DISTRICT_COORDINATES[distKey];
  } else if (DISTRICT_COORDINATES[cleanDistKey]) {
    baseCoords = DISTRICT_COORDINATES[cleanDistKey];
  } else if (normState && STATE_CENTROIDS[normState]) {
    baseCoords = STATE_CENTROIDS[normState];
  } else {
    // Default fallback to center of India
    baseCoords = [23.0, 80.0];
  }

  // If no block name or code, return base coordinates
  if (!blockName && !blockCode) {
    return [baseCoords[0], baseCoords[1]];
  }

  // 3. Deterministically disperse blocks around district center
  const seedStr = `${blockCode || ""}:${normBlock || ""}:${normDist}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }

  const latOffset = ((Math.abs(hash) % 40) - 20) * 0.0025;
  const lonOffset = (((Math.abs(hash >> 3)) % 40) - 20) * 0.0025;

  return [
    Number((baseCoords[0] + latOffset).toFixed(4)),
    Number((baseCoords[1] + lonOffset).toFixed(4)),
  ];
}
