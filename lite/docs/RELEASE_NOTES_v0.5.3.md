Offline browser toolkit: extract the clean ZIP and double-click Start.html. No installation or network required.

- Single Sequence with molecular formula, MW/exact mass, epsilon260, nmol/OD260 and ug/OD260; optical estimates and missing parameters are identified.
- Batch XLSX/CSV input, Excel results and structure ZIP exports using the same chemistry engine as Single; per-row validation and error isolation.
- Terminal phosphate/PS notation, including `(p)rA`, `rA(p)`, `(p)*rA` and `rA*(p)`; supported PS2 and other terminal variants are documented in the support matrix.
- Consistent terminal/internal phosphorus geometry, bond lengths and element-label centering; SVG, MOL/SDF and experimental CDXML exports.
- Custom Chemistry MOL/SDF import, attachment selection, local library backup/restore and Batch integration.
- Clean packaging: fresh staging, allowlist, nested-version/archive/cache guards, resource-path validation and ZIP hash verification. No historical project copies are included.

Validation: release 277 checks; Batch 382 checks; terminal 144 valid/15 invalid cases plus baseline comparisons; 78 visual cases. Edge file:// smoke covers Excel downloads, Custom Chemistry persistence/restore, Single/Batch parity and 200-mer rendering. The historical Batch file-hash assertion now uses a separate v0.5.3 release manifest; the original historical baseline remains unchanged.

Conjugation Pool is metadata infrastructure only. A conjugation reaction engine is **not implemented**. See README and support matrices for pending variants, optical limitations and export restrictions.

Source is in `lite/` in the existing OligoTool repository. The original Python toolkit retains its separate version and release history.
