import csv
import sys
from pathlib import Path

TEST_DIR = Path(__file__).resolve().parent
PROJECT_DIR = TEST_DIR.parent
sys.path.insert(0, str(PROJECT_DIR))

from chemistry import calculate_oligo_properties
from validation import validate_sequence

REFERENCE_FILE = TEST_DIR / "reference_oligos.csv"
MASS_TOLERANCE = 0.00001


def run_tests():
    with open(REFERENCE_FILE, "r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    passed = 0
    failed = 0
    print("\n" + "=" * 76)
    print("Backbone + dual-path regression test")
    print("=" * 76)

    for row in rows:
        seq = row["sequence"].strip()
        expected_formula = row["formula"].strip()
        expected_mass = float(row["exact_mass"])
        result = calculate_oligo_properties(seq)
        validation = validate_sequence(seq)

        ok = (
            result["formula"] == expected_formula
            and abs(result["exact_mass"] - expected_mass) <= MASS_TOLERANCE
            and validation["valid"]
        )
        if ok:
            passed += 1
            print(f"PASS  {seq:<22} {result['formula']:<24} {result['exact_mass']:.6f}")
        else:
            failed += 1
            print(f"FAIL  {seq}")
            print(f"  expected: {expected_formula} / {expected_mass:.6f}")
            print(f"  actual:   {result['formula']} / {result['exact_mass']:.6f}")
            print(f"  dual path status: {validation['status']}")

    invalid_sequences = ["", "rX", "rA*", "rA***rC", "moeA", "moeeA", "ATGX", "ATG*", "A&", "lA&"]
    for seq in invalid_sequences:
        validation = validate_sequence(seq)
        if validation["status"] == "INVALID":
            passed += 1
            print(f"PASS  invalid input rejected: {seq!r}")
        else:
            failed += 1
            print(f"FAIL  invalid input accepted: {seq!r}")

    print("=" * 76)
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total:  {passed + failed}")
    print("=" * 76)
    print("ALL TESTS PASSED" if failed == 0 else "SOME TESTS FAILED")
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if run_tests() else 0)
