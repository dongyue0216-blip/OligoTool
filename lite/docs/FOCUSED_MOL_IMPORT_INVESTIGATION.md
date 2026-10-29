# Focused MOL/SDF investigation — local fix, unpublished

Baseline: lite-v0.9.0, commit 34eb965cf3958a34c8f40b1eae540d32a188b782. Local published-stage chemistry.js matches the repository copy by SHA-256. Changes confined to app/chemistry.js, app/app.js, app/style.css and added regression/evidence files. GitHub was not modified.

## Conclusion and confidence
The original failure file and exact screenshot/error are unavailable. The user's specific incident is therefore not confirmed. Viewer dimensions did not reject any tested graph. A reproducible, size-independent format rejection is SGroup metadata: even OCCO (4 atoms) fails on `M  STY`, `M  SAL`, `M  SMT`, or `M  SDI`. Original message: `未覆盖的 MOL 属性：M  STY` (or corresponding code). These are MOL property records, not molecule-size statuses. STY describes SGroup types, SAL atom membership, SBL bond membership, SMT labels, SDI display/bracket information. V3000 also rejects nonzero SGroup counts/unsupported sections. The parser does not expand abbreviated or polymer groups; silently ignoring these could lose chemistry, so this fix provides an explicit explanation and fully expanded export guidance rather than discarding them.

## Audit
- V2000 uses 3-column counts: 1–999 atoms, with bond indices in the same fixed-width format. This is a format constraint; V3000 supports larger graphs. No universal atom/bond cap was found or added.
- No file-byte, line-count, coordinate-span, bounding-box, negative-coordinate, or viewport-size save limit. A single molecule per MOL/SDF is required. SDF property blocks after M END are accepted, including a 2.1 million character NOTE. Multiple SDF molecules are rejected explicitly.
- Coordinates normalize to median bond length 1.5 and translate to a local origin. Finite x/y are required; V3000 also checks z. Extreme finite arithmetic may fail if differences overflow numeric precision; no arbitrary coordinate bound is applied. Degenerate/all-coincident coordinates are not chemically rejected, but may remain visually overlapping. V2000 fixed-width fields must fit; the exporter automatically chooses V3000 if they do not.
- Chemical restrictions remain: supported neutral elements, connected graph, supported valence, no isotopes/charges in Custom scaffold, bond orders 1/2/3, supported wedge/hash fields, alcohol OH attachments. These restrictions are independent of atom count. Unsupported parity/HCOUNT/valence/SGroups are format or chemistry restrictions, not rendering restrictions.
- Existing SVG has a graph-derived viewBox and browser-native SVG hit targets; no bespoke client-to-graph mapping was found. Original radius .55 graph units shrinks to subpixel size on large structures. Added >=8 CSS-pixel hit radius plus zoom/scroll. Very dense adjacent targets require zoom or existing atom dropdowns. No synthetic graph hard cap added.
- Original showImported called preview inside the same import try/catch; a renderer exception could be reported as import failure. Preview exceptions now remain display-only and retain parsed graph, dropdowns and save availability. A forced renderer failure was tested through save.
- BuildingBlock/core validation and JSON schemas have no atom count, coordinate span, or payload threshold. localStorage.setItem is the only persistence quota boundary and varies by browser/origin. Simulated QuotaExceededError is now explained clearly; previous library remains intact. No attempt was made to fill a user's existing browser storage.

## Validation
36 matrix cases: atoms 6/100/500/999/1200/5000 × scales 1/10/100 × offsets 0/-100,000,000, each parsed both as MOL and SDF, with one/two attachment validation. V2000/V3000 transitions and a forced small V3000 were covered. Original baseline separately passed 18 large-coordinate parse/register cases up to 5000 atoms.
Browser workflow uses compact 2D chain graphs at 1200 and 5000 atoms: file upload → auto fit → actual pointer clicks → one/two sites → save → reload → restored block → Single/Batch formula match. Separate zoom/scroll pointer selection passed. Long-chain geometry is covered in the matrix. Largest tested graph 5000 atoms / 4999 bonds; this is evidence, not a supported maximum guarantee.
All 240 Lite + 125 Phase1 checks passed. Additional checks: malformed/truncated file, nonfinite coordinate, unsupported stereo/property, multi-record SDF, explicit SGroup errors, renderer isolation, quota rollback. Detailed evidence: results.json and baseline.json.

