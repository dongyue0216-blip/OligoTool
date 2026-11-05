# C8 — Adaptive & Customizable Workspace prototype

2026-11-05 · Asia/Shanghai · Development preview, not a replacement release.

## Confirmed development baseline

The active repository is `outputs/molecule-builder`; the application is its **outer** `Oligo-Toolkit/Start.html`. HEAD is `0b8d56c` (old v2.1.0), but the actual working files include the completed Branch work and **Architecture Hardening & Hybridization Foundation**. The latter is documented in `ARCHITECTURE_HARDENING_HYBRIDIZATION_REPORT.md` and implemented in `molecule-builder.js`, the A core/chemistry snapshots, and `hybridization.js` / `hybridization-ui.js`. This task used these working files, including untracked files, rather than HEAD, the old zip, or the stale nested package.

Initial Git status, existing patch and application SHA-256 inventory are saved in `../../audit-c8/`. Before implementation the existing tests passed: hardening 14/14, Branch 29/29, regression 76/76.

**LOCKED preservation:** Comparing every pre-existing application file against that inventory identifies only `app/local-viewers.js` as changed. Thus the A snapshots, MoleculeState/general graph/components/interactions/materialization, reaction engine, Hybridization, library, Branch model and existing workflow handlers are byte-identical to the latest development baseline. No checkout/reset, commit, index update, source mirror edit or old archive overwrite was performed.

## What changed

- A 12-column responsive grid replaces the fixed narrow input column and disconnected Builder draft layout. Default Sequence/Structure spans are 5/7, equal 480px panel height. Ordinary viewers are compact; zoom, fit, expand and fullscreen remain available. The structure panel has a readable MW summary and expandable Properties & Exports, preserving all existing controls and result data.
- Builder operation/Branch Sequence, Starting Molecule, Secondary Reagent and Product Preview are separate grid cards. Branch mode automatically omits the secondary reagent. The sample Branch draft is about 460px tall instead of over 1500px at 1440px viewport width; this is one reproducible example, not a claim about every workflow.
- Display / Workspace in the header contains Edit Layout, density, new-viewer default presentation, visibility, four presets, Save Custom, Restore Custom and Reset to Default. Main Sequence, Structure, Builder and Hybridization cards and the four draft cards are editable. Drag the dotted handle to reorder **within the same grid**. Drag the bottom-right arrow to resize, or focus it and use arrow keys; earlier/later buttons also support keyboard reordering.
- Width snaps to 3–12 columns; resized height snaps to 24px, bounded 240–1200px. CSS grid prevents overlap. Small panels scroll their own content. At <=980px outer panels stack and use content height; at <=1200px draft cards become two columns, then one at <=760px. Stored desktop preferences survive these responsive adaptations.
- A versioned localStorage preference stores size, order, visibility, density, default presentation and **one** custom layout. No molecular state is stored by this feature. Storage failures fall back to the current session. File-origin persistence was exercised in Edge and Chrome; preferences belong to that browser/file origin and are not a portable account setting.

## Three presentation entries, one molecule

`structure-presentation.js` reads only the existing AssemblyGraph / lane / site provenance. It does not parse sequence text, expand a second molecule, write a graph, or call a new chemistry engine.

- **Schematic:** forward linear lanes and existing hierarchical branches; colored residue tokens, exact block ID labels/tooltips, direction, explicit linkage labels (including modified linkages), named conjugate/scaffold blocks and explicit branch connectors. Long lanes wrap after eight units. Short structures use content-sized bounds.
- **Detailed:** the existing semantic/bamboo renderer with existing standard abbreviation support.
- **Chemical:** the existing complete atomistic graph renderer, without standard abbreviations. Detailed and Chemical share the established coordinate machinery and can look the same where the existing renderer protects oligo atoms; this is not a new independent chemical depiction engine.

Each viewer has a temporary selector. Global preference determines **new mounts** only. Atom/OH/reaction-site selection uses Chemical and disables other modes while selecting real atoms, retaining highlights and atom targets.

Unsupported imported residue mappings, reversed/nonlinear lane topology, reaction-authoritative products, additional crosslinks/closures, multi-component provenance-only states and interactions conservatively fall back to Chemical with a visible explanation. No stale pre-reaction schematic is shown. Schematic is bounded to 500 units. Very long block labels are shortened visually with full IDs in SVG tooltips. It does not predict folding or draw hybridization pairing maps.

