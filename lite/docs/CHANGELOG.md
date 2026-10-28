# v0.7.0

- Unify standard and user blocks through directional attachment contracts; move topology and placement decisions out of family dispatch.
- Preserve dedicated PMO phosphorodiamidate and actual TNA/GNA O3→O2 topology; reject undefined mixtures/termini explicitly.
- Support one-site terminal-only Custom blocks, primary/secondary OH combinations, V3000, direct O/SDF marker metadata and manual fallback.
- Remove Custom file/size/span caps; normalize coordinates, avoid spread-argument bounds limits and fit the complete viewer.
- Add Save & New / New Custom Chemistry and complete reset while retaining saved items.
- Add registry, large-graph, formula/export, Single/Batch and real-browser regressions. See TEST_REPORT_v070.md.

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


## v0.6.0 attachment-driven terminal phosphorus

MOE and all 84 declared standard monomers now share the same attachment-driven engine for PO, PS (*), PS2 (**), Me-P (^), PN(DMI) (!), MsPA (#), at both termini. Examples: (p)*eA, (p)*eCMe, (p)*eG, eA*(p). [p] resolves to the same canonical notation/AST chemistry as (p). 2′ sugar modifications do not select terminal rules.

The monomer declares 5_prime_attachment / 3_prime_attachment with an atom index, atom role, element, standard compatibility and supported terminal/internal chemistries. Runtime validates a real neutral alcohol OH before creating its P bond. Custom import produces the same contracts after attachment validation. Internal standard attachments validate these contracts too. Syntax errors use SYNTAX_ERROR; undefined attachments use CHEMISTRY_UNSUPPORTED; Batch isolates failed rows.

See [generated support matrix](ATTACHMENT_SUPPORT_MATRIX.md), [architecture](ATTACHMENT_ARCHITECTURE.md), and tests/evidence/ATTACHMENT_MATRIX.json. Canonical phosphorus geometry is reused unchanged. CDXML retains its existing Experimental status.
