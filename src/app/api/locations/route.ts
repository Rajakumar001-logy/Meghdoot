import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import statesData from "@/data/lgd/states.json";
import districtsData from "@/data/lgd/districts.json";
import blocksData from "@/data/lgd/blocks.json";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "states";
    const stateParam = searchParams.get("state")?.trim();
    const districtParam = searchParams.get("district")?.trim();
    const stateCodeParam = searchParams.get("state_code");
    const districtCodeParam = searchParams.get("district_code");

    const client = getSupabaseClient();

    // 1. STATES
    if (type === "states") {
      if (client) {
        try {
          const { data, error } = await client
            .from("locations")
            .select("state, state_name, state_lgd_code")
            .not("state", "is", null);
          if (!error && data && data.length > 0) {
            const dbMap = new Map<string, number | undefined>();
            data.forEach((r: any) => {
              const name = (r.state_name || r.state || "").trim();
              if (name && !dbMap.has(name)) {
                dbMap.set(name, r.state_lgd_code || undefined);
              }
            });
            // Merge with canonical LGD states
            statesData.forEach((s) => {
              if (!dbMap.has(s.name)) {
                dbMap.set(s.name, s.code);
              }
            });
            const merged = Array.from(dbMap.entries())
              .map(([name, code]) => ({
                name,
                code: code || statesData.find((s) => s.name.toLowerCase() === name.toLowerCase())?.code || 0,
              }))
              .sort((a, b) => a.name.localeCompare(b.name));
            return NextResponse.json({ success: true, count: merged.length, states: merged });
          }
        } catch {
          // Fallback to local dataset below
        }
      }
      return NextResponse.json({
        success: true,
        count: statesData.length,
        states: statesData,
      });
    }

    // 2. DISTRICTS FOR STATE
    if (type === "districts") {
      if (!stateParam && !stateCodeParam) {
        return NextResponse.json(
          { success: false, error: "Missing required 'state' or 'state_code' parameter" },
          { status: 400 }
        );
      }

      // Filter local LGD districts
      let filteredDistricts = districtsData;
      if (stateCodeParam) {
        const sCode = parseInt(stateCodeParam, 10);
        filteredDistricts = filteredDistricts.filter((d) => d.stateCode === sCode);
      } else if (stateParam) {
        filteredDistricts = filteredDistricts.filter(
          (d) => d.stateName.toLowerCase() === stateParam.toLowerCase()
        );
      }

      if (client && stateParam) {
        try {
          const { data, error } = await client
            .from("locations")
            .select("district, district_name, district_lgd_code, state, state_name")
            .ilike("state", stateParam);
          if (!error && data && data.length > 0) {
            const dbDistNames = new Set(
              data.map((r: any) => (r.district_name || r.district || "").trim()).filter(Boolean)
            );
            // Merge
            const districtList = [...filteredDistricts];
            dbDistNames.forEach((dName) => {
              if (!districtList.some((d) => d.name.toLowerCase() === dName.toLowerCase())) {
                districtList.push({
                  code: 0,
                  name: dName,
                  stateCode: filteredDistricts[0]?.stateCode || 0,
                  stateName: stateParam,
                });
              }
            });
            districtList.sort((a, b) => a.name.localeCompare(b.name));
            return NextResponse.json({
              success: true,
              count: districtList.length,
              districts: districtList,
            });
          }
        } catch {
          // Fallback to local dataset
        }
      }

      return NextResponse.json({
        success: true,
        count: filteredDistricts.length,
        districts: filteredDistricts,
      });
    }

    // 3. BLOCKS FOR DISTRICT
    if (type === "blocks") {
      if (!districtParam && !districtCodeParam) {
        return NextResponse.json(
          { success: false, error: "Missing required 'district' or 'district_code' parameter" },
          { status: 400 }
        );
      }

      // Check Supabase first
      if (client && districtParam) {
        try {
          let query = client
            .from("locations")
            .select(
              "id, state, state_name, state_lgd_code, district, district_name, district_lgd_code, block, block_name, block_lgd_code, data_coverage, latitude, longitude, soil_type"
            )
            .ilike("district", districtParam);
          if (stateParam) {
            query = query.ilike("state", stateParam);
          }
          const { data, error } = await query;
          if (!error && data && data.length > 0) {
            const mapped = data.map((r: any) => ({
              id: r.id,
              code: r.block_lgd_code || 0,
              name: r.block_name || r.block,
              districtCode: r.district_lgd_code || 0,
              districtName: r.district_name || r.district,
              stateCode: r.state_lgd_code || 0,
              stateName: r.state_name || r.state,
              dataCoverage: r.data_coverage || (r.district.toLowerCase() === "prayagraj" ? "FULL" : "LOCATION_ONLY"),
              latitude: r.latitude,
              longitude: r.longitude,
              soilType: r.soil_type,
            }));
            return NextResponse.json({
              success: true,
              count: mapped.length,
              blocks: mapped,
            });
          }
        } catch {
          // Fallback to local dataset below
        }
      }

      // Filter local LGD blocks
      let filteredBlocks = blocksData;
      if (districtCodeParam) {
        const dCode = parseInt(districtCodeParam, 10);
        filteredBlocks = filteredBlocks.filter((b) => b.districtCode === dCode);
      } else if (districtParam) {
        filteredBlocks = filteredBlocks.filter(
          (b) => b.districtName.toLowerCase() === districtParam.toLowerCase()
        );
        if (stateParam) {
          filteredBlocks = filteredBlocks.filter(
            (b) => b.stateName.toLowerCase() === stateParam.toLowerCase()
          );
        }
      }

      // Ensure Prayagraj maps canonical 8 blocks
      const isPrayagraj = districtParam?.toLowerCase() === "prayagraj" || districtCodeParam === "120";

      return NextResponse.json({
        success: true,
        count: filteredBlocks.length,
        blocks: filteredBlocks.map((b) => ({
          ...b,
          dataCoverage: isPrayagraj && b.id && !b.id.startsWith("lgd-block-") ? "FULL" : b.dataCoverage,
        })),
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid type requested. Must be 'states', 'districts', or 'blocks'." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to resolve locations" },
      { status: 500 }
    );
  }
}
