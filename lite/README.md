Oligo Chemistry Toolkit Lite v0.9.0

Layered OD260 engine; see [photometry](docs/PHOTOMETRY.md). Custom Manager v0.8.0 is the sole development baseline.

# Oligo Chemistry Toolkit Lite v0.8.0

解压整个 ZIP，双击 **Start.html**，使用桌面 Edge / Chrome。无需安装、服务器或网络。

本次是浏览器 Lite v0.7.0 代码线的底层架构重构。Python v1.0.0 是另一代码线，不在本包内。

**The assembler connects attachment sites, not residue identities.**

MolecularGraph → BuildingBlock → AttachmentSite + LinkageDefinition → AssemblyGraph → expanded MolecularGraph。

- Single、Batch 和 Custom 共用核心。计算结果 JSON 含完整 AssemblyGraph 和逐原子/逐键 provenance。
- 118 个现有 graph 迁移到同一 BuildingBlock 接口；84 个标准 O-linked 单体共用六种磷连接化学。
- AssemblyGraph 明确记录顺序、方向、具体端点、连接类型和终止位置；自由 OH/NH 与 terminal PO/PS/PS2 路径分别表达。
- Custom 支持 V2000/V3000 MOL、单分子 SDF、一个/两个真实 OH、伯醇/仲醇、manual marker fallback、Save & New。无自定义原子数、文件或坐标跨度硬上限。
- SVG/MOL/SDF/CDXML 导出继续保留；CDXML 为 Experimental，未经原生 ChemDraw 验证。

默认 PO；`*` PS，`**` PS2，`^` Me-P，`!` PN(DMI)，`#` MsPA。示例：`eA*eCMe#eG`、`(p)**rArC`、`rA**(p)`。特殊 block 用 `[ID]`。旧 phosphate/alias notation 由 adapter 解析。

已知边界：cEt、Biotin、C7N 等无可靠 baseline graph 的对象不伪造；TNA/GNA 混链与 terminal phosphorus、PMO 的非专属 linkage 继续拒绝。当前只展开线性 AssemblyGraph；branch/环状、任意新 cap、完整 HELM parser 未实现。定义氢、键级、电荷、stereo 和坐标由图保留，原库的立体化学不确定性仍存在，P 的 Rp/Sp 未指定。

Custom 的 localStorage 按浏览器/路径隔离，升级前备份 JSON。本包不带用户库。Batch 输入仍限 25 MB；导出 ZIP 在内存内生成，大批长链可拆批。

架构与兼容性：[architecture](docs/ARCHITECTURE_v080.md) · [migration audit](docs/MIGRATION_REPORT_v080.md) · [support matrix](docs/SUPPORT_MATRIX_v080.md) · [Custom](custom_chemistry/README.md) · [tests](docs/TEST_REPORT_v080.md)。

本轮只交付本地版本与 clean ZIP；没有 push、tag 或 GitHub Release。许可证见 LICENSE 与 vendor/THIRD_PARTY_NOTICES.md。


Custom Library Manager 更新：见 docs/CUSTOM_LIBRARY_MANAGER.md。建议升级前从旧页面 Backup JSON，再在新页面 Restore。
