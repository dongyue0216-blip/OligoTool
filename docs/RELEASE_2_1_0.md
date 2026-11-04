Oligo Toolkit v2.1.0

- Includes the accepted Built-in placeholder/invAb fixes; CAP phosphoroimidazolide reagent recognition and topology-based terminal phosphorus matching, preserving the original phosphorus substituents.
- Includes Amine Coupling, Click Reaction, Disulfide Reduction and Thiol–Maleimide, with existing Sequence calculations/OD, Reaction Notebook, structure exports and presentation.
- Custom Chemistry save/reload/export/import and Batch Excel use the same chemistry core. User Library compatibility retains the v2.00 / v2.0.0 baseline (schemaVersion 1); Built-in updates remain separate from user data. Export User Library JSON before moving/upgrading, then Import/Merge.
- Preserves the approved logo and bilingual interface; restores language preference across reloads. No schema break or pre-v2.00 migration.

Download **Oligo-Toolkit-v2.1.0.zip**, extract the entire folder and double-click **Oligo-Toolkit/Start.html**. Windows Edge/Chrome; no installation, server, network, Python, Node or administrator rights required.

Validation: 76 recent checks, 17 CAP/baseline checks, 4,888 reaction assertions / 120 products; 22 reaction UI/family checks; Edge/Chrome Custom Library + XLSX graph/metric/export parity; 360 viewer records with zero failures. See `tests/RELEASE_TEST_REPORT.md` in the ZIP or `offline/tests/RELEASE_TEST_REPORT.md` in the repository for exact coverage and limitations. CAP structural compatibility does not establish experimental efficiency. Unsupported chemistry remains explicit; CDXML is experimental.
