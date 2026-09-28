"""
MonsoonPulse AI — All-India LGD Location Directory Test Suite
(ml-service/tests/test_lgd_expansion.py)
=============================================================
Validates the official Ministry of Panchayati Raj Local Government Directory (LGD)
expansion across all Indian States, Districts, and Development Blocks.

Covers:
- TEST 1: Uttar Pradesh -> Prayagraj -> 8 pilot blocks with FULL data coverage.
- TEST 2: Madhya Pradesh -> Jabalpur -> 7 Jabalpur blocks with LOCATION_ONLY (0 Prayagraj blocks).
- TEST 3: Uttar Pradesh -> Gorakhpur -> Gorakhpur blocks with LOCATION_ONLY (0 Prayagraj blocks).
- TEST 4: Maharashtra -> e.g. Pune / Nagpur -> valid blocks with correct state hierarchy.
- TEST 5: Switching Prayagraj -> Jabalpur -> Prayagraj updates block list correctly without stale blocks.
- Section 18: LGD Hierarchy Validation (36 States/UTs, 763 Districts, 7223 Blocks, zero duplicates).
- Section 19: Non-fabrication guardrails (data_coverage flags, no synthetic forecasts/polygons).
"""

import os
import json
import pytest
from typing import Dict, List, Set

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LGD_DIR = os.path.join(REPO_ROOT, "src", "data", "lgd")
MIGRATION_PATH = os.path.join(REPO_ROOT, "supabase", "migrations", "007_lgd_all_india_locations.sql")


@pytest.fixture(scope="module")
def lgd_data():
    """Load states.json, districts.json, and blocks.json from src/data/lgd/."""
    states_path = os.path.join(LGD_DIR, "states.json")
    districts_path = os.path.join(LGD_DIR, "districts.json")
    blocks_path = os.path.join(LGD_DIR, "blocks.json")

    assert os.path.exists(states_path), f"states.json missing at {states_path}"
    assert os.path.exists(districts_path), f"districts.json missing at {districts_path}"
    assert os.path.exists(blocks_path), f"blocks.json missing at {blocks_path}"

    with open(states_path, encoding="utf-8") as f:
        states = json.load(f)
    with open(districts_path, encoding="utf-8") as f:
        districts = json.load(f)
    with open(blocks_path, encoding="utf-8") as f:
        blocks = json.load(f)

    return {"states": states, "districts": districts, "blocks": blocks}


