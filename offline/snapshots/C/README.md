# Oligo Molecular Presentation / Structure Layout v0.1

独立、离线、可审查的第三支线原型。双击 **index.html** 查看before/after、完整几何QA和SVG/MOL/SDF/CDXML/JSON下载。浏览器运行只读取本目录普通脚本，无网络、无Node运行依赖、无安装步骤。目录可整体复制。

## 交付物

- PRESENTATION_ARCHITECTURE.md：三层边界、policy矩阵、当前实现与不做事项。
- PRESENTATION_API.md：可执行v0.1接口，以及稳定ID/递归provenance的v1目标合同。
- LAYOUT_MIGRATION_AUDIT.md：v0.10.1生产文件/函数/行号审计，明确坐标逻辑与化学编辑的归属。
- INTEGRATION_PLAN.md：影子布局、renderer/QA先行、sequence逐项提取、最后UI联调。
- presentation.js：无DOM的坐标侧车引擎。
- harness.cjs、fixtures/、evidence/：独立回归、固定输入图、七张截图及所有格式导出。
- TEST_REPORT.md、evidence/report.json：验证结果与限制。

## 使用与复现

浏览器：直接打开index.html。开发验证（已有Node可选，不需要npm或第三方包）：在本目录运行 `node harness.cjs`。这会刷新fixture、导出和证据，不触碰生产目录。

可选截图工具 `screenshot.cjs` 使用当前机器已有的Playwright/Edge，仅供开发验收，内含本机开发工具路径；不属于交付网页的运行依赖。其他机器可直接用浏览器截图。evidence中的截图已经生成。

baseline/ 为从本地 v0.10.1 复制的五个冻结脚本；本轮没有修改它们。化学 fixture 由冻结Core/Reaction生成，布局器不负责组装/反应；fixture builder在创建硫醇手柄后用同一布局器预排seed，再调用冻结maleimide反应。双oligo为明确标记的O–O单键接口示意，不是CuAAC化学验证。

## 当前结论

现有sequence坐标与route可冻结复用，但expandAssemblyGraph不可整体搬迁。m7G长键来自第二试剂的右下packing和成键后缺少attachment-aware重排，同时routes在化学校验中丢失。推荐使用 immutable chemistry graph + semantic sidecar → LayoutResult；preview/export共用同一结果。

后续先稳定Core身份/反应provenance，再逐项提取布局；此原型不替换生产程序。Biotin入口缺少可靠完整图；SMCC专属结构和真实CuAAC环闭合待Chemistry提供，不由Presentation补造。
