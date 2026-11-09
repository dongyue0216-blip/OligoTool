# Oligo Toolkit v2.4.1

- Detect SPAAC when the original JQ1.mol is uploaded after applying the built-in DBCO reagent to a C6N oligo. Preview and apply either of the two distinct C–N connectivities.
- Advanced / Manual starts at Auto-detect for each new step. Detection no longer falls through to CAP when no reaction family has been selected.
- Quick discovery includes single-molecule disulfide reduction. Element Core support carries forward from the v2.4.0 local baseline.
- The original Edge file:// regression covered 16/16 built-in reagents, 25/25 applicable reagent–definition pairs, 7/7 current reaction definitions, 18/18 multistep workflows, and 8/8 expected rejections. The release recheck reran the same 84 scenarios and 114 steps in Edge, with 106 successful steps, 8 expected rejections, and no uncaught browser exceptions.

The published ZIP is the original validated archive. Its 114 runtime files match the corresponding paths under `offline/` byte for byte. Its SHA-256 is `d1adf6337a963e0c56341caa530ff052737cc812d2aa668415558c263965ebb1`. The archived README retains an older sentence that says the original MOL is still awaiting testing. The Edge regressions above cover that original file.

To rerun the UI matrix with Node.js 22 or newer, run `node offline/tests/v2.4.1/run.cjs "<Edge executable>"`. Pass the extracted runtime directory as the second argument to test the release ZIP contents.
