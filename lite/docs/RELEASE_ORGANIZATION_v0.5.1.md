# v0.5.0 → v0.5.1 发布包目录整理

基线：原始 Oligo_Chemistry_Toolkit_Lite_v0.5.0.zip，实际 121 个文件；所有迁移直接读取该 ZIP，未使用工作目录内混杂的旧产物。根目录只保留 Start.html、README.md 两个文件。

## 迁移范围

- 主程序、样式、共享 chemistry engine、registry 和 chemistry data → app/。
- 测试脚本 → tests/regression/；QA gallery/SVG/PNG、Excel/ZIP 样本 → tests/fixtures/；历史报告与 provenance → tests/evidence/。
- 两个 MOL 示例及 extinction schema → custom_chemistry/。
- Batch 模块及 Excel 输入模板 → batch/；仍只调用 app/ 中唯一 Lite 引擎。
- 长说明 → docs/；vendor/ 原有库、许可证、attribution 原样保留。

核心 JS、全部样式与 batch.js 均经 SHA256 比对，逐字节不变；只改 Start.html 路径/版本、测试执行器路径、gallery 导航、说明文档。未改计算、structure layout、导出算法或 localStorage key/读写逻辑。新文件路径的 localStorage 隔离由浏览器决定，旧库通过原有 JSON 备份/恢复迁移。

## 精简

仅从新发布包省略 browser-results.xlsx、browser-structures.zip（重复浏览器导出）和 BATCH_UI.png、BATCH_PANEL.png（旧版界面截图）。保留 qa-batch-results.xlsx、qa-batch-structures.zip 作为回归样本；保留 chemistry/structure 参考、全部历史 QA 图和数据。不删除旧 ZIP 或源文件。旧 FILE_MANIFEST/FILE_CHANGES 作为历史证据保留；当前清单见 RELEASE_MANIFEST.json。tests/output/ 是测试临时输出，未打入发布包。

## 验证

- verify-release：277/277 PASS，覆盖 95 FULL / 7 既有 pending，含 9–200-mer 布局回归。
- verify-batch：382/382 PASS，含 Single/Phase 1、Custom registry、四种导出、Excel 数值/ZIP 回读、坏行隔离、取消、100/500/1000 条计算与 SVG 批处理。
- Edge headless file://：页面内 365/365 PASS；11 组新旧 chemistry、optical、graph、SVG、MOL、CDXML 输出完全一致；实际 Single UI、Custom MOL/SDF 上传/保存/刷新/JSON 备份恢复、custom Batch、Excel 预览计算/模板与结果下载通过；页面错误、资源失败、远程请求均为零。
- 检查所有 HTML src/href 本地路径，无缺失。ZIP 字节回读、SHA256 和重新解压后的 file:// 验证另见 RELEASE_ARCHIVE_QA.json。

完整逐文件迁移表如下；机器可读记录及原始核心 hash 见 tests/evidence/REORGANIZATION.json。

