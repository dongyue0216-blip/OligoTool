import subprocess
import sys
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parents[1])

TESTS = [
    "tests/test_bamboo_layout.py",
    "tests/test_layout_v191.py",
    "tests/test_end_to_end.py",
    "tests/ui_smoke.py",
    "tests/test_chemical_repair.py",
    "tests/test_v18_foundation.py",
    "tests/test_mass.py",
    "tests/test_backbone.py",
    "tests/test_structure.py",
        "tests/test_cdxml.py",
    "tests/test_od.py",
    "tests/test_custom_library.py",
    "tests/test_attachment_markers.py",
    "tests/test_marker_compatibility.py",
    "tests/test_marker_ui.py",
    "tests/test_bracket_custom.py",
]

failed = False
for test in TESTS:
    print(f"\n>>> Running {test}", flush=True)
    result = subprocess.run([sys.executable, test], env={**__import__("os").environ, "PYTHONPATH": "."})
    print(f"SUITE RESULT: {test}: {result.returncode}", flush=True)
    if result.returncode != 0:
        failed = True

print("\n" + "=" * 70)
if failed:
    print("OVERALL RESULT: ONE OR MORE TEST SUITES FAILED")
    raise SystemExit(1)
print("OVERALL RESULT: ALL TEST SUITES PASSED")
