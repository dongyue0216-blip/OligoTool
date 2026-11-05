# Molecule Builder + Branch Elongation architecture

## Baseline and scope

Unreleased development build from Oligo Toolkit v2.1.0, accepted source commit `9d418b3ec0b8360a5b89de0e072c1c421d99def3`. The original release directory was preserved. A separate local Git repository records the exact baseline and implementation diff. No GitHub mutation or publication was performed. Synced `sources/` material was not modified.

The product models molecular structures and deliberate Operations. It does not infer manufacturing chronology, protecting-group removal, synthesis capping, reagent equivalents or experimental yields. Existing generic Disulfide Reduction remains a deliberate reaction Operation.

## A — Chemical truth and construction provenance

`app/molecule-builder.js` owns immutable `oligo-molecule-state`, schemaVersion 1. Each state has:

- A complete continuous MolecularGraph, atom/bond provenance and graph-derived formula, average MW and exact mass.
- Hierarchical AssemblyGraph with ordered lanes, each retaining the normal linear AssemblyGraph and sequence. BranchEdges identify parent/child lanes, immutable parent site ID, child site ID, real atom anchors, linkage atoms and chemistry.
- An extensible AttachmentSites array containing stable instance IDs, local atom provenance, role/direction, compatibility domain, allowed linkage classes, and available/occupied/removed status.
- ReactiveSites freshly detected by the existing reaction v2 engine; optical properties/status; parentStateId, Operation and ordered Operation history.
- Original lane coordinates and route sidecars, plus secondary-fragment mappings used by C. These support reloading a checkpoint without re-parsing deleted custom library entries.

`MoleculeBuilder.start` calls **Lite.calculate** directly. No alternate branch parser, residue catalog, formula calculator or sequence assembler exists. `MoleculeBuilder.branch` calls that same method for each child sequence. `fromGraph` preserves the former MOL/SMILES-to-reaction workflow without inventing assembly sites.

An `AssemblyOperation / BranchElongation` validates an explicitly declared available parent branch site against a child endpoint and the existing LinkageDefinition. It checks element, alcohol/amine connection class, compatibility domain, permitted internal linkage, neutral free-site hydrogen and local bond valence. It consumes one H at each endpoint, incorporates the existing linkage graph and joins its real center to the two real anchors. Connectivity and normal engine valence validation run before committing. Formula/MW/exact mass are recomputed from the resulting graph. PO, PS, PS2, Me-P, PN(dmi) and MsPA reuse the existing linkage graphs; incompatible PMO sites fail closed.

Only explicit branch contracts qualify. Ordinary RNA 2′-OH groups are never scanned into branch sites. The additive `[GlycerolBranch]` built-in is glycerol (C3H8O3) with two directional OH sites and one explicit branch OH. It is an ordinary BuildingBlock in the Unified Library, loaded by `branch-builtins.js`. Existing built-in template bytes remain unchanged.

A `ReactionOperation` calls **Reactions.v2.transform** without duplicating motif detection or chemistry. The existing input-atom mapping remaps every attachment, lane and branch anchor. Removed sites become removed; consumed sites become occupied; unaffected branch sites remain available. Secondary fragments are tracked for the existing C placement and triazole treatment. CAP, Amine Coupling, Click, Disulfide Reduction and Thiol–Maleimide retain their accepted engine code byte-for-byte.

## Start/End and local 3′/5′ semantics

The main and each child sequence retain their own local ordered Start→End interpretation. In this implementation Start means the first end in the accepted input notation, and End means its last end. The conventional upstream/downstream labels remain local to the particular block/oligo. They are not molecule-wide 3′/5′ coordinates or manufacturing instructions.

A parent Branch 1 remains Branch 1 after connection; it becomes occupied, never renamed 3′. A BranchEdge joins that parent site to the explicitly selected child Start or End. Directional sites are selected from the child's existing assembly provenance. Capped or already consumed child endpoints are unavailable. A single-site endpoint can orient at either sequence terminus unless its contract explicitly sets `reversible:false`; compatibility checks still apply. The core orientation change removes an accidental global restriction arising from the historical upstream/downstream storage key.

## Additive v2.00+ User Library evolution

The User Library envelope and record **schemaVersion remain 1**; the storage key, BuildingBlock schema `building-block/3`, import/merge conflict policy, backups and Built-in/User separation remain intact. No destructive or pre-v2.00 migration was introduced.

