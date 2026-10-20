import csv
import re
from pathlib import Path
from custom_library import custom_residues


BASE_DIR = Path(__file__).resolve().parent
LIB_DIR = BASE_DIR / "libraries"


def load_library(filename):
    path = LIB_DIR / filename

    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader)


def load_bases():
    rows = load_library("bases.csv")
    return {
        row["code"].strip(): row
        for row in rows
        if row.get("code")
    }


def load_sugars():
    rows = load_library("sugars.csv")
    return {
        row["code"].strip(): row
        for row in rows
        if row.get("code")
    }


def load_linkages():
    rows = load_library("linkages.csv")

    by_code = {}
    by_symbol = {}

    for row in rows:
        code = row["code"].strip()
        symbol = row.get("symbol", "").strip()

        by_code[code] = row

        if symbol:
            by_symbol[symbol] = code

    return by_code, by_symbol


BASE_LIBRARY = load_bases()
SUGAR_LIBRARY = load_sugars()
LINKAGE_LIBRARY, LINKAGE_SYMBOLS = load_linkages()

# Bare A/T/G/C input is reserved for standard DNA residues.
DNA_BARE_BASES = {"A", "T", "G", "C"}
DNA_SUGAR_CODE = "d"


def parse_oligo(sequence):
    """
    Parse compact oligonucleotide notation using external CSV libraries.

    Current examples:
        rArCrGrU
        fAfCfGfU
        mAmCmGmU
        rA*rCfG**mU

    Linkage:
        no symbol = PO
        *         = PS
        **        = PS2
        &         = MsPA
    """

    from terminal_modifications import split_terminals
    sequence, _ = split_terminals(sequence)

    residues = []
    linkages = []

    pos = 0

    # Sort by length so "**" is tested before "*".
    linkage_symbols = sorted(
        LINKAGE_SYMBOLS.keys(),
        key=len,
        reverse=True
    )

    while pos < len(sequence):

        matched_residue = None

        # User-defined complete residue codes (saved with 5'/3' attachment atoms).
        if not matched_residue:
            custom = custom_residues()
            tokens = {}
            for code in custom:
                tokens[code] = code
                if not (code.startswith('[') and code.endswith(']')):
                    tokens['['+code+']'] = code
            for token in sorted(tokens, key=len, reverse=True):
                custom_code = tokens[token]
                if sequence.startswith(token, pos):
                    row = custom[custom_code]
                    matched_residue = {
                        "residue": custom_code, "internal_residue": custom_code,
                        "sugar": "__custom__", "base": "__custom__",
                        "sugar_name": row.get("name", custom_code), "base_name": "custom",
                        "custom_code": custom_code,
                    }
                    pos += len(token)
                    break

        # Bare A/T/G/C is standard DNA notation. Internally it maps to dA/dT/dG/dC.
        bare_base = sequence[pos] if pos < len(sequence) else ""
        if not matched_residue and bare_base in DNA_BARE_BASES:
            if DNA_SUGAR_CODE not in SUGAR_LIBRARY:
                raise ValueError("DNA sugar code 'd' is not defined in sugars.csv.")
            matched_residue = {
                "residue": bare_base,
                "internal_residue": DNA_SUGAR_CODE + bare_base,
                "sugar": DNA_SUGAR_CODE,
                "base": bare_base,
                "sugar_name": SUGAR_LIBRARY[DNA_SUGAR_CODE]["name"],
                "base_name": BASE_LIBRARY[bare_base]["name"],
            }
            pos += 1

        # Otherwise try every registered explicit sugar code + base code combination.
        if not matched_residue:
            for sugar_code in sorted(SUGAR_LIBRARY.keys(), key=len, reverse=True):
                for base_code in sorted(BASE_LIBRARY.keys(), key=len, reverse=True):
                    residue_code = sugar_code + base_code
                    if sequence.startswith(residue_code, pos):
                        matched_residue = {
                            "residue": residue_code,
                            "internal_residue": residue_code,
                            "sugar": sugar_code,
                            "base": base_code,
                            "sugar_name": SUGAR_LIBRARY[sugar_code]["name"],
                            "base_name": BASE_LIBRARY[base_code]["name"],
                        }
                        pos += len(residue_code)
                        break
                if matched_residue:
                    break

        if not matched_residue:
            raise ValueError(
                f"Cannot recognize residue near: '{sequence[pos:]}'"
            )

        residues.append(matched_residue)

        # Final residue has no outgoing linkage.
        if pos >= len(sequence):
            break

        matched_linkage = False

        for symbol in linkage_symbols:
            if sequence.startswith(symbol, pos):
                linkage_code = LINKAGE_SYMBOLS[symbol]

                linkages.append(
                    {
                        "code": linkage_code,
                        "symbol": symbol,
                        "name": LINKAGE_LIBRARY[linkage_code]["name"],
                    }
                )

                pos += len(symbol)
                matched_linkage = True
                break

        # No explicit symbol means PO.
        if not matched_linkage:
            if "PO" not in LINKAGE_LIBRARY:
                raise ValueError(
                    "No linkage symbol was found, but PO is not defined "
                    "in linkages.csv."
                )

            linkages.append(
                {
                    "code": "PO",
                    "symbol": "",
                    "name": LINKAGE_LIBRARY["PO"]["name"],
                }
            )

    if len(linkages) != len(residues) - 1:
        raise ValueError(
            "Sequence format error: number of linkages does not match residues."
        )

    return residues, linkages


def print_parsed_oligo(sequence):
    residues, linkages = parse_oligo(sequence)

    print(f"\nInput sequence: {sequence}")
    print("-" * 50)

    for i, residue in enumerate(residues):

        print(
            f"Position {i + 1}: "
            f"{residue['residue']} "
            f"(sugar={residue['sugar']} / {residue['sugar_name']}, "
            f"base={residue['base']} / {residue['base_name']})"
        )

        if i < len(linkages):
            linkage = linkages[i]

            print(
                f"Linkage {i + 1}-{i + 2}: "
                f"{linkage['code']} "
                f"({linkage['name']})"
            )


if __name__ == "__main__":

    print("Loaded bases:")
    print(list(BASE_LIBRARY.keys()))

    print("\nLoaded sugars:")
    print(list(SUGAR_LIBRARY.keys()))

    print("\nLoaded linkages:")
    print(list(LINKAGE_LIBRARY.keys()))

    test_sequences = [
        "rArCrGrU",
        "fAfCfGfU",
        "mAmCmGmU",
        "rA*rCfG**mU",
        "ATGC",
        "A*T**GC",
        "eA*eCrG*mU",
        "lA*uCrG&eU",
        "A&T",
    ]

    for seq in test_sequences:
        print_parsed_oligo(seq)

def parse_product_notation(sequence):
    """Lossless parser result including terminal entities; legacy tuple API remains stable."""
    from terminal_modifications import split_terminals
    core, ends = split_terminals(sequence)
    residues, linkages = parse_oligo(core)
    return {"residues": residues, "linkages": linkages, "terminals": ends}
