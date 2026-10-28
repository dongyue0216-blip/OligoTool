# Oligo Chemistry Toolkit

## Latest browser edition: Lite v0.7.0

Download the clean ZIP from [Lite v0.7.0](https://github.com/dongyue0216-blip/OligoTool/releases/tag/lite-v0.7.0), extract the whole folder, and double-click **Start.html**. No installation or network required. From a source checkout, open **lite/Start.html**.

Single Sequence, real atom/bond structure rendering, formula/MW/epsilon260/nmol per OD/ug per OD, terminal phosphate/PS notation, Batch Excel and Custom Chemistry are supported. See [Lite README](lite/README.md) for notation, supported chemistry and limitations. Conjugation Pool is metadata infrastructure; no conjugation reaction engine is implemented.

The Lite source contains only the current organized release under `lite/`. Release packaging guards and instructions are included in `lite/tests/release/` and `lite/docs/RELEASE_PACKAGING_CHECKLIST.md`.

---

## Original Python edition (separate v1.0.0 release)


Version **1.0.0**. A local, general-purpose oligonucleotide chemistry toolkit.

## Download and run / 下载与启动

Open this public repository's **Releases** page and download
`Oligo_Chemistry_Toolkit_v1.0.0.zip`. Public release downloads do not require a
GitHub account. Extract into a new writable folder. Windows x64 and an installed
Python 3.13 x64 are required. This is a runnable Python application, not a
self-contained executable; dependencies are installed separately.

1. Run `install_dependencies.bat` once. It respects your approved pip source.
2. Run `Start_Oligo_Toolkit.bat` to open the local application.
3. See [INSTALL_CN.md](INSTALL_CN.md) for installation and offline options.

## Features

- Molecular formula, monoisotopic exact mass and average molecular weight.
- OD260 / extinction coefficients, with estimates identified for modified sugars.
- Continuous 2D chemical structures and MOL, SDF and ChemDraw-compatible CDXML export.
- DNA, RNA and supported sugar/backbone/terminal modifications.
- Local custom chemistry import and residue integration using 5′/3′ attachment sites.

Examples: `ATGC`, `rArCrGrU`, `fA*fCrGmU`, `(P)rArU`, `rArU(PP)`.
PO has no separator, PS uses `*`, PS2 uses `**`, and MsPA uses `&`.

This public project contains general chemistry calculations. It does not include
company manufacturing know-how, process/experiment datasets or an AI platform.
No saved personal custom library is distributed. On first use the library is empty;
saving a structure creates `user_data/custom_chemistry.json` locally. Back up this
folder before upgrading and copy your own data into a new installation as needed.
Never commit private sequences or saved user libraries to the public repository.

## Limits

Custom Residue integration is supported; custom Linkage graph assembly is not yet
implemented. Undefined structures are rejected rather than guessed. Inosine OD260
is unsupported. Modified/mixed sugar OD260 uses an explicitly marked estimate.
LNA stereochemistry and MsPA tautomer definitions still need review; phosphorus
Rp/Sp is unspecified. CDXML is regression-tested through RDKit, but has not been
validated in the native ChemDraw GUI. MOL/SDF preserve conventional straight bonds;
the SVG/CDXML layout can display routed inter-column connections.

## Development and maintenance

Run `python tests/run_all_tests.py` after installing the locked dependencies.
See [MAINTAINING.md](MAINTAINING.md). Runtime release ZIPs exclude developer tests,
caches, environments, historical reports and saved user data.

## License and acknowledgments

Project code is under the [MIT License](LICENSE). Third-party packages retain their
own licenses and are installed separately. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
for the exact dependency inventory and references. No affiliation or endorsement by
dependency authors, ChemDraw or any employer is implied.
