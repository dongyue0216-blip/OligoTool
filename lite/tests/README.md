# Tests

日常使用无需 Node 或服务器。双击 ../Start.html，展开 Advanced / Custom Chemistry，点击 Run Regression Checks 运行 Single / Phase 1 测试。tests/fixtures/qa-v040、qa-v041 的 gallery.html 可直接打开查看历史绘图证据。

开发者完整回归（需要已安装 Node）：在发布目录运行：

```
node tests/regression/verify-release.cjs
node tests/regression/verify-batch.cjs
```

覆盖 Single、结构导出/布局、Custom Chemistry registry、Excel/ZIP、单行错误隔离以及 100/500/1000 条批量。运行生成的文件放 tests/output/；历史证据放 evidence/，已发布的 QA 样本放 fixtures/。浏览器 file:// 验证结果见 evidence/RELEASE_BROWSER_QA.json。

开发者浏览器验证：安装 Playwright 并确保 Edge 可用后，运行 `node tests/regression/verify-browser.cjs <本发布目录> <旧 v0.5.0 解压目录>`。可通过 PLAYWRIGHT_MODULE 指定现有 Playwright 模块绝对路径。此脚本仅用于测试，产品无需安装它。


## v0.5.3 visual QA

Open visual/gallery.html. Run node tests/regression/visual.cjs and node tests/regression/terminal.cjs from release root. Browser screenshot script: tests/regression/visual-browser.cjs (Playwright + Edge required).

当前发布的文件完整性基线为 evidence/RELEASE_BASELINE_v053.json；BATCH_BASELINE.json 为 v0.5.0 的历史证据。浏览器测试使用 PLAYWRIGHT_MODULE 或可解析的 playwright 包。

## v0.7.0 current validation

```
node tests/release/sync-registry.cjs --check
node tests/regression/building-blocks.cjs
node tests/regression/attachment-matrix.cjs
node tests/regression/verify-release.cjs
node tests/regression/verify-batch.cjs
node tests/regression/terminal.cjs
node tests/regression/visual.cjs
node tests/regression/custom-browser.cjs
node tests/regression/attachment-browser.cjs
node tests/regression/visual-browser.cjs
```

Browser scripts need Playwright and Edge. Set PLAYWRIGHT_MODULE if using a preinstalled module. Current file-integrity baseline is RELEASE_BASELINE_v070.json; older baselines remain historical evidence. Schema/registry snapshots are regenerated with sync-registry.cjs and checked with --check. TEST_REPORT_v070.md records actual results and scope.
