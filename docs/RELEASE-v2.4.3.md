Oligo Toolkit v2.4.3

Changes since v2.4.2 (normal upgrade line):
- Chemistry Library master-detail browser with structure, attachment sites, formula, masses and optical Inspector; shared editor for creating and editing custom chemistry.
- Built-in category → members → Inspector navigation, metadata-based coverage of all 173 entries in 29 categories, plus direct search.
- Removed the separate Team Library interface; legacy team records migrate into My Custom. Single-entry and library import/export, merge conflict preview and legacy-library recovery are retained.
- Batch 2.1 sequence calculations and Batch 2.2 post-functionalization, Results Excel and structure exports; shared optical calculations including clearly marked estimates when modifier extinction data are unavailable.
- Configurable bases per column (default 5), shared SVG/CDXML grouping, editable real straight chemical bonds for CDXML cross-column connections. No fake overlay/mask routing was added.

Validation on the v2.4.3 runtime:
- Core: 72/72; library save/migration: 26/26; state hardening: 14/14.
- File:// category/Inspector navigation: Edge 217/217 and Chrome 217/217.
- Library UI/import/export/merge/download: Edge 15/15.
- Layout, Batch 2.1/2.2 and optical workflows: 26/26 expected outcomes.
- Reaction regression: 84 cases, 114/114 expected steps (102 automatic passes, 4 manual-path passes, 8 expected rejections).
- Total counted checks: 701/701. Optical v2 benchmark/identity/override/conversion suite also passed (not added to the numeric denominator).

Limitations / NOT TESTED:
- Desktop Excel interaction, arbitrary dense or cyclic structure layouts, and real-world modifier extinction coefficients were not validated in this release run. Missing coefficients remain estimates, not measured values.
- Real user browser storage was not modified in place. File-path/profile storage isolation may require exporting from the old version and importing into the new directory.
- Previously documented baseline failures remain outside this release gate: branch suite 28/29, reference-TNA and attachment compatibility assertions; old batch-registry loader and BP2 SMCC optical assertion are stale/incompatible. This release does not claim those suites pass.
- ChemDraw native opening/round-trip was tested for nine structures during candidate validation; not repeated for this formal packaging run. Automated structure/layout regression was repeated.

Extract the complete ZIP and open Start.html in Edge or Chrome. The release uses the normal upgrade line; Infinity is excluded.
