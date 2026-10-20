"""HELM-compatible serialization for products backed by our monomer IDs.

The adapter emits a HELM polymer/connection envelope and an explicit monomer
dictionary. The local monomer IDs can be mapped into a HELM monomer set without
loading the HELM Java toolkit at runtime.
"""

from __future__ import annotations

from typing import Any

from oligo_platform.core.models import Assembly, BiomoleculeReference, Molecule


def _safe_polymer_name(name: str, fallback: str) -> str:
    token = "".join(char for char in name if char.isalnum() or char == "_")
    return token or fallback


def export_helm_compatible(product: Molecule | Assembly | BiomoleculeReference) -> dict[str, Any]:
    """Return notation plus mappings and warnings; preserve graph relationships."""
    if isinstance(product, Molecule):
        tokens: list[str] = []
        monomer_map: dict[str, dict[str, Any]] = {}
        for index, component in enumerate(product.components):
            symbol = component["display_symbol"]
            tokens.append(symbol)
            monomer_map[symbol] = {
                "stable_id": component["stable_id"], "version": component["version"],
                "entity_type": component["entity_type"], "formula": component.get("formula"),
            }
            if index < len(product.covalent_connections):
                link = product.covalent_connections[index]
                code = str(link.bond_type)
                link_symbol = {"PO": "PO", "PS": "PS", "PS2": "PS2", "MsPA": "MsPA"}.get(code, code)
                tokens.append(link_symbol)
                monomer_map[link_symbol] = {"stable_id": f"OLIGO.LINKAGE.{code}", "version": 1, "entity_type": "BACKBONE_LINKAGE"}
        polymer = _safe_polymer_name(product.name, product.stable_id)
        return {
            "format": "HELM-compatible",
            "notation": f"RNA1{{{'.'.join(tokens)}}}$$$$",
            "polymers": [{"id": "RNA1", "type": "RNA", "name": polymer, "monomer_ids": list(monomer_map)}],
            "monomers": monomer_map,
            "connections": [
                {"source": f"RNA1,{c.source_component_id}:{c.source_attachment_id}",
                 "target": f"RNA1,{c.target_component_id}:{c.target_attachment_id}", "bond_type": c.bond_type}
                for c in product.covalent_connections
            ],
            "warnings": ["Notation symbols for modified residues/linkages require matching HELM monomer-set definitions."],
        }
    if isinstance(product, Assembly):
        polymers = []
        monomers: dict[str, dict[str, Any]] = {}
        for index, component in enumerate(product.components, 1):
            if not isinstance(component, Molecule):
                polymers.append({"id": f"RNA{index}", "type": "RNA", "name": getattr(component, "name", f"Component {index}"), "external_reference": True})
                continue
            exported = export_helm_compatible(component)
            inner = exported["notation"].split("{", 1)[1].split("}", 1)[0]
            polymers.append({"id": f"RNA{index}", "type": "RNA", "name": component.name, "sequence": inner})
            monomers.update(exported["monomers"])
        poly_notation = "|".join(f"RNA{i}{{{p.get('sequence', 'X')}}}" for i, p in enumerate(polymers, 1))
        connections = []
        for relationship in product.relationships:
            connections.append({
                "source_component_id": relationship.source_component_id,
                "target_component_id": relationship.target_component_id,
                "type": relationship.relationship_type,
                "stoichiometry": relationship.stoichiometry,
            })
        return {
            "format": "HELM-compatible", "notation": f"{poly_notation}$...$${'|'.join(r.relationship_type for r in product.relationships)}$",
            "polymers": polymers, "monomers": monomers, "connections": connections,
            "warnings": ["Assembly relationship semantics are exported alongside HELM notation for downstream mapping."],
        }
    return {
        "format": "HELM-compatible", "notation": "",
        "polymers": [{"id": "PEPTIDE1", "type": product.biomolecule_type, "name": product.name, "external_reference": True}],
        "monomers": {}, "connections": [],
        "external_reference": {"stable_id": product.stable_id, "source": product.external_source, "lot": product.lot, "declared_mw": product.declared_mw, "reactive_handles": product.reactive_handles},
        "warnings": ["External biomolecule is represented by reference; manufacturing is outside this platform."],
    }
