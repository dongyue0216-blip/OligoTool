"""Independent dual-path validation for compact oligonucleotide notation.

Path A scans the raw sequence itself and sums prebuilt residue contributions plus
linkage deltas. It deliberately does NOT call parser.parse_oligo().

Path B uses parser.parse_oligo() and the structural chemistry engine in
chemistry.calculate_oligo_properties().

Agreement catches parser/scanner/assembly regressions. It does not prove that a
shared library formula is chemically correct; reference regression tests remain
necessary for that purpose.
"""

from chemistry import (
    EXACT_ATOMIC_MASS,
    AVERAGE_ATOMIC_MASS,
    add_formula,
    subtract_formula,
    parse_formula,
    formula_to_string,
    calculate_mass,
    calculate_oligo_properties,
)
from custom_library import custom_residues
from parser import (
    BASE_LIBRARY, SUGAR_LIBRARY, LINKAGE_LIBRARY, LINKAGE_SYMBOLS,
    DNA_BARE_BASES, DNA_SUGAR_CODE, parse_oligo,
)

DEFAULT_MASS_TOLERANCE_DA = 1e-6


def _residue_formula_table():
    """Build complete neutral nucleoside formulas once from the chemistry libraries."""
    water = parse_formula("H2O")
    table = {}
    for sugar_code, sugar in SUGAR_LIBRARY.items():
        for base_code, base in BASE_LIBRARY.items():
            formula = {}
            formula = add_formula(formula, parse_formula(base["formula"]))
            formula = add_formula(formula, parse_formula(sugar["formula"]))
            formula = subtract_formula(formula, water)
            table[sugar_code + base_code] = formula
    for code,row in custom_residues().items():
        table[code] = parse_formula(row["formula"])
        if not (code.startswith('[') and code.endswith(']')):
            table['['+code+']'] = parse_formula(row["formula"])
    return table


def direct_scan(sequence):
    """Independent scanner. Bare A/T/G/C maps to internal dA/dT/dG/dC."""
    from terminal_modifications import split_terminals, FORMULA_DELTAS
    sequence, _ = split_terminals(sequence)
    if not sequence:
        raise ValueError("Sequence is empty.")

    residue_table = _residue_formula_table()
    explicit_residue_codes = sorted(residue_table, key=len, reverse=True)
    linkage_symbols = sorted(LINKAGE_SYMBOLS, key=len, reverse=True)
    residues = []
    display_residues = []
    linkages = []
    pos = 0

    while pos < len(sequence):
        # DNA bare notation is handled independently from parser.parse_oligo().
        char = sequence[pos]
        explicit_residue = next((code for code in explicit_residue_codes if sequence.startswith(code, pos)), None)
        if char in DNA_BARE_BASES and explicit_residue is None:
            residue = DNA_SUGAR_CODE + char
            if residue not in residue_table:
                raise ValueError(f"DNA residue '{char}' is not defined in the chemistry libraries.")
            display = char
            pos += 1
        else:
            residue = next(
                (code for code in explicit_residue_codes if sequence.startswith(code, pos)),
                None,
            )
            if residue is None:
                raise ValueError(f"Cannot recognize residue near: '{sequence[pos:]}'")
            display = residue
            pos += len(residue)

        residues.append(residue)
        display_residues.append(display)

        if pos >= len(sequence):
            break

        explicit = next((symbol for symbol in linkage_symbols if sequence.startswith(symbol, pos)), None)
        if explicit is not None:
            linkages.append(LINKAGE_SYMBOLS[explicit])
            pos += len(explicit)
            if pos >= len(sequence):
                raise ValueError("Sequence cannot end with a linkage symbol.")
        else:
            if "PO" not in LINKAGE_LIBRARY:
                raise ValueError("PO is not defined in linkages.csv.")
            linkages.append("PO")

    if len(linkages) != len(residues) - 1:
        raise ValueError("Sequence format error: number of linkages does not match residues.")
    return residues, linkages, display_residues

def calculate_direct_properties(sequence):
    """Path A: raw sequence -> complete residue contributions -> linkage deltas."""
    residues, linkages, display_residues = direct_scan(sequence)
    residue_table = _residue_formula_table()
    total = {}

    for residue in residues:
        total = add_formula(total, residue_table[residue])

    for linkage_code in linkages:
        data = LINKAGE_LIBRARY[linkage_code]
        total = add_formula(total, parse_formula(data.get("formula_add", "")))
        remove = parse_formula(data.get("formula_remove", ""))
        if remove:
            total = subtract_formula(total, remove)

    from terminal_modifications import split_terminals, FORMULA_DELTAS
    for code in split_terminals(sequence)[1].values():
        total=add_formula(total,parse_formula(FORMULA_DELTAS[code]))
    return {
        "sequence": sequence,
        "formula": formula_to_string(total),
        "formula_dict": total,
        "exact_mass": calculate_mass(total, EXACT_ATOMIC_MASS),
        "average_mw": calculate_mass(total, AVERAGE_ATOMIC_MASS),
        "residues": display_residues,
        "internal_residues": residues,
        "linkages": linkages,
    }


def validate_sequence(sequence, mass_tolerance_da=DEFAULT_MASS_TOLERANCE_DA):
    """Syntax-check and cross-validate two independent calculation paths."""
    # Syntax validation through both parsers. Any exception is returned as invalid input.
    try:
        residues_b, linkages_b = parse_oligo(sequence)
        direct = calculate_direct_properties(sequence)
        structural = calculate_oligo_properties(sequence)
    except Exception as exc:
        return {
            "status": "INVALID",
            "valid": False,
            "message": str(exc),
            "sequence": sequence,
        }

    formula_match = direct["formula_dict"] == structural["formula_dict"]
    exact_mass_error = abs(direct["exact_mass"] - structural["exact_mass"])
    average_mass_error = abs(direct["average_mw"] - structural["average_mw"])
    mass_match = exact_mass_error <= mass_tolerance_da
    valid = formula_match and mass_match

    return {
        "status": "PASS" if valid else "FAIL",
        "valid": valid,
        "sequence": sequence,
        "message": (
            "Dual-path validation passed."
            if valid
            else "Calculation paths disagree; review the sequence or chemistry definitions."
        ),
        "formula_match": formula_match,
        "exact_mass_error_da": exact_mass_error,
        "average_mass_error": average_mass_error,
        "tolerance_da": mass_tolerance_da,
        "direct": direct,
        "structural": structural,
        "parsed_residues": residues_b,
        "parsed_linkages": linkages_b,
    }
