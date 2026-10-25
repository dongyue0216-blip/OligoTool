# v0.5.3

统一 phosphorusGeometry、末端轴向间距与 SVG 元素中心；新增 tests/visual gallery、几何及浏览器回归。详见 VISUAL_CONSISTENCY_v053.md。

# v0.5.0 — 2026-10-25

- Add offline Batch / Excel import, explicit worksheet/header/column mapping, independent validation and 100-row preview.
- Reuse latest v0.4.2 single engine and custom registry unchanged; no chemistry/layout changes.
- Add calculate-only / structures workflows, per-row progress and stop with partial results.
- Add Results / Summary XLSX export, SVG/MOL/SDF/experimental CDXML ZIP, unique safe filenames.
- Vendor SheetJS CE 0.20.3 and JSZip 3.10.1 plus licenses; no runtime network or build steps.
- Add batch template, portable regression runner and browser/performance evidence.

# v0.4.2

Direct v0.4.1 upgrade; Phase 1 coverage matrix and C5 methyl audit; terminal inverted dSpacer graph; PHO and 6-FAM aliases; separate Conjugation Pool; unchanged baseline residue layouts.

# v0.4.1

- FAM: all four six-membered rings use equal 1.75-unit sides and 120-degree internal angles; audited C6 amide/lactone identity retained.
- All seven LNA bases: intact five-membered furanose above, methylene/O bridge below. Explicit cage overpass metadata adds an SVG clearance gap without graph atoms or bonds. QA reports these seven audited local cage projections separately; unexpected crossings still fail.
- L96: three parallel chair GalNAc arms on the left, branch centre and long linker/prolinol on the right.
- NAG37: all three GalNAc rings use the same chair template, rotated as a rigid body along their arms.
- 10/10 coordinate/wedge roundtrip isomeric SMILES checks preserve chemical identity and stereochemistry.
- Regression: 241/241 core, 193/193 layout, 163/163 export readback, 120/120 actual browser glyph checks; 21/200-unit conjugate stress passed.

# v0.4.0

- 117 family-generated and deprotected atomic scaffolds; true PMO/TNA/GNA/Benner/VP topology.
- Audited neutral Me-P, PN(DMI), MsPA geometry; unspecified P stereochemistry.
- Orthogonal collision-aware routing with turn penalty and visibility simplification; adaptive conjugate spacing.
- Master records, evidence and reagent-to-final transformations; bracket phosphate canonical notation.
- Structure-first UI, fit-to-view, layout inspection; automatic glyph, export-stereo and long-chain regressions.
- Pending variants fail closed; custom marker workflow retained.
