# Oligo Chemistry Toolkit Lite v0.7.0

解压整个 ZIP，双击 **Start.html**。无需安装、服务器或网络；建议桌面 Edge / Chrome。GitHub 源码位于 `lite/`，同样打开其中的 Start.html。

## 当前功能

- **Single Sequence**：使用共享的确定性化学引擎解析序列，计算 molecular formula、average MW、exact mass、epsilon260、nmol per OD260、ug per OD260。
- **真实结构绘制**：从原子/键图生成 SVG；可导出 MOL / SDF，CDXML 为 Experimental，导入 ChemDraw 后需检查。v0.7.0 统一 terminal/internal phosphorus 的局部几何与元素标签居中。
- **Terminal phosphate / PS notation**：`rA(p)` / `(p)rA` 为 terminal PO；`rA*(p)` / `(p)*rA` 为 terminal PS。PS2 使用 `**`；其他末端修饰和位置限制见 [支持矩阵](docs/TERMINAL_CHEMISTRY_AUDIT.md)。
- **Batch Excel**：使用 `batch/batch input template.xlsx` 的 ID / Sequence 列，上传 XLSX 或 CSV，验证后选择 Calculate only 或 Calculate + Structures；导出 results.xlsx 和 structures.zip。单行错误隔离；支持停止并保留已处理结果。
- **Custom Chemistry**：导入 MOL / SDF，指定一个或两个 upstream/downstream OH attachment sites（UI: 5′ side / 3′ side），预览、注册并用于 Single / Batch；可备份和恢复 library JSON。升级前请在旧页面备份，file:// 下 localStorage 是否跨路径共享取决于浏览器。

## 支持和限制

支持 DNA、RNA 及已实现的糖型、骨架和端基；详细定义见 [chemistry coverage](docs/CHEMISTRY_COVERAGE.md) 和 [sequence matrix](docs/SEQUENCE_REQUIREMENT_MATRIX.md)。FULL 表示已实现 graph/formula/SVG，并不代表每一种组合均经实验验证。PMO / TNA 有纯链及拓扑限制；未定义的结构变体保持 pending，不推测其结构或分子量。

epsilon260 的支持、估算或缺参数状态分别显示；缺参数时保留可用 formula/MW/结构，OD 数值留空。采用 1 mL、1 cm 约定：nmol/OD260 = 1e6/epsilon260；ug/OD260 = 1000 × AverageMW/epsilon260。见 [photometry](docs/PHOTOMETRY.md)。

**Conjugation Pool 仅为未来功能的元数据基础设施**，其中试剂不参加 sequence assembly；没有实现 Conjugation reaction engine。

Batch 输入上限 25 MB；公式或 Excel 错误单元格须先粘贴为值。页面预览最多 100 行，导出全部已处理行。结构 ZIP 在内存中打包，大批长链建议拆批；没有流式 ZIP 或内嵌缩略图。Single 与 Batch 使用同一个 parser、chemistry graph 和 exporters。

## 目录和验证

`app/` 主程序；`batch/` 模板与模块；`custom_chemistry/` 通用示例；`docs/` 方法和覆盖范围；`tests/` 回归及明确标记的历史基线；`vendor/` 离线库与许可证。

运行回归的方法见 [tests/README.md](tests/README.md)。发布工具从空 staging 按白名单复制，检查资源引用、嵌套版本、临时/缓存/旧 ZIP、CRC 与逐文件哈希；工具见 `tests/release/`。测试生成的 tests/output 不进入发布包。应用运行不需要 Python / Node。

本项目为 generic chemistry toolkit，仅含通用示例及公开化学参考。第三方许可证见 [vendor notices](vendor/THIRD_PARTY_NOTICES.md)，项目采用 [MIT License](LICENSE)。

## v0.7.0

修复 MOE 等 modified residues 两端磷化学兼容性。84 个标准单体自动覆盖六种 chemistry，按真实 attachment metadata 校验；详见 [支持矩阵](docs/ATTACHMENT_SUPPORT_MATRIX.md)。新增 1,512 个位置/化学组合、family symmetry 和实际浏览器并排回归。保留 Batch、Custom Chemistry、长链布局与 canonical phosphorus geometry。

## v0.7.0: Building Block registry

**The assembler connects attachment sites, not residue identities.** Direction label ≠ literal sugar carbon numbering.

预装单体与 Custom 共用真实 graph + directional attachments + linkage compatibility。84 个标准 O-linked 单体使用同一 PO/PS/PS2/Me-P/PN(DMI)/MsPA engine；TNA/GNA 保留真实 O3→O2，PMO 使用专用 OH/NH phosphorodiamidate。cEt 无已验证 graph，仍 pending；未定义的 alternative terminal/mixed topology 返回 CHEMISTRY_UNSUPPORTED。

Custom 支持 V2000/V3000 MOL、单分子 SDF、伯醇/仲醇及单端 terminal-only block。无 atom/file/coordinate-span 人为上限，完整 viewBox 自动 fit-to-view。Save & New / New Custom Chemistry 可连续录入，无需刷新。默认中性 CHNOPS/F 与已定义 MOL 属性的化学范围仍适用，详见 [Custom guide](custom_chemistry/README.md)。

审计、统一程度和真实化学限制：[architecture](docs/BUILDING_BLOCK_ARCHITECTURE.md)；[notation/support matrix](docs/NOTATION_SUPPORT_v070.md)；[test report](docs/TEST_REPORT_v070.md)。
