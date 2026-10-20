import csv
import sys
from pathlib import Path


# ----------------------------------------
# Make project root importable
# ----------------------------------------

TEST_DIR = Path(__file__).resolve().parent
PROJECT_DIR = TEST_DIR.parent

sys.path.insert(0, str(PROJECT_DIR))


from chemistry import calculate_oligo_properties


REFERENCE_FILE = TEST_DIR / "reference_nucleosides.csv"


MASS_TOLERANCE = 0.00001


def load_reference_data():

    with open(
        REFERENCE_FILE,
        "r",
        encoding="utf-8-sig",
        newline=""
    ) as f:

        reader = csv.DictReader(f)

        return list(reader)


def run_tests():

    rows = load_reference_data()

    passed = 0
    failed = 0

    print()
    print("=" * 70)
    print("Oligo chemistry regression test")
    print("=" * 70)

    for row in rows:

        sequence = row["sequence"].strip()

        expected_formula = row["formula"].strip()

        expected_mass = float(
            row["exact_mass"]
        )

        result = calculate_oligo_properties(
            sequence
        )

        actual_formula = result["formula"]

        actual_mass = result["exact_mass"]

        formula_ok = (
            actual_formula
            == expected_formula
        )

        mass_error = abs(
            actual_mass
            - expected_mass
        )

        mass_ok = (
            mass_error
            <= MASS_TOLERANCE
        )

        if formula_ok and mass_ok:

            passed += 1

            print(
                f"PASS  {sequence:<8} "
                f"{actual_formula:<20} "
                f"{actual_mass:.6f}"
            )

        else:

            failed += 1

            print()
            print(
                f"FAIL  {sequence}"
            )

            print(
                f"  Expected formula: "
                f"{expected_formula}"
            )

            print(
                f"  Actual formula:   "
                f"{actual_formula}"
            )

            print(
                f"  Expected mass:    "
                f"{expected_mass:.6f}"
            )

            print(
                f"  Actual mass:      "
                f"{actual_mass:.6f}"
            )

            print(
                f"  Mass error:       "
                f"{mass_error:.8f} Da"
            )

    print()
    print("=" * 70)

    print(
        f"Passed: {passed}"
    )

    print(
        f"Failed: {failed}"
    )

    print(
        f"Total:  {passed + failed}"
    )

    print("=" * 70)

    if failed == 0:

        print(
            "ALL TESTS PASSED"
        )

    else:

        print(
            "SOME TESTS FAILED"
        )


if __name__ == "__main__":

    run_tests()