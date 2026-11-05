# Architecture Hardening & Hybridization Foundation — implementation report

Date: 2026-11-05 (Asia/Shanghai). Development workspace: `outputs/molecule-builder/Oligo-Toolkit`.

## Audit and preservation

The project mirror root is not a Git repository. The active Branch repository is its `outputs/molecule-builder` directory: HEAD `0b8d56c` (v2.1.0 baseline), with substantial pre-existing uncommitted Branch work. This task started from those working files, not from HEAD, a release archive, or the nested packaged copy. Existing documentation references accepted upstream commit `9d418b3`; that is provenance, not the local HEAD.

Read the referenced chat and `research_external_20261104/EXTERNAL_ARCHITECTURE_STRESS_TEST.md`. Recorded the initial Git status, full existing diff and SHA-256 manifest under `../audit-hardening/`. No local AGENTS.md beyond the project rules or separate authoritative LOCKED policy file was found in the active tree. Applied the requested Surgical Change boundary: retain unrelated working changes and existing UI, reference chemistry, reaction rules, optical engine, Batch, logo, layout and viewport code. No files under `sources/`, Git index, commits, releases or remote repositories were changed.

Four existing application files changed in this task:

| File | Change |
| --- | --- |
| `app/snapshots/A/app/core.js` | Remove linear edge-count and sequence-adjacency constraints from AssemblyGraph validation; retain site/valence/domain/consumption/termination validation. |
| `app/snapshots/A/app/chemistry.js` | Expand each edge through its explicit source/target node IDs and local sites, rather than assuming edge i joins nodes i and i+1. Preserve existing linear output hashes. |
| `app/molecule-builder.js` | Add general connection, component collection, annotations, stable site identity, per-component validation and reaction materialization metadata. |
| `Start.html` | Load two additive hybridization modules after the existing application. |

New application files: `app/hybridization.js` (A) and `app/hybridization-ui.js` (B). No existing B workflow or C layout module changed. New tests, evidence and this report accompany them.

## Actual implemented contracts

### General covalent topology and stable sites

`AssemblyGraph` validates arbitrary explicit edges, including closure and disconnected sets of building blocks. Node order/orientation remain recorded organization metadata; edges no longer follow that order by requirement. Expander atom endpoints resolve the named nodes/sites, including a closure edge. Existing linear coordinate and chemistry fixtures remain identical.

MoleculeState keeps its existing hierarchical lanes and `branchEdges`; additive `assemblyGraph.covalentEdges` stores connections between already-existing sites. `MoleculeBuilder.connect(state, {source, target, linkage})` materializes the existing validated linkage graph, consumes endpoint hydrogens/sites and adds real covalent bonds. It does not create a child lane or infer chemistry from hierarchy. Endpoint identity is `{nodeInstanceId, siteId}`. Legacy `id`, `path`, `node`, direction and labels remain for compatibility; stable IDs are derived additively for old checkpoints and validated against their stored node/site provenance. Directional compatibility still constrains chemistry; UI labels do not select atoms.

`components[]` is derived from actual atom/bond connectivity; each component is independently valence-validated. `combine(states)` collects complete graphs with offsets, remaps sites/annotations/presentation fragment mappings and keeps source states. No intercomponent bond is invented. Imported explicit disconnected graphs are supported through `fromGraph`.

### Interactions and future annealing path

`interactionAnnotations[]` persists immutable records with ID, kind and participants. A `basePair` requires two participants; generic kinds can carry N participants. Participants must resolve to current atom indices and can additionally retain strand/residue references and source metadata. These are relations, never molecular bonds. `annotate` saves them without changing the graph. Restore preserves unknown additive state/annotation metadata.

Hybridization returns candidate residue-pair maps. `proposeInteractions` requires an explicit residue-to-current-atom map; `annotate` can persist the resulting candidate relations on a collected state. This is a data path, not an implemented confirmation workflow or Annealing Operation. No guessed base-to-atom mapping, confirmation, folding or 3D construction occurs automatically.

### Reaction materialization

Each new ReactionOperation records its input state snapshot/ID, optional secondary graph, input atom maps, existing reaction definition and schema version, graph revision, site atom remapping/consumption and exact before/after graph snapshots (`graphEdits.encoding = exact-product-snapshot/1`). This is snapshot-based graph edit evidence, not a compact edit-script executor.

Reaction products are marked `provenance-only`: their current MolecularGraph is authoritative. Lane assemblies are historical source organization and are never re-expanded over the product. Restore validates and preserves the current product graph. Branching after a reaction retains this status, and subsequent operations increment graphRevision. Exact untransformed assemblies can be classified `expandable-exact`; no new general replay engine is claimed. Legacy reaction checkpoints gain conservative provenance-only defaults.

Reaction mappings update sites, lanes, branch edges and additive covalent edges. Annotation participants are remapped; a reaction removing an annotated participant fails closed rather than silently deleting its relation. Multi-component reaction selection is explicitly unsupported in v1 and fails before invoking the unchanged reaction engine.

### Hybridization Analysis v1

