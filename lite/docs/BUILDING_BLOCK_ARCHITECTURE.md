# Building Block architecture — Lite v0.7.0

**The assembler connects attachment sites, not residue identities.**

`upstream` and `downstream` describe sequence direction. The UI labels these as 5′ side / 3′ side; **direction label ≠ literal sugar carbon numbering**. TNA and GNA declare O3→O2 topology; PMO declares OH→NH. Family, base and sugar describe identity and are not connection permissions.

## Actual implementation audit

The audited baseline is published v0.6.0, commit `c79b290e18fbf22aaf5b12db04a132d374d2b1af`. It already had a shared phosphorus fragment builder and standard-monomer terminal contracts. However, assembly still read `o5/o3`, alternative topology validation dispatched on family, Custom required two OH sites, only V2000 imported, and the UI rejected files larger than 2 MB. Core OH validation did **not** test the carbon's substitution degree; marker failures, mandatory paired sites and the import/UI restrictions explained apparent secondary-OH failures. This release removes those restrictions rather than adding a primary/secondary whitelist.

`app/building-block-registry.json` records all implemented built-in graphs and directional contracts. `REFERENCE.templates` in `reference-data.js` is its offline runtime snapshot alongside masses and linkage fragments. `Lite.getBuildingBlock(id)` resolves built-in and user-added blocks through the same registry lookup. `customLibrary` is the user storage partition of that registry, not a second assembly engine. `master-library.v1.json` is a synchronized descriptive catalogue, not an alternative connection authority. Tests compare these snapshots to detect drift.

A `building-block/2` contains `id`, `atoms`, `bonds`, `attachments`, `assembly_class`, topology and optional descriptive/layout metadata. `atoms` + `bonds` are the molecular graph. An attachment declares its zero-based `atom`, `atom_role`, `direction`, `element`, `connection_class`, `local_bonds`, `allowed_linkage_classes`, internal and terminal permissions. Missing directions are absent, never cloned from the other end. Legacy `o5/o3` and `5_prime_attachment/3_prime_attachment` fields remain for backward-compatible catalogue/tests; current assembly resolves `attachments`.

## Migration and chemistry boundaries

| Registry group | Graphs | Implementation |
|---|---:|---|
| DNA | 6 | Shared directional O-linked assembler + six phosphorus chemistries |
| RNA, 2′-F, 2′-OMe, MOE, FANA, UNA, 2′-NMA, 2′-O-C16, 2′-O-C22, LNA, ENA | 7 each | Same O-linked interface and engine; all 84 standard blocks including Benner Z are tested |
| TNA | 5 | Real alpha-L-threose O3→O2 sites; homogeneous chains retain existing six internal chemistries; terminal/mixed topology unsupported |
| GNA | 4 | Real S-glycerol O3→O2 sites; homogeneous chains retain existing six internal chemistries; terminal/mixed topology unsupported |
| PMO | 5 | Real O/N sites; dedicated PMO phosphorodiamidate fragment; uncapped homogeneous chains only |
| cEt | 0 | Recognized notation, no validated final graph in baseline; remains pending |
| Vpm/Vpe and built-in modifiers | Existing graphs | Explicit directional contracts preserve existing internal/end-placement behavior; unvalidated terminal phosphorus remains unsupported |
| Custom OH blocks | User supplied | One or two actual OH sites, same O-linked engine; no Custom-specific phosphorus whitelist |

The engine validates each boundary's outgoing/downstream and incoming/upstream sites before modifying atoms. It consumes one attachment hydrogen on each side and inserts the existing linkage graph. Terminal phosphorus uses the same fragment builder and the declared available side. Formula is cross-checked against component and direct composition; mass and exports derive from the resulting graph.

PMO's N contract only permits `PMO`, not the six standard O-linked chemistries. `PO` notation in a homogeneous PMO chain resolves to its dedicated phosphorodiamidate linkage. Mixed PMO/TNA/GNA boundaries, their terminal phosphorus, and modified PP/PPP without specified phosphorus positions return `CHEMISTRY_UNSUPPORTED` with a reason and no formula or graph. No speculative graphs were added. cEt and other missing-scaffold entries retain their explicit pending status.

Descriptive family names no longer select topology or assembly sites. Display-only expanded routing uses layout metadata. New standard O-linked graphs need valid directional contracts, not new terminal family cases. The regression suite changes family/base/sugar labels and omits legacy attachment fields on a new graph to prove this.

## Import and display

V2000's three-digit atom count is a format constraint; larger records use V3000. Both import and export are supported, including V3000 nonsequential atom IDs, continued lines and wedge/hash bonds. Undefined properties are rejected explicitly rather than discarded. Single-molecule SDF is supported; multiple records are rejected to avoid silently saving just one molecule.

There is no application atom-count, file-byte, molecular-size or coordinate-span cap in Custom import. Coordinates are translated and positively uniformly scaled to a median bond length, then optionally rotated for directional placement; no reflection is used. Graph connectivity, formula and wedge handedness are retained. Bounds reductions avoid the JavaScript spread-argument atom-count failure, and the viewer fits its complete viewBox. Browser memory, numeric precision, DOM and localStorage capacity remain real engineering limits. Fit-to-view does not promise legibility of every atom simultaneously in a very large molecule; vector export and browser zoom remain available.

Supported Custom chemistry remains a neutral connected CHNOPS/F molecular graph, ordinary valence, Kekulé single/double/triple bonds and wedge/hash stereo. Charged/isotopic scaffolds, query atoms, undefined valence/stereo properties and extended SGroups/collections require an explicit future model. Large size does not bypass chemical validation. Default UI selects actual C–OH; the schema supports N, while Advanced Custom N-linked registration is not exposed yet.

## Verification

See `tests/evidence/REGISTRY_AUDIT_v070.json`, `BUILDING_BLOCKS_v070.json`, `ATTACHMENT_MATRIX.json`, `CUSTOM_BROWSER_v070.json` and the release test report. Coverage includes the full registry, six phosphorus classes, both termini/internal positions, secondary OH pairings, one-site directions, marker detection/manual selection, 1,200/12,000-atom structures, large coordinate origins/spans, graph/formula/mass/export consistency, immediate Single/Batch usage and continuous Custom entry.
