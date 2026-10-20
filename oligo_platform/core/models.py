"""Small, serialization-friendly domain objects for molecular identity and state.

The v1.7 calculator remains the source of fast sequence calculations. These
models describe product identity without mixing in manufacturing execution.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping
from uuid import uuid4


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


class ProductKind(str, Enum):
    MOLECULE = "MOLECULE"
    ASSEMBLY = "ASSEMBLY"
    BIOMOLECULE_REFERENCE = "BIOMOLECULE_REFERENCE"


class AttachmentRole(str, Enum):
    THREE_PRIME = "3_prime"
    FIVE_PRIME = "5_prime"
    BRANCH = "branch"
    CONJUGATION = "conjugation"
    CUSTOM = "custom"


@dataclass
class AttachmentPoint:
    attachment_id: str
    semantic_role: AttachmentRole | str
    component_id: str | None = None
    atom_reference: str | int | None = None
    cap_or_leaving_group: str | None = None
    bond_type: str | None = None
    available: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.attachment_id or not self.attachment_id.startswith("R"):
            raise ValueError("attachment_id must be a HELM-style R-group ID (R1, R2, ...).")
        if isinstance(self.semantic_role, str):
            try:
                self.semantic_role = AttachmentRole(self.semantic_role)
            except ValueError:
                if self.semantic_role != AttachmentRole.CUSTOM.value:
                    raise ValueError(f"Unknown attachment role: {self.semantic_role}")


@dataclass
class CovalentConnection:
    source_component_id: str
    source_attachment_id: str
    target_component_id: str
    target_attachment_id: str
    bond_type: str = "single"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Molecule:
    name: str
    components: list[dict[str, Any]] = field(default_factory=list)
    covalent_connections: list[CovalentConnection] = field(default_factory=list)
    attachment_points: list[AttachmentPoint] = field(default_factory=list)
    stable_id: str = field(default_factory=lambda: new_id("mol"))
    version: int = 1
    notation: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def kind(self) -> ProductKind:
        return ProductKind.MOLECULE


@dataclass
class Relationship:
    source_component_id: str
    target_component_id: str
    relationship_type: str
    stoichiometry: tuple[int, int] = (1, 1)
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.relationship_type.strip():
            raise ValueError("relationship_type is required")
        if len(self.stoichiometry) != 2 or min(self.stoichiometry) < 1:
            raise ValueError("stoichiometry must contain two positive integers")


@dataclass
class Assembly:
    name: str
    components: list[Product | dict[str, Any]] = field(default_factory=list)
    relationships: list[Relationship] = field(default_factory=list)
    stable_id: str = field(default_factory=lambda: new_id("asm"))
    version: int = 1
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def kind(self) -> ProductKind:
        return ProductKind.ASSEMBLY


@dataclass
class BiomoleculeReference:
    """External biomolecule identity; this platform does not claim to manufacture it."""

    name: str
    biomolecule_type: str
    external_source: str | None = None
    lot: str | None = None
    declared_mw: float | None = None
    reactive_handles: list[str] = field(default_factory=list)
    external_record_reference: str | None = None
    stable_id: str = field(default_factory=lambda: new_id("bio"))
    version: int = 1

    @property
    def kind(self) -> ProductKind:
        return ProductKind.BIOMOLECULE_REFERENCE


Product = Molecule | Assembly | BiomoleculeReference

