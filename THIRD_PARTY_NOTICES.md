# Third-party acknowledgments

Dependencies are installed separately from their original distributions; this repository and runtime ZIP do not bundle third-party package code, wheels, fonts or native libraries. Their original licenses and notices remain applicable. Project MIT terms do not replace dependency licenses.

Primary projects: [RDKit](https://github.com/rdkit/rdkit) ([BSD-3-Clause](https://github.com/rdkit/rdkit/blob/master/license.txt)); [Streamlit](https://github.com/streamlit/streamlit) ([Apache-2.0](https://github.com/streamlit/streamlit/blob/develop/LICENSE)); [pandas](https://github.com/pandas-dev/pandas); [NumPy](https://github.com/numpy/numpy).

The table records exact local wheel METADATA for the dependency lock, rather than claiming every bundled subcomponent has the same license. When distributing an offline wheelhouse, preserve the complete unmodified original distributions, including LICENSE/NOTICE files and bundled-component notices. No third-party implementation code has been copied into the public project during release preparation.

| Package | Version | Declared license |
| --- | --- | --- |
| altair | 6.2.2 | License :: OSI Approved :: BSD License |
| anyio | 4.14.2 | MIT |
| attrs | 26.1.0 | MIT |
| blinker | 1.9.0 | License :: OSI Approved :: MIT License |
| certifi | 2026.7.22 | MPL-2.0 |
| charset-normalizer | 3.5.1 | MIT |
| click | 8.4.2 | BSD-3-Clause |
| colorama | 0.4.6 | License :: OSI Approved :: BSD License |
| h11 | 0.16.0 | MIT |
| httptools | 0.8.0 | MIT |
| idna | 3.19 | BSD-3-Clause |
| itsdangerous | 2.2.0 | License :: OSI Approved :: BSD License |
| Jinja2 | 3.1.6 | License :: OSI Approved :: BSD License |
| jsonschema | 4.26.0 | MIT |
| jsonschema-specifications | 2025.9.1 | MIT |
| MarkupSafe | 3.0.3 | BSD-3-Clause |
| narwhals | 2.25.0 | MIT |
| numpy | 2.5.2 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| packaging | 24.2 | License :: OSI Approved :: Apache Software License; License :: OSI Approved :: BSD License |
| pandas | 3.0.5 | License :: OSI Approved :: BSD License |
| pillow | 12.3.0 | MIT-CMU |
| protobuf | 7.36.0 | 3-Clause BSD License |
| pyarrow | 25.0.1 | Apache-2.0 |
| pydeck | 0.9.3 | Apache License 2.0 |
| python-dateutil | 2.9.0.post0 | Dual License |
| python-multipart | 0.0.32 | Apache-2.0 |
| rdkit | 2026.9.1 | BSD-3-Clause |
| referencing | 0.37.0 | MIT |
| requests | 2.34.2 | Apache-2.0 |
| rpds-py | 2026.6.3 | MIT |
| six | 1.17.0 | MIT |
| starlette | 1.6.0 | BSD-3-Clause |
| streamlit | 1.62.0 | Apache-2.0 |
| toml | 0.10.2 | MIT |
| typing_extensions | 4.16.0 | PSF-2.0 |
| tzdata | 2026.3 | Apache-2.0 |
| urllib3 | 2.7.0 | MIT |
| uvicorn | 0.52.4 | BSD-3-Clause |
| watchdog | 6.0.0 | Apache-2.0 |
| websockets | 16.1.1 | BSD-3-Clause |

Scientific data: built-in chemistry definitions and short random test sequences were cleared for public use by the project owner. Chemistry snapshots preserve their existing record-level source fields. Numerical reference fixtures verify consistency; they are not claimed as an independent experimental validation. OD260 nearest-neighbor tables are inherited from earlier toolkit calculations; commercial-calculator equivalence has not been independently established. Modified/mixed-sugar values are estimates as documented. No external proprietary calculator code is included.
