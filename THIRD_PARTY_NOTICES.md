# Third-party software

All runtime dependencies are local. No CDN is required.

| Component | Version / license | Distribution |
|---|---|---|
| RDKit MinimalLib / @rdkit/rdkit | 2026.9.1, BSD-3-Clause | vendor/RDKit_minimal.js; vendor/rdkit-binary.js encodes the original WASM as bytes |
| CoordGenLibs | BSD-3-Clause | RDKit native dependency; notice retained conservatively |
| SheetJS Community Edition | 0.18.5, Apache-2.0 | vendor/xlsx.full.min.js |
| JSZip | 3.10.1, MIT or GPLv3; distributed under MIT | vendor/jszip.min.js, bundled dependencies' notices retained |

Full notices: vendor/rdkit-LICENSE, vendor/coordgen-LICENSE, vendor/SheetJS-LICENSE.txt, vendor/JSZip-LICENSE.markdown. Additional native dependency notices are in vendor/licenses/.
RDKit source/build reference: https://github.com/rdkit/rdkit/tree/Release_2026_09_1/Code/MinimalLib ; official npm package @rdkit/rdkit 2026.9.1. JavaScript wrapper and WASM are unmodified; the offline bytes wrapper is local packaging only.
No Indigo, CDK, Python, Java, Playwright or commercial drawing program is distributed as runtime.
Toolkit code retains its MIT LICENSE. The chemical brand image is the user's explicitly approved generated asset, used without changing the pattern.
