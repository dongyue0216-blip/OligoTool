# Oligo Toolkit v2.1.0

Extract the complete folder and double-click **Start.html** in Windows Edge or Chrome. No installation, server, Python, Node, administrator rights or network is required.

Sequence and Excel Batch share the chemistry core and Built-in/User Library. Includes formula, average MW, exact mass, optical status, molecular presentation, structure exports, Custom Chemistry, Reaction Notebook, CAP, Amine Coupling, Click Reaction, Disulfide Reduction and Thiol–Maleimide.

User Library compatibility starts at v2.00 (release v2.0.0, schemaVersion 1). Export your User Library JSON before upgrading, then Import/Merge in this release. Browser storage is local to the browser and file location. Built-in updates never overwrite User Library. See [schema contract](docs/USER_LIBRARY_SCHEMA.md).

CAP recognition uses terminal-phosphorus topology and activated diphosphate phosphoroimidazolide structure. Structural compatibility does not establish experimental reaction efficiency. Unsupported chemistry fails explicitly. Unknown optical parameters remain explicit; CDXML is experimental. Arbitrary chemistry and collision-free layout are not guaranteed.

See [release validation](tests/RELEASE_TEST_REPORT.md) and [release naming policy](docs/RELEASING.md). No personal libraries or local user MOL files are included.