## Re-run
Set PLAYWRIGHT_MODULE to the installed Playwright module if not available on NODE_PATH; run `node tests/regression/large-import.cjs` with Microsoft Edge installed. This uses an isolated temporary browser context. Results are written to tests/evidence/large-import/.

## Import/save error inventory
No standalone four-letter import status enum was found. Likely short tokens include M STY/SAL/SBL/SMT/SDI and V3000 SUP/CFG/CHG/MASS/LABEL. M RGP, M CHG and M ISO are recognized records (though charge/isotope scaffold validation can reject their chemical meaning); OH is attachment terminology. SMILES belongs to the separate optional SMILES import, not the MOL parser. Core errors use CHEMISTRY_UNSUPPORTED and storage may throw QuotaExceededError; neither is a four-letter size code.

The following enumerates literal error-message prefixes in the MOL parser, attachment selection and registration paths (dynamic suffixes include specific fields/atom numbers). UI also reports file reading failures, missing structure/O selection, attachment confirmation, invalid/duplicate/reserved names, optical-property metadata, local restore failures, and storage write errors.

- Expected MOL V2000 or V3000
- 无效 atom count
- MOL V2000 atom line 
- Unsupported atom charge/radical code
- 无效 atom line
- 暂不支持 atom-line isotope mass difference，请用 M ISO
- 暂不支持 atom parity，请导出 wedge bond stereo
- 暂不支持显式 H/valence override
- MOL V2000 bond line 
- 仅支持 single/double/triple 与 wedge/hash；芳香键请导出 Kekulé
- 重复 bond
- Truncated V2000 record
- M property atom 越界
- MOL V2000 property 
- Truncated V3000 continuation
- MOL V3000 SGroup / collection metadata is not supported. Export a fully expanded, explicit molecule without abbreviation or polymer/repeat groups.
- Invalid V3000 atom
- Invalid V3000 
- Unsupported V3000 atom property 
- Invalid V3000 bond
- Unsupported V3000 bond property 
- MOL V3000 section is not supported: 
- V3000 count mismatch
- Invalid V3000 bond endpoints
- Truncated V3000 record
- Import one MOL/SDF molecule at a time
- SDF attachment must identify a real O
- Conflicting directional O labels
- Duplicate directional OH marker
- 手动模式也仅允许单键 terminal marker
- 手动模式的 marker 仍必须连接真实中性 O
- 同一 marker 的 5′/3′ 标记冲突
- 未分配的 general/R3 marker；仅 5/3 或 R1→5′、R2→3′ 可作为两端，其他 marker 请在原绘图中明确处理
- marker 必须唯一且只有一个 single bond
- marker 必须连接真实中性 O
- 需要不同的 5′/3′ attachment O
- Custom 仅覆盖中性 CHNOPS/F、无 isotope scaffold
- Custom scaffold 必须连通
- 不支持或存在歧义的价态；Custom P 仅覆盖五价 P，S 仅覆盖常规 2/4/6 价
- attachment 必须为 alcohol OH
- Select at least one directional OH attachment
- Select distinct OH attachments
- Atom 
- Invalid nonfinite coordinates
- Coordinates exceed numeric precision
- 名称不能为空；请使用 1–24 位英文字母、数字或下划线，可用数字或下划线开头
- Name / symbol already exists: 
- Reserved built-in name / symbol: 
- Invalid optical metadata
- Invalid extinction metadata