**Exports keep the existing chemistry-bound behavior.** There is no new Schematic SVG export. The Layout preference does not save molecule checkpoints; existing checkpoint exports remain the way to save molecules.

## Reproduce

1. Open the active `Start.html` directly in Edge or Chrome, or extract the separate `Oligo-Toolkit-C8-Preview.zip` and open its `Start.html`.
2. See 01/02 together; use the viewer selector and Properties & Exports. Use + / −, Fit, Expand or Fullscreen for inspection.
3. Input `[GlycerolBranch]rArCrG`, Generate, Add Step, choose Branch Elongation, enter `rUrA`, then Preview. Compare the operation editor, starting structure and schematic product side by side.
4. Open Display / Workspace → Edit Layout. Move a dotted handle and drag a bottom-right resize arrow. Finish editing. Hide/re-enable panels in settings; save Custom, try a preset, restore Custom. Reload the same file to verify preferences. Reset to Default restores the standard panel configuration, preserving the saved custom slot.
5. Resize the window. The grid stacks at narrow widths; returning to desktop restores its saved proportions. Use Custom Chemistry and Batch navigation normally; those pages retain their existing workflows.

Before/after screenshots and a comparison page are in `../../audit-c8/COMPARE.html`. Baseline screenshots disable the additive C8 files and use the pre-C8 viewer; source files were not rolled back to capture them. Sticky header positioning is disabled only for the tall baseline Branch screenshot to avoid screenshot stitching artifacts.

## Validation

- `node tests/hardening-tests.cjs`: **14/14**.
- `node tests/branch-tests.cjs`: **29/29**.
- `node tests/regression.cjs`: **76/76** (152 audit records; 23 previously known catalog ghost entries remain).
- `node tests/c8-presentation.cjs`: **6/6**; explicit linkage labels across six real branch chemistries, no graph mutation, reaction/import/interaction fallbacks and missing branch mapping rejection.
- `node tests/c8-browser.cjs`: **Edge + Chrome PASS**. Real drag reorder, keyboard/pointer resize, panel visibility, custom save/reset/restore, bilingual settings, file localStorage reload, three-mode molecular state equality, site-selection preservation, Properties/Exports, zoom/fit/fullscreen, zero remote requests and no page errors. Widths 1920, 1440, 1280, 1024, 800 and 390 checked for grid overlap and page overflow after custom layout restoration.
- Existing `node tests/hybridization-browser.cjs`: **Edge + Chrome PASS** (duplex, hairpin, unresolved input, invalidated results, JSON export).
- Existing `node ../browser-acceptance.cjs`: **Edge + Chrome PASS** (Branch → reaction → nested Branch; all checkpoint exports; custom four-site library save/reload; checkpoint restore; 100nt+30nt zoom; language and offline invariance).
- JavaScript syntax checks and `git diff --check`: PASS. Initial restricted browser startup failed; local browser checks subsequently ran successfully with execution permission.

## Scope and remaining limits

This is an experiential C8 prototype. Layout editing covers the main molecular workspace and Builder draft cards, not individual history records, Batch tables or the Custom Chemistry editor. Panels cannot be moved between different parent grids. There is one custom slot, no named template system or layout import/export. Height compression uses panel scrolling rather than hiding controls. Touch drag-and-drop has not been separately validated.

Schematic does not yet cover arbitrary general graphs, cycles, interaction maps, atom-level site selection, reaction product semantics, duplex cartoons or complex conjugate pictograms. These cases retain Chemical inspection. Fullscreen/zoom are still necessary to read complex atomistic structures. Existing A/C geometry limitations and Hybridization's sequence-heuristic limits are unchanged; no thermodynamics, folding or chemistry coverage was added.

Application changes are limited to `Start.html`, `app/local-viewers.js`, and three additive files: `app/adaptive-workspace.js`, `app/adaptive-workspace.css`, `app/structure-presentation.js`. Tests, this report and review evidence are additive. The old `Oligo-Toolkit.zip` and nested packaged copy remain stale; use the active Start file or the specifically named C8 preview archive.
