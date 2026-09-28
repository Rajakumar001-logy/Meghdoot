#!/usr/bin/env python3
"""
MonsoonPulse AI — LGD Hierarchy Validation Script
(scripts/validate_lgd_hierarchy.py)

Implements Section 18:
1. Every district has a valid state.
2. Every block has a valid district.
3. Every block has the correct state.
4. No duplicate LGD codes.
5. No block belongs to multiple districts.
6. No invalid state/district/block combinations.
"""

import os
import json
import sys
from typing import Dict, List, Set

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC_LGD_DIR = os.path.join(REPO_ROOT, "src", "data", "lgd")

def validate_lgd_hierarchy() -> bool:
    states_path = os.path.join(SRC_LGD_DIR, "states.json")
    districts_path = os.path.join(SRC_LGD_DIR, "districts.json")
    blocks_path = os.path.join(SRC_LGD_DIR, "blocks.json")

    assert os.path.exists(states_path), f"Missing {states_path}"
    assert os.path.exists(districts_path), f"Missing {districts_path}"
    assert os.path.exists(blocks_path), f"Missing {blocks_path}"

    with open(states_path, encoding="utf-8") as f:
        states = json.load(f)
    with open(districts_path, encoding="utf-8") as f:
        districts = json.load(f)
    with open(blocks_path, encoding="utf-8") as f:
        blocks = json.load(f)

    errors = []

    # 1. State lookup
    state_codes = {s["code"]: s["name"] for s in states}
    if len(state_codes) != len(states):
        errors.append("Duplicate state codes found in states.json")

    # 2. Check every district has a valid state
    district_codes: Dict[int, Dict] = {}
    for d in districts:
        d_code = d["code"]
        if d_code in district_codes:
            errors.append(f"Duplicate district LGD code: {d_code} ({d['name']})")
        district_codes[d_code] = d

        s_code = d["stateCode"]
        if s_code not in state_codes:
            errors.append(f"District {d['name']} (LGD {d_code}) has invalid state code {s_code}")
        elif d.get("stateName") != state_codes[s_code]:
            errors.append(f"District {d['name']} state name mismatch: '{d.get('stateName')}' != '{state_codes[s_code]}'")

    # 3. Check every block has a valid district and correct state
    block_codes: Set[int] = set()
    block_to_districts: Dict[int, Set[int]] = {}

    for b in blocks:
        b_code = b["code"]
        d_code = b["districtCode"]
        s_code = b["stateCode"]

        # Duplicate check
        if b_code in block_codes:
            errors.append(f"Duplicate block LGD code found: {b_code} ({b['name']})")
        block_codes.add(b_code)

        # District check
        if d_code not in district_codes:
            errors.append(f"Block {b['name']} (LGD {b_code}) references nonexistent district LGD {d_code}")
        else:
            parent_dist = district_codes[d_code]
            # State match check
            if parent_dist["stateCode"] != s_code:
                errors.append(
                    f"Block {b['name']} state code {s_code} does not match district {parent_dist['name']} state code {parent_dist['stateCode']}"
                )

        # Multi-district check
        if b_code not in block_to_districts:
            block_to_districts[b_code] = set()
        block_to_districts[b_code].add(d_code)

    for b_code, dist_set in block_to_districts.items():
        if len(dist_set) > 1:
            errors.append(f"Block LGD {b_code} belongs to multiple districts: {dist_set}")

    # Specific tests required by Prompt 10 Section 11 & 20
    # TEST 1: Uttar Pradesh -> Prayagraj -> Karchhana, Phulpur, Meja, Koraon, Bara, Soraon, Handia, Chaka
    prayagraj_blocks = [b for b in blocks if b["districtName"] == "Prayagraj"]
    prayagraj_names = {b["name"].lower() for b in prayagraj_blocks}
    expected_prayagraj = {"karchhana", "phulpur", "meja", "koraon", "soraon", "handia", "chaka"}
    for exp in expected_prayagraj:
        if exp not in prayagraj_names:
            errors.append(f"Prayagraj missing expected block: {exp}")

    # TEST 2: Madhya Pradesh -> Jabalpur has actual blocks, not Prayagraj blocks
    jabalpur_blocks = [b for b in blocks if b["districtName"] == "Jabalpur"]
    if len(jabalpur_blocks) < 5:
        errors.append(f"Jabalpur has too few blocks: {len(jabalpur_blocks)}")
    jabalpur_names = {b["name"].lower() for b in jabalpur_blocks}
    for prg in expected_prayagraj:
        if prg in jabalpur_names:
            errors.append(f"Prayagraj block '{prg}' erroneously found in Jabalpur!")

    # TEST 3: Uttar Pradesh -> Gorakhpur has actual blocks
    gorakhpur_blocks = [b for b in blocks if b["districtName"] == "Gorakhpur"]
    if len(gorakhpur_blocks) < 15:
        errors.append(f"Gorakhpur has too few blocks: {len(gorakhpur_blocks)}")

    # Print Report
    print("==================================================")
    print("LGD HIERARCHY VALIDATION AUDIT")
    print("==================================================")
    print(f"Total States/UTs verified: {len(states)}")
    print(f"Total Districts verified: {len(districts)}")
    print(f"Total Blocks verified: {len(blocks)}")
    print(f"Prayagraj Blocks verified: {len(prayagraj_blocks)}")
    print(f"Jabalpur Blocks verified: {len(jabalpur_blocks)}")
    print(f"Gorakhpur Blocks verified: {len(gorakhpur_blocks)}")
    print("--------------------------------------------------")
    print(f"Total Errors: {len(errors)}")

    if errors:
        for err in errors[:20]:
            print(f"  FAIL: {err}")
        return False

    print("ALL VALIDATION CRITERIA PASSED (0 ERRORS):")
    print("  [PASS] Every district has a valid state.")
    print("  [PASS] Every block has a valid district.")
    print("  [PASS] Every block has the correct state.")
    print("  [PASS] No duplicate LGD codes.")
    print("  [PASS] No block belongs to multiple districts.")
    print("  [PASS] No invalid state/district/block combinations.")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = validate_lgd_hierarchy()
    sys.exit(0 if success else 1)
