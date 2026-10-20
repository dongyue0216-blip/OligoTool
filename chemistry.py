import re
from custom_library import get_entry

from parser import (
    parse_oligo,
    BASE_LIBRARY,
    SUGAR_LIBRARY,
    LINKAGE_LIBRARY,
)

EXACT_ATOMIC_MASS = {
    "H": 1.00782503223,
    "C": 12.00000000000,
    "N": 14.00307400443,
    "O": 15.99491461957,
    "P": 30.97376199842,
    "S": 31.97207117440,
    "F": 18.99840316273,
}

AVERAGE_ATOMIC_MASS = {
    "H": 1.008,
    "C": 12.011,
    "N": 14.007,
    "O": 15.999,
    "P": 30.973761998,
    "S": 32.06,
    "F": 18.998403163,
}


def parse_formula(formula):
    """Convert a molecular formula string (e.g. C5H10O5) to atom counts."""
    formula = (formula or "").strip()
    if not formula:
        return {}

    pattern = r"([A-Z][a-z]?)(\d*)"
    matches = re.findall(pattern, formula)
    reconstructed = "".join(element + count for element, count in matches)
    if reconstructed != formula:
        raise ValueError(f"Cannot parse molecular formula '{formula}'.")

    result = {}
    for element, count in matches:
        if element not in EXACT_ATOMIC_MASS:
            raise ValueError(f"Element '{element}' is not currently supported.")
        number = int(count) if count else 1
        result[element] = result.get(element, 0) + number
    return result


def add_formula(total, addition, multiplier=1):
    result = total.copy()
    for element, count in addition.items():
        result[element] = result.get(element, 0) + count * multiplier
        if result[element] == 0:
            del result[element]
        elif result[element] < 0:
            raise ValueError(f"Negative atom count generated for {element}.")
    return result


def subtract_formula(total, subtraction):
    result = total.copy()
    for element, count in subtraction.items():
        new_count = result.get(element, 0) - count
        if new_count < 0:
            raise ValueError(f"Negative atom count generated for {element}.")
        if new_count == 0:
            result.pop(element, None)
        else:
            result[element] = new_count
    return result


def formula_to_string(formula):
    preferred_order = ["C", "H", "N", "O", "P", "S", "F"]
    result = ""
    for element in preferred_order:
        if element in formula:
            count = formula[element]
            result += element + (str(count) if count != 1 else "")
    for element in sorted(formula):
        if element not in preferred_order:
            count = formula[element]
            result += element + (str(count) if count != 1 else "")
    return result


def calculate_mass(formula, mass_table):
    return sum(mass_table[element] * count for element, count in formula.items())


def build_nucleoside_formula(base_code, sugar_code):
    """Component route for one neutral nucleoside: base + sugar - H2O."""
    formula = {}
    formula = add_formula(formula, parse_formula(BASE_LIBRARY[base_code]["formula"]))
    formula = add_formula(formula, parse_formula(SUGAR_LIBRARY[sugar_code]["formula"]))
    formula = subtract_formula(formula, parse_formula("H2O"))
    return formula


def apply_linkage_formula(total_formula, linkage_code):
    """Apply net atom changes for one internucleotide linkage."""
    linkage_data = LINKAGE_LIBRARY[linkage_code]
    result = add_formula(total_formula, parse_formula(linkage_data.get("formula_add", "")))
    remove = parse_formula(linkage_data.get("formula_remove", ""))
    if remove:
        result = subtract_formula(result, remove)
    return result


def calculate_oligo_formula(sequence):
    """Structural route: parse -> base/sugar components -> linkages -> formula."""
    residues, linkages = parse_oligo(sequence)
    total_formula = {}

    for residue in residues:
        if residue.get("custom_code"):
            row = get_entry(residue["custom_code"], "Residue")
            total_formula = add_formula(total_formula, parse_formula(row["formula"]))
        else:
            total_formula = add_formula(total_formula, build_nucleoside_formula(residue["base"], residue["sugar"]))

    for linkage in linkages:
        total_formula = apply_linkage_formula(total_formula, linkage["code"])

    from terminal_modifications import split_terminals, FORMULA_DELTAS
    for code in split_terminals(sequence)[1].values():
        total_formula=add_formula(total_formula, parse_formula(FORMULA_DELTAS[code]))
    return total_formula


def calculate_oligo_properties(sequence):
    formula = calculate_oligo_formula(sequence)
    return {
        "sequence": sequence,
        "formula": formula_to_string(formula),
        "formula_dict": formula,
        "exact_mass": calculate_mass(formula, EXACT_ATOMIC_MASS),
        "average_mw": calculate_mass(formula, AVERAGE_ATOMIC_MASS),
    }


def print_properties(sequence):
    result = calculate_oligo_properties(sequence)
    print("\n" + "=" * 50)
    print(f"Sequence:      {result['sequence']}")
    print(f"Formula:       {result['formula']}")
    print(f"Exact mass:    {result['exact_mass']:.6f} Da")
    print(f"Average MW:    {result['average_mw']:.3f} g/mol")


if __name__ == "__main__":
    for sequence in [
        "rA", "rC", "rG", "rU",
        "fA", "fC", "fG", "fU",
        "mA", "mC", "mG", "mU",
        "rArA", "rA*rA", "rA**rA", "rA*rCfG**mU",
    ]:
        print_properties(sequence)
