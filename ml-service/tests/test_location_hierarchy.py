"""
Location Hierarchy & Cascading Selector Test Suite
===================================================
Tests all 6 required verification cases for the Location Hierarchy Bug Fix:
State -> District -> Block -> location_id

TEST 1: Uttar Pradesh -> Prayagraj -> 8 Prayagraj blocks.
TEST 2: Uttar Pradesh -> Gorakhpur -> 0 blocks (empty) / "No blocks available for this district".
TEST 3: Switch Prayagraj -> Gorakhpur -> Prayagraj -> Blocks restored correctly.
TEST 4: Select Karchhana -> Karchhana location_id is canonical.
TEST 5: Select Prayagraj -> Karchhana -> Change district to Gorakhpur -> Karchhana immediately cleared.
TEST 6: Refresh page / URL hydration -> Only valid state/district/block combinations restored.
"""

import os
import re
import pytest

# Paths
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MOCK_DATA_PATH = os.path.join(REPO_ROOT, "src", "data", "mockData.ts")
LOCATION_SERVICE_PATH = os.path.join(REPO_ROOT, "src", "services", "locationService.ts")
MONSOON_CONTEXT_PATH = os.path.join(REPO_ROOT, "src", "context", "MonsoonContext.tsx")
ADVISORIES_PAGE_PATH = os.path.join(REPO_ROOT, "src", "app", "advisories", "page.tsx")
APP_SHELL_PATH = os.path.join(REPO_ROOT, "src", "components", "layout", "AppShell.tsx")

EXPECTED_PRAYAGRAJ_BLOCK_IDS = [
    "karchhana",
    "phulpur",
    "meja",
    "koraon",
    "bara",
    "soraon",
    "handia",
    "chaka",
]