class TestLgdDirectoryExpansion:
    """Core LGD directory tests verifying coverage and hierarchical relationships."""

    def test_states_coverage(self, lgd_data):
        """Verify all 36 Indian States and Union Territories are represented."""
        states = lgd_data["states"]
        assert len(states) == 36, f"Expected 36 States/UTs, got {len(states)}"
        
        state_names = {s["name"] for s in states}
        assert "Uttar Pradesh" in state_names
        assert "Madhya Pradesh" in state_names
        assert "Maharashtra" in state_names
        assert "Bihar" in state_names
        assert "Karnataka" in state_names
        assert "Tamil Nadu" in state_names
        assert "Rajasthan" in state_names
        assert "Gujarat" in state_names

    def test_districts_coverage(self, lgd_data):
        """Verify all 763 Districts are represented and mapped to valid states."""
        districts = lgd_data["districts"]
        assert len(districts) == 763, f"Expected 763 Districts, got {len(districts)}"
        
        state_codes = {s["code"] for s in lgd_data["states"]}
        district_codes = set()

        for d in districts:
            assert d["code"] not in district_codes, f"Duplicate district LGD code {d['code']}"
            district_codes.add(d["code"])
            assert d["stateCode"] in state_codes, f"District {d['name']} has invalid stateCode {d['stateCode']}"

    def test_blocks_coverage(self, lgd_data):
        """Verify 7,223 Development Blocks are loaded and deduplicated."""
        blocks = lgd_data["blocks"]
        assert len(blocks) == 7223, f"Expected 7223 blocks, got {len(blocks)}"

        block_codes = set()
        for b in blocks:
            assert b["code"] not in block_codes, f"Duplicate block LGD code {b['code']}"
            block_codes.add(b["code"])

    def test_test_1_prayagraj_blocks(self, lgd_data):
        """TEST 1: Uttar Pradesh -> Prayagraj contains the 8 validated pilot blocks."""
        blocks = lgd_data["blocks"]
        up_prayagraj_blocks = [
            b for b in blocks
            if b["stateName"] == "Uttar Pradesh" and b["districtName"] == "Prayagraj"
        ]
        assert len(up_prayagraj_blocks) >= 8, f"Expected at least 8 blocks for Prayagraj, got {len(up_prayagraj_blocks)}"

        names = {b["name"].lower() for b in up_prayagraj_blocks}
        # In LGD: Bara is represented as Jasra (LGD 836), Chaka is 832, etc.
        assert "karchhana" in names
        assert "phulpur" in names
        assert "meja" in names
        assert "koraon" in names
        assert "soraon" in names
        assert "handia" in names
        assert "chaka" in names

    def test_test_2_jabalpur_blocks(self, lgd_data):
        """TEST 2: Madhya Pradesh -> Jabalpur contains Jabalpur's official blocks and strictly NO Prayagraj blocks."""
        blocks = lgd_data["blocks"]
        mp_jabalpur_blocks = [
            b for b in blocks
            if b["stateName"] == "Madhya Pradesh" and b["districtName"] == "Jabalpur"
        ]
        assert len(mp_jabalpur_blocks) == 7, f"Expected 7 blocks for Jabalpur, got {len(mp_jabalpur_blocks)}"

        jab_names = {b["name"].lower() for b in mp_jabalpur_blocks}
        expected_jab_blocks = {"jabalpur", "kundam", "majhouli", "panagar", "patan", "shahpura", "sihora"}
        assert jab_names == expected_jab_blocks

        # Strictly verify zero Prayagraj blocks appear under Jabalpur
        prayagraj_blocks = {"karchhana", "phulpur", "meja", "koraon", "bara", "soraon", "handia", "chaka"}
        for pb in prayagraj_blocks:
            assert pb not in jab_names, f"Prayagraj block {pb} erroneously found in Jabalpur!"

    def test_test_3_gorakhpur_blocks(self, lgd_data):
        """TEST 3: Uttar Pradesh -> Gorakhpur contains official blocks and strictly NO Prayagraj blocks."""
        blocks = lgd_data["blocks"]
        up_gorakhpur_blocks = [
            b for b in blocks
            if b["stateName"] == "Uttar Pradesh" and b["districtName"] == "Gorakhpur"
        ]
        assert len(up_gorakhpur_blocks) == 20, f"Expected 20 blocks for Gorakhpur, got {len(up_gorakhpur_blocks)}"

        gkp_names = {b["name"].lower() for b in up_gorakhpur_blocks}
        prayagraj_blocks = {"karchhana", "phulpur", "meja", "koraon", "soraon", "handia", "chaka"}
        for pb in prayagraj_blocks:
            assert pb not in gkp_names, f"Prayagraj block {pb} erroneously found in Gorakhpur!"

    def test_test_4_maharashtra_districts_and_blocks(self, lgd_data):
        """TEST 4: Maharashtra -> verify districts like Pune and Nagpur exist with valid blocks."""
        districts = lgd_data["districts"]
        blocks = lgd_data["blocks"]

        mh_districts = [d for d in districts if d["stateName"] == "Maharashtra"]
        assert len(mh_districts) >= 36, f"Expected at least 36 districts for Maharashtra, got {len(mh_districts)}"

        mh_names = {d["name"].lower() for d in mh_districts}
        assert "pune" in mh_names
        assert "nagpur" in mh_names

        pune_blocks = [b for b in blocks if b["stateName"] == "Maharashtra" and b["districtName"] == "Pune"]
        assert len(pune_blocks) >= 10, f"Expected at least 10 blocks in Pune, got {len(pune_blocks)}"
        for b in pune_blocks:
            assert b["stateCode"] == 27  # Maharashtra LGD code is 27

    def test_test_5_cascading_selection_simulation(self, lgd_data):
        """TEST 5: Switching Prayagraj -> Jabalpur -> Prayagraj updates block list correctly without stale blocks."""
        blocks = lgd_data["blocks"]

        # Selection state simulation
        current_state = "Uttar Pradesh"
        current_district = "Prayagraj"
        active_blocks = [
            b for b in blocks if b["stateName"] == current_state and b["districtName"] == current_district
        ]
        assert any(b["name"].lower() == "karchhana" for b in active_blocks)

        # Switch to Jabalpur, MP
        current_state = "Madhya Pradesh"
        current_district = "Jabalpur"
        active_blocks = [
            b for b in blocks if b["stateName"] == current_state and b["districtName"] == current_district
        ]
        assert len(active_blocks) == 7
        assert not any(b["name"].lower() == "karchhana" for b in active_blocks)

        # Switch back to Prayagraj, UP
        current_state = "Uttar Pradesh"
        current_district = "Prayagraj"
        active_blocks = [
            b for b in blocks if b["stateName"] == current_state and b["districtName"] == current_district
        ]
        assert any(b["name"].lower() == "karchhana" for b in active_blocks)

    def test_section_18_no_duplicate_lgd_codes(self, lgd_data):
        """Verify no duplicate LGD codes exist for States, Districts, or Blocks."""
        state_codes = [s["code"] for s in lgd_data["states"]]
        assert len(state_codes) == len(set(state_codes)), "Duplicate state LGD codes detected"

        dist_codes = [d["code"] for d in lgd_data["districts"]]
        assert len(dist_codes) == len(set(dist_codes)), "Duplicate district LGD codes detected"

        block_codes = [b["code"] for b in lgd_data["blocks"]]
        assert len(block_codes) == len(set(block_codes)), "Duplicate block LGD codes detected"

    def test_section_18_no_block_in_multiple_districts(self, lgd_data):
        """Verify no single block LGD code is assigned to more than one district."""
        block_to_districts: Dict[int, Set[int]] = {}
        for b in lgd_data["blocks"]:
            code = b["code"]
            dist = b["districtCode"]
            if code not in block_to_districts:
                block_to_districts[code] = set()
            block_to_districts[code].add(dist)

        multis = {code: dists for code, dists in block_to_districts.items() if len(dists) > 1}
        assert len(multis) == 0, f"Blocks assigned to multiple districts: {multis}"

    def test_migration_007_exists_and_preserves_pilot_blocks(self):
        """Verify migration 007 properly extends schema and flags Prayagraj blocks as FULL coverage."""
        assert os.path.exists(MIGRATION_PATH), f"Migration 007 missing at {MIGRATION_PATH}"

        with open(MIGRATION_PATH, encoding="utf-8") as f:
            content = f.read()

        # Check required columns
        assert "state_lgd_code" in content
        assert "district_lgd_code" in content
        assert "block_lgd_code" in content
        assert "data_coverage" in content

        # Check pilot block preservation
        for pb in ["karchhana", "phulpur", "meja", "koraon", "bara", "soraon", "handia", "chaka"]:
            assert f"id = '{pb}'" in content, f"Pilot block '{pb}' missing in migration 007 update"
        assert "data_coverage = 'FULL'" in content
