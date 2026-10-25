# Oligo Chemistry Toolkit Lite v0.4.1

这是对现有 v0.3.0 项目的直接升级；源文件仍保留在原目录。双击 Start.html 即可离线运行，不需要安装、服务器或网络。

结构绘图是主界面：每 10 个结构单元换列，所有列保持模板方向，支持滚动、缩放及 Fit to view。普通链保留固定间距；大 GalNAc 单元启用自适应间距。跨列和大修饰连接采用显示层直角避障路径，控制点绝不进入 chemical graph。Check layout 可检查当前结构。任意 Custom scaffold 仍需运行检查并自行核对布局。

正式输入 dA/rA/mA/fA/eA/+A/FANA-A/UNA-A/nA/ENA-A/tA/Agn/pA/Z/VpmA/VpeA 等。特殊单元写 [C6N]/[PEG4]/[FAM]/[L96]/[NAG37]；末端写 [p]/[pp]/[ppp]，旧括号输入兼容并规范成方括号。裸 A/C/G/T 为 DNA 简写。最长 token 优先。默认 PO；* PS；** PS2；^ Me-P；! PN(DMI)；# MsPA；旧 & 拒绝。语法识别与化学可用性分开。

纯 PMO / TNA 已实现，混合这些拓扑会明确返回 UNSUPPORTED_MIXED_TOPOLOGY。PMO 不擅自添加商业端帽。VP、FAM、NAG37 限 5′；L96 限 3′。cEt、Ugn、未指定变体的染料/linker 等只识别，返回 STRUCTURE_VARIANT_PENDING；cOct 为 PENDING_CHEMISTRY。完整清单见 CHEMISTRY_COVERAGE.md 与 master-library.v1.json。

Custom Chemistry：导入真实 O 外连接 5/3 marker 的 V2000 MOL/SDF，自动找到真实 attachment O、移除 marker 与其键，成功直接保存；歧义才手选。保存的 scaffold 真正参与连接、分子式、质量和导出。SMILES 仍只是明示的中性非环子集，复杂化学请用 MOL/SDF。请备份本地 library。

SVG 保留避障路径；MOL/SDF/CDXML 仅输出真实原子和键，因此化学软件中跨列键会是直线，需要在那里重排。MOL/SDF 超过 999 原子/键自动用 V3000；导入仍仅支持 V2000。CDXML 的图、立体键和 VP E 几何已做独立语义读回验证，尚未在真实 ChemDraw 中验证兼容性。

MW/formula/OD 为辅助结果。rArA = C20H25N10O10P，exact ≈ 596.149274 Da。直接组件公式、free-unit 组装和 atom-count 三路核对；外部 RDKit 另读回导出文件。标准 DNA/RNA 用序列相关 nearest-neighbor ε260；修饰基底估算明确为 Estimated；未知染料/大修饰参数显示 Needs parameter。µg/OD = 1000 × average MW / ε260；nmol/OD = 10^6 / ε260。

测试与视觉检查见 VALIDATION_REPORT.md、TEST_EVIDENCE.json、EXPORT_QA.json、GLYPH_QA.json、BROWSER_QA.json。离线页面 Advanced 中的 Run Regression Checks 可重复运行核心测试。开发用重建及 QA 脚本保存在工作区根目录，不是运行应用的依赖。