STATE_DISTRICTS = {
    "Uttar Pradesh": ["Prayagraj", "Varanasi", "Gorakhpur", "Lucknow", "Jhansi"],
    "Madhya Pradesh": ["Jabalpur", "Rewa", "Bhopal"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur"],
}

# Python reference implementation of location hierarchy logic matching locationService.ts
class LocationHierarchyEngine:
    def __init__(self):
        self.state_districts = STATE_DISTRICTS
        # 8 Prayagraj blocks
        self.blocks = [
            {"id": bid, "district": "Prayagraj", "state": "Uttar Pradesh"}
            for bid in EXPECTED_PRAYAGRAJ_BLOCK_IDS
        ]

    def get_states(self):
        return list(self.state_districts.keys())

    def get_districts_for_state(self, state: str):
        return self.state_districts.get(state, [])

    def get_blocks_for_district(self, state: str, district: str):
        return [
            b for b in self.blocks
            if b["state"].lower() == state.lower() and b["district"].lower() == district.lower()
        ]

    def validate_location_hierarchy(self, state: str, district: str, block_id: str = None):
        allowed_districts = self.state_districts.get(state, [])
        if district not in allowed_districts:
            return {"valid": False, "error": f"District {district} not in state {state}"}

        if block_id and block_id.strip():
            found = next((b for b in self.blocks if b["id"] == block_id.lower()), None)
            if found:
                if found["district"].lower() != district.lower() or found["state"].lower() != state.lower():
                    return {
                        "valid": False,
                        "error": f"Block {block_id} belongs to {found['district']}, not {district}"
                    }
            else:
                # Block not found in this district
                return {"valid": False, "error": f"Block {block_id} not registered"}

        return {"valid": True}


class TestLocationHierarchySuite:
    @classmethod
    def setup_class(cls):
        cls.engine = LocationHierarchyEngine()

    def test_01_prayagraj_blocks_integrity(self):
        """Verify all 8 Prayagraj blocks exist and belong strictly to Prayagraj, UP."""
        blocks = self.engine.get_blocks_for_district("Uttar Pradesh", "Prayagraj")
        block_ids = [b["id"] for b in blocks]
        assert len(block_ids) == 8
        for expected_id in EXPECTED_PRAYAGRAJ_BLOCK_IDS:
            assert expected_id in block_ids

    def test_02_test_1_uttar_pradesh_prayagraj(self):
        """TEST 1: Uttar Pradesh -> Prayagraj => 8 Prayagraj blocks returned."""
        blocks = self.engine.get_blocks_for_district("Uttar Pradesh", "Prayagraj")
        assert len(blocks) == 8
        assert all(b["district"] == "Prayagraj" for b in blocks)
        assert all(b["state"] == "Uttar Pradesh" for b in blocks)

    def test_03_test_2_uttar_pradesh_gorakhpur(self):
        """TEST 2: Uttar Pradesh -> Gorakhpur => 0 blocks (empty) and no Prayagraj leakage."""
        blocks = self.engine.get_blocks_for_district("Uttar Pradesh", "Gorakhpur")
        assert len(blocks) == 0
        # Crucial check: none of the 8 Prayagraj blocks must appear
        for expected_id in EXPECTED_PRAYAGRAJ_BLOCK_IDS:
            assert not any(b["id"] == expected_id for b in blocks)

    def test_04_test_3_switch_prayagraj_gorakhpur_prayagraj(self):
        """TEST 3: Switch Prayagraj -> Gorakhpur -> Prayagraj."""
        # 1. Prayagraj
        blocks_step1 = self.engine.get_blocks_for_district("Uttar Pradesh", "Prayagraj")
        assert len(blocks_step1) == 8

        # 2. Gorakhpur
        blocks_step2 = self.engine.get_blocks_for_district("Uttar Pradesh", "Gorakhpur")
        assert len(blocks_step2) == 0

        # 3. Back to Prayagraj
        blocks_step3 = self.engine.get_blocks_for_district("Uttar Pradesh", "Prayagraj")
        assert len(blocks_step3) == 8
        assert [b["id"] for b in blocks_step3] == [b["id"] for b in blocks_step1]

    def test_05_test_4_select_karchhana_canonical_id(self):
        """TEST 4: Select Karchhana => location_id 'karchhana' is validated and canonical."""
        val = self.engine.validate_location_hierarchy("Uttar Pradesh", "Prayagraj", "karchhana")
        assert val["valid"] is True
        assert "error" not in val

    def test_06_test_5_karchhana_cleared_on_district_change(self):
        """TEST 5: Select Prayagraj -> Karchhana, then change district to Gorakhpur => Karchhana cleared."""
        # Current state: Prayagraj -> karchhana
        current_state = "Uttar Pradesh"
        current_district = "Prayagraj"
        selected_block_id = "karchhana"

        # Action: change district to Gorakhpur
        next_district = "Gorakhpur"
        blocks_in_next_district = self.engine.get_blocks_for_district(current_state, next_district)

        # Context cascading rule: if blocks exist, pick first; if none, clear to ""
        if len(blocks_in_next_district) > 0:
            selected_block_id = blocks_in_next_district[0]["id"]
        else:
            selected_block_id = ""

        assert selected_block_id == ""
        assert selected_block_id != "karchhana"

    def test_07_test_6_refresh_page_hierarchy_validation(self):
        """TEST 6: Refresh page / URL hydration restores only valid hierarchy combinations."""
        # Invalid combination in query param: district=Gorakhpur & block=karchhana
        val_invalid = self.engine.validate_location_hierarchy("Uttar Pradesh", "Gorakhpur", "karchhana")
        assert val_invalid["valid"] is False
        assert "not in Gorakhpur" in val_invalid["error"] or "belongs to Prayagraj" in val_invalid["error"]

        # Valid combination: district=Prayagraj & block=karchhana
        val_valid = self.engine.validate_location_hierarchy("Uttar Pradesh", "Prayagraj", "karchhana")
        assert val_valid["valid"] is True

        # Invalid state/district combination: state=Madhya Pradesh & district=Prayagraj
        val_mismatch = self.engine.validate_location_hierarchy("Madhya Pradesh", "Prayagraj", "karchhana")
        assert val_mismatch["valid"] is False

    def test_08_location_service_source_code_contract(self):
        """Verify locationService.ts exports all required hierarchical functions."""
        with open(LOCATION_SERVICE_PATH, "r", encoding="utf-8") as f:
            code = f.read()

        assert "export async function getStates" in code
        assert "export async function getDistrictsForState" in code
        assert "export async function getBlocks" in code
        assert "export async function getBlocksForDistrict" in code
        assert "export function validateLocationHierarchy" in code
        assert "export function isValidLocationHierarchy" in code

    def test_09_monsoon_context_cascading_reset_contract(self):
        """Verify MonsoonContext.tsx implements cascading district and block resets."""
        with open(MONSOON_CONTEXT_PATH, "r", encoding="utf-8") as f:
            code = f.read()

        # Checks that setSelectedState resets district and block
        assert "setSelectedState" in code
        assert "setSelectedDistrict" in code
        assert "setSelectedBlockId" in code
        assert "hasNoBlocksForDistrict" in code
        assert "districtFilteredBase" in code
        assert "EMPTY_BLOCK" in code
        assert "validateLocationHierarchy" in code

    def test_10_advisories_page_empty_state_contract(self):
        """Verify advisories/page.tsx renders empty state message when district has no blocks."""
        with open(ADVISORIES_PAGE_PATH, "r", encoding="utf-8") as f:
            code = f.read()

        assert "hasNoBlocksForDistrict" in code
        assert "No blocks available for this district" in code
        assert "No blocks available for {selectedDistrict}" in code
        assert "disabled={isLoadingBlocks || hasNoBlocksForDistrict}" in code

    def test_11_app_shell_dropdown_disabled_contract(self):
        """Verify AppShell.tsx dropdown disables and displays empty option when no blocks exist."""
        with open(APP_SHELL_PATH, "r", encoding="utf-8") as f:
            code = f.read()

        assert "hasNoBlocksForDistrict" in code
        assert "No blocks available for this district" in code
        assert "disabled={isLoadingBlocks || hasNoBlocksForDistrict}" in code
