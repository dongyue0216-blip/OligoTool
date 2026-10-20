"""Read-only, version-pinned chemistry records with explicit provenance."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


@dataclass(frozen=True)
class ChemistryRecord:
    stable_id: str
    version: int
    display_symbol: str
    name: str
    entity_type: str
    formula: str | None = None
    exact_mass: float | None = None
    average_mass: float | None = None
    natural_analog: str | None = None
    smiles: str | None = None
    molfile: str | None = None
    attachment_points: tuple[dict[str, Any], ...] = ()
    extinction_parameter: float | None = None
    extinction_source: str | None = None
    confidence: str = "unknown"
    source: str | None = None
    status: str = "REVIEWED"
    created_at: str = ""
    updated_at: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.stable_id.strip() or self.version < 1:
            raise ValueError("Chemistry records require a stable ID and positive version")


class ChemistryLibrary:
    def __init__(self, records: Iterable[ChemistryRecord], library_version: str):
        self.library_version = library_version
        self._records: dict[tuple[str, int], ChemistryRecord] = {}
        self._symbols: dict[str, ChemistryRecord] = {}
        for record in records:
            key = (record.stable_id, record.version)
            if key in self._records:
                raise ValueError(f"Duplicate chemistry record {key}")
            self._records[key] = record
            current = self._symbols.get(record.display_symbol)
            if current is not None and current.stable_id != record.stable_id:
                raise ValueError(f"Display symbol {record.display_symbol} maps to multiple stable IDs")
            if current is None or current.version < record.version:
                self._symbols[record.display_symbol] = record

    @classmethod
    def load(cls, path: str | Path) -> "ChemistryLibrary":
        payload = json.loads(Path(path).read_text(encoding="utf-8"))
        return cls(
            (ChemistryRecord(**{**item, "attachment_points": tuple(item.get("attachment_points", ()))}) for item in payload["records"]),
            payload["library_version"],
        )

    def resolve(self, stable_id: str, version: int | None = None) -> ChemistryRecord:
        if version is not None:
            return self._records[(stable_id, version)]
        candidates = [r for (sid, _), r in self._records.items() if sid == stable_id]
        if not candidates:
            raise KeyError(stable_id)
        return max(candidates, key=lambda r: r.version)

    def resolve_symbol(self, symbol: str) -> ChemistryRecord:
        return self._symbols[symbol]

    def records(self) -> tuple[ChemistryRecord, ...]:
        return tuple(self._records.values())

    def with_new_version(self, record: ChemistryRecord) -> "ChemistryLibrary":
        """Return a new library snapshot; an existing version cannot be overwritten."""
        if (record.stable_id, record.version) in self._records:
            raise ValueError("A published chemistry version is immutable")
        if any(sid == record.stable_id and v >= record.version for sid, v in self._records):
            raise ValueError("New versions must increase monotonically")
        return ChemistryLibrary((*self._records.values(), record), self.library_version)

    @staticmethod
    def timestamp_now() -> str:
        return datetime.now(timezone.utc).isoformat()