Old records are decoded, persisted, reloaded and exported without rewriting their record contents. A missing branch capability projects to an empty branch list. Old directional attachment maps retain their atoms, coordinates, metadata, optical fields, names, IDs and graph identity. Their meaning is not made globally 3′-only.

New selections arrive as a `branchSites` array. The existing custom registration path validates each real OH, rejects repeated atoms and constructs generic site records with `direction/role = branch` and `index = 1..N`. The existing unbounded `sites`/`attachments` map remains the backward-compatible representation; keys are generated dynamically, with no fixed branch fields or branch-count cap. New branch-capable BuildingBlocks additionally persist the explicit **attachmentSites array**. It is deterministically derived from the same site contracts; legacy records need no new field. MoleculeState always uses a list.

Library normalize/validate reconstructs branch contracts from runtime attachments, verifies equality with the stored BuildingBlock and graph identity, and retains them through save/reload/export/import/merge. Unknown envelope versions continue to fail closed. Future incompatible envelope changes must introduce an explicit forward migration; absence of a newly optional capability must mean empty/not present.

The one-site fixture was generated using the unmodified released **v2.0.0** library/chemistry code. The two-site fixture is the actual v2.00 baseline fixture carried by the release. Both are included in tests, with lossless record comparison across import, storage reload and JSON export/decode.

## B — Integrated workflow

Navigation is Molecule Builder, Batch Excel and Custom Chemistry. The accepted Sequence input/viewer remains; its successful calculation creates state 0. MOL/SMILES can also seed a molecule. The former standalone reaction controls are superseded within this build by the general Operation editor; all five accepted reaction families remain accessible there.

`+ Add Step` opens either Post-synthesis Reaction or Branch Elongation. Branch selection shows the actual block/lane and branch label, highlights the real atom, and defaults only to an available site. Missing sites disable branch preview with a clear message. The child syntax is the same as the main sequence. Reaction detection uses native candidates, explicit site/regioisomer selection and native compatibility messages; starting molecule and secondary reagent sites are highlighted.

Preview computes an uncommitted state; editing inputs invalidates it. Apply appends the immutable state. Every checkpoint is expandable, independently calculable, exportable in all existing formats and reusable via JSON import. Continuing from a historical state preserves later checkpoints and gives the new result the selected historical parent ID. No predeclared step count, Finish action or artificial Operation limit exists.

Checkpoint/session cards are held in memory, consistent with the previous notebook. Export checkpoints for reuse after a reload. User Library remains locally persistent. Starting a new molecule or importing a state starts a new in-memory session. Language changes do not mutate state chemistry; UI labels use the existing language selector. Batch remains on the same Unified Library.

## C — Geometry only

`branch-layout.js` lays out the ordered main lane and each child lane below prior content. Each lane retains the accepted roughly ten-unit-per-column bamboo geometry, with X extending as needed. A child starts at the parent's real anchor X; Y grows to accommodate lanes and nesting. This deterministic lane order avoids overlap between sequence bounding boxes without attempting force-directed compression.

All branch connectors use real parent/child/P atoms and bond IDs. Routing points are presentation sidecars. Linker coordinates are translated; real chemical bonds remain unchanged. The old wrapping routes are retained with their lane transforms. Native secondary fragments use existing local depiction and placement, retaining the existing triazole adapter. C's identity/mass invariance checks still apply to the final drawing.

LocalViewers is unchanged: drag/pan, zoom, Fit, Expand, Fullscreen, vector heteroatom text, Ctrl-wheel zoom and ordinary page-wheel scrolling remain available. Wide/tall structures are not globally rescaled in their chemical coordinate graph; the viewport may fit and users can zoom in.

The first implementation does not guarantee collision-free connector routing in dense branches or unusual reaction fragments. Exact zero-crossing perfection is intentionally not asserted. Molecular topology and provenance have priority.

## Optical and export boundaries

Existing linear and reaction optical algorithms are unchanged. A branched product has an explicit unsupported optical status because a validated branched nearest-neighbor extinction model is absent; component statuses are retained, and masses remain fully available. It never fabricates an OD by adding molecular masses or extinction values.

Checkpoint JSON includes the complete state and enough construction/layout information to restore it. MOL/SDF/CDXML use the complete actual graph with C coordinates; SVG may include routing geometry. MOL/SDF cannot store SVG routing bends without adding fake atoms, so no fake atoms are exported. CDXML retains its prior experimental status.
