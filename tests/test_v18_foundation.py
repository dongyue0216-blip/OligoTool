"""Golden-data and architecture foundation regression checks."""

import csv
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from chemistry import AVERAGE_ATOMIC_MASS, calculate_mass, parse_formula
from oligo_platform.chemistry.foundation import (
    fast_layer_properties, heavy_structure_properties, product_from_notation,
)
from oligo_platform.chemistry.helm_adapter import export_helm_compatible
from oligo_platform.core.models import (
    Assembly, AttachmentPoint, AttachmentRole, BiomoleculeReference, Molecule,
    Relationship,
)
from oligo_platform.libraries.chemistry_library import ChemistryLibrary


def test_golden_dataset():
    golden = ROOT / "tests" / "golden_dataset.csv"
    with golden.open(encoding="utf-8", newline="") as source:
        rows = list(csv.DictReader(source))
    assert len(rows) >= 40, len(rows)
    od_cases = 0
    for row in rows:
        result = fast_layer_properties(row["sequence"])
        assert result["formula"] == row["formula"], row["sequence"]
        assert abs(result["exact_mass"] - float(row["exact_mass"])) <= 0.0000011, row["sequence"]
        assert abs(result["average_mw"] - float(row["average_mw"])) <= 0.0000011, row["sequence"]
        if row["epsilon260"]:
            from photometry import extinction_coefficient_260
            od = extinction_coefficient_260(row["sequence"])
            assert abs(od["epsilon260"] - float(row["epsilon260"])) < 0.000001, row["sequence"]
            assert str(bool(od["estimated"])).lower() == row["od_estimated"], row["sequence"]
            od_cases += 1
    assert od_cases >= 30


def test_product_attachment_and_helm_adapter():
    product = product_from_notation("rA*rCfG**mU")
    assert isinstance(product, Molecule)
    assert len(product.components) == 4
    assert [c["stable_id"] for c in product.components] == [
        "OLIGO.MONOMER.rA", "OLIGO.MONOMER.rC", "OLIGO.MONOMER.fG", "OLIGO.MONOMER.mU"
    ]
    assert [c.bond_type for c in product.covalent_connections] == ["PS", "PO", "PS2"]
    assert {a.attachment_id for a in product.attachment_points} >= {"R1", "R2", "R3"}
    assert {(a.component_id, a.attachment_id) for a in product.attachment_points if a.available} == {
        ("residue-1", "R2"), ("residue-4", "R1")
    }
    exported = export_helm_compatible(product)
    assert exported["notation"] == "RNA1{rA.PS.rC.PO.fG.PS2.mU}$$$$"
    assert exported["monomers"]["rA"]["stable_id"] == "OLIGO.MONOMER.rA"


def test_assemblies_external_reference():
    sense = product_from_notation("rArCrG", name="Sense")
    antisense = product_from_notation("fAfCfG", name="Antisense")
    assembly = Assembly(
        "Duplex", components=[sense, antisense],
        relationships=[Relationship("Sense", "Antisense", "hybridization", (1, 1))],
    )
    encoded = export_helm_compatible(assembly)
    assert len(encoded["polymers"]) == 2
    assert encoded["connections"][0]["type"] == "hybridization"
    antibody = BiomoleculeReference("Antibody-X", "ANTIBODY", declared_mw=150000, reactive_handles=["amine"])
    assert export_helm_compatible(antibody)["external_reference"]["declared_mw"] == 150000



def test_library_snapshot_and_history():
    library = ChemistryLibrary.load(ROOT / "libraries" / "chemistry_library.v1.json")
    record = library.resolve_symbol("rA")
    assert record.stable_id == "OLIGO.MONOMER.rA" and record.version == 1
    assert {point["attachment_id"] for point in record.attachment_points} == {"R1", "R2", "R3"}
    assert abs(record.exact_mass - 267.096754) < 0.000001
    try:
        library.with_new_version(record)
    except ValueError:
        pass
    else:
        raise AssertionError("Published chemistry records must be immutable")
    updated = type(record)(**{**record.__dict__, "version": 2, "name": "RNA Adenosine v2"})
    next_library = library.with_new_version(updated)
    assert next_library.resolve(record.stable_id, 1).name == record.name
    assert next_library.resolve(record.stable_id).version == 2


def test_optional_heavy_graph_formula_matches_fast_layer():
    for sequence in ("rArA", "rA*rA", "A**T", "A&T"):
        graph = heavy_structure_properties(sequence)
        fast = fast_layer_properties(sequence)
        assert parse_formula(graph["formula"]) == parse_formula(fast["formula"]), sequence


if __name__ == "__main__":
    for test in (
        test_golden_dataset, test_product_attachment_and_helm_adapter,
        test_assemblies_external_reference, test_library_snapshot_and_history,
        test_optional_heavy_graph_formula_matches_fast_layer,
    ):
        test()
    print("v1.8 foundation and golden dataset tests PASS")