|旧路径|新路径|
|---|---|
|`BASELINE_PROVENANCE.json`|`tests/evidence/BASELINE_PROVENANCE.json`|
|`BATCH_BASELINE.json`|`tests/evidence/BATCH_BASELINE.json`|
|`BATCH_BROWSER_QA.json`|`tests/evidence/BATCH_BROWSER_QA.json`|
|`BATCH_QA.json`|`tests/evidence/BATCH_QA.json`|
|`BATCH_TEST_REPORT.md`|`tests/evidence/BATCH_TEST_REPORT.md`|
|`CHANGELOG.md`|`docs/CHANGELOG.md`|
|`CHEMISTRY_COVERAGE.md`|`docs/CHEMISTRY_COVERAGE.md`|
|`CONJUGATE_STRESS_QA.json`|`tests/evidence/CONJUGATE_STRESS_QA.json`|
|`CONJUGATE_TRANSFORMATIONS.json`|`tests/evidence/CONJUGATE_TRANSFORMATIONS.json`|
|`DEPICTION_QA.json`|`tests/evidence/DEPICTION_QA.json`|
|`EXPORT_QA.json`|`tests/evidence/EXPORT_QA.json`|
|`FILE_CHANGES.json`|`tests/evidence/FILE_CHANGES.json`|
|`FILE_MANIFEST.json`|`tests/evidence/FILE_MANIFEST.json`|
|`GLYPH_QA.json`|`tests/evidence/GLYPH_QA.json`|
|`PHASE1_TEST_EVIDENCE.json`|`tests/evidence/PHASE1_TEST_EVIDENCE.json`|
|`PHOTOMETRY.md`|`docs/PHOTOMETRY.md`|
|`README.md`|`README.md`|
|`SEQUENCE_REQUIREMENT_MATRIX.md`|`docs/SEQUENCE_REQUIREMENT_MATRIX.md`|
|`Start.html`|`Start.html`|
|`UPGRADE_TEST_EVIDENCE.json`|`tests/evidence/UPGRADE_TEST_EVIDENCE.json`|
|`VALIDATION_REPORT.md`|`docs/VALIDATION_REPORT.md`|
|`VISUAL_QA_v042.json`|`tests/evidence/VISUAL_QA_v042.json`|
|`app.js`|`app/app.js`|
|`attachment-demo.mol`|`custom_chemistry/attachment-demo.mol`|
|`batch input template.xlsx`|`batch/batch input template.xlsx`|
|`batch.js`|`batch/batch.js`|
|`chemistry-coverage.json`|`app/chemistry-coverage.json`|
|`chemistry.js`|`app/chemistry.js`|
|`conjugation-pool.js`|`app/conjugation-pool.js`|
|`conjugation-pool.json`|`app/conjugation-pool.json`|
|`coverage-data.js`|`app/coverage-data.js`|
|`custom-MOE-5-3-example.mol`|`custom_chemistry/custom-MOE-5-3-example.mol`|
|`custom-extinction.schema.json`|`custom_chemistry/custom-extinction.schema.json`|
|`evidence/FAM.json`|`tests/evidence/FAM.json`|
|`evidence/L96.json`|`tests/evidence/L96.json`|
|`evidence/NAG37-precursor.json`|`tests/evidence/NAG37-precursor.json`|
|`evidence/NAG37.json`|`tests/evidence/NAG37.json`|
|`evidence/baseline-v041/BROWSER_QA.json`|`tests/evidence/baseline-v041/BROWSER_QA.json`|
|`evidence/baseline-v041/CHEMISTRY_COVERAGE.md`|`tests/evidence/baseline-v041/CHEMISTRY_COVERAGE.md`|
|`evidence/baseline-v041/FILE_MANIFEST.json`|`tests/evidence/baseline-v041/FILE_MANIFEST.json`|
|`evidence/baseline-v041/README.md`|`tests/evidence/baseline-v041/README.md`|
|`evidence/baseline-v041/TEST_EVIDENCE.json`|`tests/evidence/baseline-v041/TEST_EVIDENCE.json`|
|`evidence/baseline-v041/VALIDATION_REPORT.md`|`tests/evidence/baseline-v041/VALIDATION_REPORT.md`|
|`interface.schema.json`|`app/interface.schema.json`|
|`master-library.v1.json`|`app/master-library.v1.json`|
|`phase1-tests.js`|`tests/regression/phase1-tests.js`|
|`qa-batch-results.xlsx`|`tests/fixtures/qa-batch-results.xlsx`|
|`qa-batch-structures.zip`|`tests/fixtures/qa-batch-structures.zip`|
|`qa-v040/benner.svg`|`tests/fixtures/qa-v040/benner.svg`|
|`qa-v040/bridge.svg`|`tests/fixtures/qa-v040/bridge.svg`|
|`qa-v040/fam.svg`|`tests/fixtures/qa-v040/fam.svg`|
|`qa-v040/gallery.html`|`tests/fixtures/qa-v040/gallery.html`|
|`qa-v040/galnac-200.svg`|`tests/fixtures/qa-v040/galnac-200.svg`|
|`qa-v040/galnac-9.svg`|`tests/fixtures/qa-v040/galnac-9.svg`|
|`qa-v040/galnac.svg`|`tests/fixtures/qa-v040/galnac.svg`|
|`qa-v040/gna.svg`|`tests/fixtures/qa-v040/gna.svg`|
|`qa-v040/mixed-21.svg`|`tests/fixtures/qa-v040/mixed-21.svg`|
|`qa-v040/pmo.svg`|`tests/fixtures/qa-v040/pmo.svg`|
|`qa-v040/sidechain.svg`|`tests/fixtures/qa-v040/sidechain.svg`|
|`qa-v040/spacers.svg`|`tests/fixtures/qa-v040/spacers.svg`|
|`qa-v040/tna.svg`|`tests/fixtures/qa-v040/tna.svg`|
|`qa-v040/visual-benner.png`|`tests/fixtures/qa-v040/visual-benner.png`|
|`qa-v040/visual-bridge.png`|`tests/fixtures/qa-v040/visual-bridge.png`|
|`qa-v040/visual-fam.png`|`tests/fixtures/qa-v040/visual-fam.png`|
|`qa-v040/visual-galnac-200.png`|`tests/fixtures/qa-v040/visual-galnac-200.png`|
|`qa-v040/visual-galnac-9.png`|`tests/fixtures/qa-v040/visual-galnac-9.png`|
|`qa-v040/visual-galnac.png`|`tests/fixtures/qa-v040/visual-galnac.png`|
|`qa-v040/visual-gna.png`|`tests/fixtures/qa-v040/visual-gna.png`|
|`qa-v040/visual-mixed-21.png`|`tests/fixtures/qa-v040/visual-mixed-21.png`|
|`qa-v040/visual-pmo.png`|`tests/fixtures/qa-v040/visual-pmo.png`|
|`qa-v040/visual-sidechain.png`|`tests/fixtures/qa-v040/visual-sidechain.png`|
|`qa-v040/visual-spacers.png`|`tests/fixtures/qa-v040/visual-spacers.png`|
|`qa-v040/visual-tna.png`|`tests/fixtures/qa-v040/visual-tna.png`|
|`qa-v040/visual-vp.png`|`tests/fixtures/qa-v040/visual-vp.png`|
|`qa-v040/vp.svg`|`tests/fixtures/qa-v040/vp.svg`|
|`qa-v041/fam.png`|`tests/fixtures/qa-v041/fam.png`|
|`qa-v041/fam.svg`|`tests/fixtures/qa-v041/fam.svg`|
|`qa-v041/gallery.html`|`tests/fixtures/qa-v041/gallery.html`|
|`qa-v041/l96.png`|`tests/fixtures/qa-v041/l96.png`|
|`qa-v041/l96.svg`|`tests/fixtures/qa-v041/l96.svg`|
|`qa-v041/lna.png`|`tests/fixtures/qa-v041/lna.png`|
|`qa-v041/lna.svg`|`tests/fixtures/qa-v041/lna.svg`|
|`qa-v041/nag37.png`|`tests/fixtures/qa-v041/nag37.png`|
|`qa-v041/nag37.svg`|`tests/fixtures/qa-v041/nag37.svg`|
|`qa-v042/10.png`|`tests/fixtures/qa-v042/10.png`|
|`qa-v042/10.svg`|`tests/fixtures/qa-v042/10.svg`|
|`qa-v042/100.png`|`tests/fixtures/qa-v042/100.png`|
|`qa-v042/100.svg`|`tests/fixtures/qa-v042/100.svg`|
|`qa-v042/11.png`|`tests/fixtures/qa-v042/11.png`|
|`qa-v042/11.svg`|`tests/fixtures/qa-v042/11.svg`|
|`qa-v042/19.png`|`tests/fixtures/qa-v042/19.png`|
|`qa-v042/19.svg`|`tests/fixtures/qa-v042/19.svg`|
|`qa-v042/20.png`|`tests/fixtures/qa-v042/20.png`|
|`qa-v042/20.svg`|`tests/fixtures/qa-v042/20.svg`|
|`qa-v042/200.png`|`tests/fixtures/qa-v042/200.png`|
|`qa-v042/200.svg`|`tests/fixtures/qa-v042/200.svg`|
|`qa-v042/21.png`|`tests/fixtures/qa-v042/21.png`|
|`qa-v042/21.svg`|`tests/fixtures/qa-v042/21.svg`|
|`qa-v042/60.png`|`tests/fixtures/qa-v042/60.png`|
|`qa-v042/60.svg`|`tests/fixtures/qa-v042/60.svg`|
|`qa-v042/9.png`|`tests/fixtures/qa-v042/9.png`|
|`qa-v042/9.svg`|`tests/fixtures/qa-v042/9.svg`|
|`qa-v042/fam.png`|`tests/fixtures/qa-v042/fam.png`|
|`qa-v042/inv.png`|`tests/fixtures/qa-v042/inv.png`|
|`qa-v042/mixed.png`|`tests/fixtures/qa-v042/mixed.png`|
|`reference-data.js`|`app/reference-data.js`|
|`regression-tests.js`|`tests/regression/regression-tests.js`|
|`requirement-matrix.js`|`app/requirement-matrix.js`|
|`style.css`|`app/style.css`|
|`vendor/JSZip-LICENSE.markdown`|`vendor/JSZip-LICENSE.markdown`|
|`vendor/SheetJS-LICENSE.txt`|`vendor/SheetJS-LICENSE.txt`|
|`vendor/THIRD_PARTY_NOTICES.md`|`vendor/THIRD_PARTY_NOTICES.md`|
|`vendor/jszip.min.js`|`vendor/jszip.min.js`|
|`vendor/pako-LICENSE.txt`|`vendor/pako-LICENSE.txt`|
|`vendor/xlsx.full.min.js`|`vendor/xlsx.full.min.js`|
|`verify-batch.cjs`|`tests/regression/verify-batch.cjs`|
|`verify-release.cjs`|`tests/regression/verify-release.cjs`|
