"""Adapters that let the existing v1.7 parser/calculator feed the new model."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from chemistry import calculate_oligo_properties
from custom_library import get_entry
from parser import parse_oligo

from oligo_platform.core.models import (
    AttachmentPoint, AttachmentRole, CovalentConnection, Molecule,
)
from oligo_platform.libraries.chemistry_library import ChemistryLibrary, ChemistryRecord


DEFAULT_LIBRARY_PATH = Path(__file__).resolve().parents[2] / "libraries" / "chemistry_library.v181.json"


def load_default_library() -> ChemistryLibrary:
    return ChemistryLibrary.load(DEFAULT_LIBRARY_PATH)


def _record_for_residue(residue: dict[str, Any], library: ChemistryLibrary) -> ChemistryRecord:
    token = residue["base"] if residue["sugar"]=="d" and residue["base"] in {"A","C","G","T"} else residue["residue"]
    try:
        return library.resolve_symbol(token)
    except KeyError:
        if residue.get("custom_code"):
            # Existing user-defined residues remain usable; their provenance is
            # explicit until they are promoted into a reviewed library version.
            row = get_entry(residue["custom_code"], "Residue")
            return ChemistryRecord(
                stable_id=f"OLIGO.CUSTOM.{residue['custom_code']}", version=1,
                display_symbol=token, name=row.get("name", token), entity_type="NUCLEOSIDE_MONOMER",
                formula=row.get("formula"), confidence="user_defined", source="v1.7 user library",
                status="DRAFT", smiles=row["smiles"], molfile=row["molblock"],
                attachment_points=tuple({"attachment_id":a,"atom_reference":row[k],"reference_type":"atom_index"} for a,k in [("R1","attachment_3"),("R2","attachment_5")]),
                metadata={"custom_library_code": token,"structure_available":True},
            )
        raise


def product_from_notation(
    sequence: str,
    *,
    name: str | None = None,
    library: ChemistryLibrary | None = None,
) -> Molecule:
    """Create a graph-shaped molecule from existing compact v1.7 notation."""
    chemistry_library = library or load_default_library()
    from parser import parse_product_notation
    parsed = parse_product_notation(sequence)
    residues, linkages = parsed["residues"], parsed["linkages"]
    components: list[dict[str, Any]] = []
    all_attachments: list[AttachmentPoint] = []
    for index, residue in enumerate(residues):
        record = _record_for_residue(residue, chemistry_library)
        component_id = f"residue-{index + 1}"
        attachment_points = [
            AttachmentPoint("R1", AttachmentRole.THREE_PRIME, component_id=component_id, atom_reference="3'"),
            AttachmentPoint("R2", AttachmentRole.FIVE_PRIME, component_id=component_id, atom_reference="5'"),
            AttachmentPoint("R3", AttachmentRole.BRANCH, component_id=component_id, available=False),
        ]
        for point in attachment_points:
            match=next((a for a in record.attachment_points if a["attachment_id"]==point.attachment_id),None)
            if match: point.atom_reference=match["atom_reference"]
        from dataclasses import asdict
        components.append({
            "atomic_record": asdict(record),
            "component_id": component_id,
            "stable_id": record.stable_id,
            "version": record.version,
            "display_symbol": record.display_symbol,
            "name": record.name,
            "entity_type": record.entity_type,
            "formula": record.formula,
            "attachment_points": [
                {"attachment_id": p.attachment_id, "semantic_role": p.semantic_role.value,
                 "atom_reference": p.atom_reference, "available": p.available}
                for p in attachment_points
            ],
        })
        # Only the actual terminal R groups remain open after chain assembly.
        if index == 0:
            all_attachments.append(attachment_points[1])
        if index == len(residues) - 1:
            all_attachments.append(attachment_points[0])
        all_attachments.append(attachment_points[2])

    connections = [
        CovalentConnection(
            source_component_id=f"residue-{index + 1}", source_attachment_id="R1",
            target_component_id=f"residue-{index + 2}", target_attachment_id="R2",
            bond_type=linkage["code"], metadata={"notation_symbol": linkage["symbol"], "name": linkage["name"]},
        )
        for index, linkage in enumerate(linkages)
    ]
    from dataclasses import asdict
    for connection in connections:
        record=chemistry_library.resolve_symbol("link:"+connection.bond_type)
        connection.metadata["atomic_record"]=asdict(record)
    # Modified terminal oxygen is consumed; expose the pinned reaction explicitly.
    for point in all_attachments:
        end = '5' if point.semantic_role == AttachmentRole.FIVE_PRIME else '3' if point.semantic_role == AttachmentRole.THREE_PRIME else None
        if end in parsed['terminals']:
            point.available = False
            point.metadata['terminal_entity'] = parsed['terminals'][end]
    return Molecule(
        name=name or sequence, components=components, covalent_connections=connections,
        attachment_points=all_attachments, notation=sequence,
        metadata={
            "chemistry_library_version": chemistry_library.library_version,
            "terminals": parsed["terminals"],
            "terminal_entities": {end:asdict(chemistry_library.resolve_symbol(code)) for end,code in parsed["terminals"].items()},
            "source_parser": "v1.8.2", "fast_calculation": "v1.7 compatibility layer",
        },
    )


def fast_layer_properties(sequence: str) -> dict[str, Any]:
    """Expose the familiar calculation result without triggering graph builds."""
    return calculate_oligo_properties(sequence)


def heavy_structure_properties(sequence, *, library=None):
    """Assemble pinned Product records; changing notation or current library cannot change them."""
    from rdkit import Chem
    from rdkit.Chem import AllChem, Descriptors, rdMolDescriptors
    from atomic_library import residue, connect
    from terminal_modifications import apply_terminals
    product=product_from_notation(sequence, library=library) if isinstance(sequence,str) else sequence
    mols=[]
    for component in product.components:
        record=ChemistryRecord(**component['atomic_record'])
        if record.metadata.get('custom_library_code'):
            from custom_library import validate_attachments
            m=Chem.MolFromMolBlock(record.molfile,removeHs=False)
            sites={a['attachment_id']:a['atom_reference'] for a in record.attachment_points}
            validate_attachments(m,sites['R2'],sites['R1'])
            m.SetIntProp('_custom_o5',sites['R2']);m.SetIntProp('_custom_o3',sites['R1'])
        else: m=residue(record)
        mols.append(m)
    mol=mols[0]; o5=mol.GetIntProp('_custom_o5'); o3=mol.GetIntProp('_custom_o3')
    for i,c in enumerate(product.covalent_connections):
        right=mols[i+1]
        mol,offset=connect(mol,o3,right,right.GetIntProp('_custom_o5'),ChemistryRecord(**c.metadata['atomic_record']))
        o3=offset+right.GetIntProp('_custom_o3')
    mol=apply_terminals(mol,product.metadata.get('terminals',{}),o5,o3,{end:ChemistryRecord(**r) for end,r in product.metadata.get('terminal_entities',{}).items()})
    Chem.AssignStereochemistry(mol,cleanIt=True,force=True); AllChem.Compute2DCoords(mol)
    block=Chem.MolToMolBlock(mol)
    return dict(mol=mol,formula=rdMolDescriptors.CalcMolFormula(mol),exact_mass=Descriptors.ExactMolWt(mol),average_mw=Descriptors.MolWt(mol),smiles=Chem.MolToSmiles(mol),molblock=block,sdf=block+'\n$$$$\n')