Core request/result schemas use `strands[]`. Core supports pairwise analysis across up to 16 input strands; the UI exposes one or two. Each strand is bounded to 500 residues. Plain A/C/G/T/U is accepted as an explicit sequence alphabet; source records and unknown tokens/linkages are retained. No modified-residue or linkage thermodynamic projection occurs.

Two strands: deterministic ungapped antiparallel offset search, scored as `2 * complementaryPairs - mismatches`; ties prefer the longest continuous complementary run, then overlap length. Output includes residue pair map, aligned columns, paired count, percentage, mismatches, overhang indices and longest continuous complementary run. Pair percentage denominator is aligned overlap; a separate coverage fraction is `2*pairs / total residues`. This scoring is a sequence heuristic and can prefer a shorter matching overlap.

One strand: enumerate contiguous complementary stems with minimum loop length 3 and default minimum stem 2. Return stem pairs, loop, overhangs, percentage of all residues participating and longest run. Candidates may overlap/nest; they are alternatives, not a simultaneously realizable fold. Count all candidates and retain at most the top 100; UI displays up to 10 and exports the retained set.

The UI shows readable alignment/paired positions and exports analysis JSON. Editing input invalidates the previous export. It does not modify Molecule Builder history.

Internal bulges are explicitly **not modeled**, rather than reported as zero. No Tm, deltaG, equilibrium fraction or annealing-stability claim is produced. G–U wobble, noncanonical pairs, pseudoknots and gapped alignments are not implemented.

### Resolution and User Library compatibility

Sequence analysis returns `exact`, `partial` or `unresolved` resolution records, with raw input and unresolved positions. The resolution scope is explicit sequence identity, not an atom-level chemical proof. Any unresolved strand/linkage suppresses the entire analysis; positions are not silently deleted and unknown linkages never become PO. Molecular checkpoints require exact, validated explicit atom graphs; partial/unresolved molecular construction is rejected rather than materialized.

User Library envelope/record schemaVersion remains 1 (the v2.00 baseline). No migrator, rewrite, redraw or reselection was introduced. Existing persistence and version rejection code is byte-identical. Tests cover original one- and two-site fixtures through import, reload, export, calculation, and synthetic unknown metadata preservation. Unsupported future envelope versions are rejected. Existing graph/sites/coordinates/metrics/optical/provenance records remain byte-for-byte equal through the tested persistence path.

## Verification

- `node tests/hardening-tests.cjs`: **14/14**. Circular closure without child creation, multi-component collection/no false bonds, existing-node crosslink, general graph expansion, interaction persistence/N-ary foundation, reaction product materialization, stable IDs/A–C invariance, unknown chemistry, future schema rejection, v2.00 one/two-site metadata retention, legacy checkpoint defaults, duplex orientation, mismatch/overhang, hairpin and explicit annotation mapping.
- `node tests/branch-tests.cjs`: **29/29**. Includes reaction/branch chains, custom sites, six linkage classes, reusable checkpoints and exact original linear graph/coordinate/formula hashes at 30–200 nt.
- `node tests/regression.cjs`: **76/76**, including the existing chemistry/reaction/library and invariance suite. Audit emitted 152 entries with 23 existing ghost-audit entries; this is not a claim of zero unresolved catalog coverage.
- Existing `../browser-acceptance.cjs`: **Edge and Chrome PASS**. Branch→reaction→nested branch, checkpoint exports, custom library save/reload/view, navigation, language state, large structures/zoom and offline zero remote requests; no page errors.
- `node tests/hybridization-browser.cjs`: **Edge and Chrome PASS**. Duplex, hairpin, unknown input, edit invalidation, JSON download, no page errors. Screenshots inspected.
- `git diff --check`: PASS. SHA-256 comparison identifies this task's modified application files separately from pre-existing work.

Results and tests are saved under `tests/`; initial-state and scope evidence is under `../audit-hardening/`. Initial restricted browser launches failed at process startup; the same local tests passed with browser execution permission. This was an environment launch failure, not a failed functional assertion.

## Limits and next steps

This is a development implementation, not a release package. The pre-existing `../Oligo-Toolkit.zip` and nested packaged directory were not rebuilt and do not contain this task. Open the active `Start.html` to review the implementation.

General topology and multiple components have model/API coverage, not new closure/crosslink/component-selection UI. Existing C presentation remains unchanged: new disconnected root lanes can overlap and closure/crosslink geometry is not specially optimized. General graph linkage terminations inside nonterminal nodes can still fail explicitly in the inherited layout expander. No arbitrary graph layout-quality promise is made.

Reaction snapshots increase checkpoint size, especially in long histories. They preserve evidence but are not a replay/compact graph-delta implementation. Existing engine reaction-definition schema/rule versions are recorded; content-hash versioning is a future strengthening. Reaction selection within multi-component states, and explicit resolution of deleted annotation participants, need dedicated workflows.

Full HELM, Canonical Identity, full Annealing Operation, NUPACK/ViennaRNA, modified-oligo thermodynamics, OD overhaul, 3D, aptamer prediction, AI and Manufacturing Schema are not implemented. The next useful work is explicit residue↔base-atom mapping and confirmation UI, followed by an Annealing Operation and component-aware reactions/layout. Thermodynamics requires separately validated chemistry/condition models.
