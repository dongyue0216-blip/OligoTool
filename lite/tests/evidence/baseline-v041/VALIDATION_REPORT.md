# Lite v0.4.1 验证与交付报告

本版本直接修改现有 Lite v0.3.0 代码，保留原目录作为开发源目录。升级包名称为 v0.4.1。运行仍是离线 Start.html，没有服务器或联网依赖。

## 本次参考图修订

FAM 四个六元环统一边长和内角；保留原有 C6 amide / neutral lactone 原子图，并未把参考图的 FITC 基团或开环形式混入。
七个 LNA 模板保留上方五元糖环，下方画出 CH2/O 桥。桥投影采用显式 overpass 元数据，在 SVG 留白断开下穿键；它不是化学键连接点。QA 单独报告该已登记桥投影，其他意外交叉仍失败。MOL/SDF/CDXML 保留真实键与立体信息；SVG 留白效果不会添加任何假原子。
L96 的三个 GalNAc 环均改为同一椅式，整体固定为左三支糖、中央分支、右 linker/prolinol。NAG37 三个糖环同样改为椅式，并沿各自支链刚性旋转。
DEPICTION_QA.json 对全部 10 个修改模板逐一验证修改前后 isomeric SMILES 相同，原子连接、形式电荷和立体化学均保持一致。新增 3 项回归固定等边六元环、六个椅式糖环及 LNA 桥投影语义。
Chemistry coverage 沿用上一版本，未将任何 Pending 项猜成原子图。修改集中于 reference-data.js、master-library.v1.json、chemistry.js、regression-tests.js；更新版本、报告、截图和证据文件。开发目录保留 refine_lite_depiction_v041.py 作为可重复生成步骤。

## 改动文件

|文件|改动|
|---|---|
|chemistry.js|语法/化学分离；方括号 phosphate；family 组装；真实 PMO/TNA/GNA/VP；三路 formula 核对；大修饰避障和路径简化；完整几何 QA；光学缺参保护|
|reference-data.js|117 个 free/deprotected 原子 scaffold、连接片段及固定局部坐标|
|coverage-data.js / chemistry-coverage.json|状态、正式 notation、别名、ε260 元数据|
|master-library.v1.json|symbol/class/graph/attachment/direction/positions/formula/mass/evidence/status/notes，试剂与最终 scaffold 分开|
|CONJUGATE_TRANSFORMATIONS.json|FAM/L96/NAG37 脱保护步骤与前后公式；NAG37 cis 相对立体定义的来源及 PubChem 原记录限制|
|regression-tests.js|241 项离线核心回归、碰撞检测器故障注入、列方向不变性|
|Start.html / app.js / style.css|结构前置；Fit to view；布局检查；拓扑方向；计算结果降为辅助|
|README.md / CHEMISTRY_COVERAGE.md / CHANGELOG.md|使用方式、完整范围、化学来源、Pending 和边界|
|TEST_EVIDENCE.json / EXPORT_QA.json / GLYPH_QA.json / BROWSER_QA.json|本次实际测试结果|

工作区根目录新增数据重建脚本 upgrade_lite_master.py、build_lite_conjugates.py、release_lite_v040.py；QA 脚本 qa_lite_v040.cjs、verify_lite_v040.py、browser_lite_v040.cjs、browser_glyph_qa_v040.cjs。public-chemistry-records 是 PubChem 官方接口缓存，不是公司资料。早期 patch_* / update_* 脚本仅记录本次迁移步骤，不是应用运行依赖。

## Chemistry coverage

第一批要求均已有原子实现：DNA/RNA/OMe/F/MOE/LNA/UNA/FANA/NMA/ENA/TNA/S-GNA A,C,G,T/C16/C22/PMO/Benner Z/VP+OMe,MOE；PO/PS/PS2/Me-P/PN(DMI)/MsPA；C3N/C6N/C3 spacer/PEG3–7/6-FAM/L96/NAG37。按 family 生成，不只硬编码示例。

PMO 是六元 morpholine + phosphorodiamidate 的纯链，默认明确为 uncapped 5-OH / 3-NH。TNA 是 α-L-threose 3→2 纯链。两者混链明确拒绝。S-GNA 是独立 glycerol scaffold。Z 是 C-nucleoside，nitro 电荷分离明确。VP 为 5-(E)-vinylphosphonate terminal motif，MOL 读回为 E。磷手性保持 unspecified。

6-FAM 固定为 6-carboxamido-C6 phosphoramidite-derived 变体，使用 neutral lactone 图。L96 为 3-terminal prolinol primary O；NAG37 为 5-terminal cyclohexyl O。保护基、support succinate、NHS/CE/DIP 等不计入最终 scaffold；新形成的 phosphate 独立计数。详见完整 coverage 与 transformation JSON。

仍 Pending：pB, Ugn, cEt-A, cEt-T, cEt-CMe, cEt-G, [PHO], [Biotin], [DIG], [abasic], [InvAb], [SMCC], [MC], [BCN], [DBCO], [SPDP], [MC-VC-PABC], [cOct], [TCO], [CY5], [CY3], [CY5.5], [555], [647], [594], [488], [568]。cOct = PENDING_CHEMISTRY，其余未定变体 = STRUCTURE_VARIANT_PENDING，均不输出猜测的 graph/MW。pB 等旧登记项也不冒充已验证。Custom 可补全特殊单元。

## 结构布局改进

1. 重复单元只平移；不随奇偶列旋转或镜像。三列混合 family 回归逐原子核对 canonical 坐标，避免“第二列翻转”。
2. LNA/ENA 桥放入可读的局部内桥模板，保持两端在外侧；离线重建 wedge 并核对 parity。
3. NMA、C16/C22 侧链展开，G 的碱基转到空闲区；PEG 用开放 U 形链，减少垂直高度。
4. 所有 P linkage 用固定局部几何；PN 五元环和甲基明确排在左侧，MsPA 使用中性 P(=O)-NH-SO₂Me 形式。
5. 普通跨列连接沿列间空白走直角线。大修饰使用自适应行距、局部网格避障、转弯惩罚和可视性简化，移除早期阶梯线。
6. 路由控制点仅属显示层；atom/bond graph、formula 和 MOL/SDF 不含假节点。SVG 可完整保留这些路由。

几何 QA 包含非键原子距离、atom overlap、atom/bond、label/label、label/bond、bond crossing、未路由异常长键、列顶对齐、connector collision。阈值：atom overlap <0.65，非连接 atom/bond <0.22，routed connector clearance <0.4，未路由长键 >6（坐标单位）。实际字体边界另用浏览器 getBBox 检查，并加 0.02 单位余量。路由键的化学端点距离不作为显示层长键错误；MOL 中的跨列直键属于已知导出布局限制。

## 测试结果

- 核心回归：241/241。
- 布局：193/193，所有已记录碰撞类别为零；包括 30 条固定种子的随机 21-unit 混合链。
- 独立 RDKit 导出读回：163/163。核对元素计数而非公式字符串排序、真实 atom/bond 数、连通性、零意外 radical、同一 isotope table 的质量、完整 isomeric SMILES（含 VP E 与 NAG37 相对环 stereo），并检查 wedge 数。CDXML 为语义重建，未宣称在 ChemDraw 软件实测。
- 实际 SVG 字体边界：120/120，字形/字形与字形/非连接键碰撞为零。
- Edge / Chrome：页面均 241/241；无脚本错误，无 HTTP 请求；两端 marker 自动检测、保存、混合组装通过。
- rArA：C20H25N10O10P，exact ≈596.149274 Da；直接组件、free-unit assembly 与 graph atom count 一致。

RDKit 的内置 P 同位素质量与现有 Lite 表略有差异，因此独立读回时先保证 formula equality，再使用同一明确 isotope table 做质量比较，而非放宽 mass tolerance 掩盖元素差异。

## 实际渲染与视觉复核

两个浏览器都实际打开并渲染了 RNA 9/10/11、19/20/21、30、60、100、150、200-mer。自动布局另测试 RNA 与混合链到 300；没有硬编码 200 上限。含 NAG37/L96 的核苷主链长度另覆盖 9/10/11、19/20/21、60、100、150、200（特殊端基另外计为单元）。

本轮人工逐张打开复核：FAM 单模板及 FAM+rA、四碱基 LNA 链、L96 单模板及 rA+L96、NAG37+rA、NAG37+4 核苷+L96、混合 21-mer。浏览器自动测试另实际渲染 9/10/11、19/20/21、30、60、100、150、200-mer；193 个布局样例覆盖至 300。含两端大修饰及多种侧链的 21/200-unit 压力样例另通过。

## 明确限制

- 当前混合 PMO/TNA 拓扑不支持；纯链已实现。PMO 商业端帽不猜。
- Pending modifiers 没有唯一原子图，不能算 exact MW；Custom MOL/SDF 可后续补齐。
- 任意 Custom 图不会自动拥有与内置 family 同等的布局保证；请运行 Check layout。Custom 仅支持现有中性、无同位素 V2000 子集；SMILES 仅明示非环中性子集。
- 染料、PEG、amino、GalNAc 无可靠 ε260 参数时为 Needs parameter；不能从名称字母或 2D 图猜吸收。标准 DNA/RNA 使用 NN；修饰基底估算为 Estimated。染料 CF260 元数据保留空值，不默认零。
- MOL/SDF/CDXML 保留真实图与真实坐标，化学格式不带 SVG 折线，跨列键会是直线；导入 ChemDraw 后需要重排。真实 ChemDraw 兼容性未实测。
- 自动指标和本次视觉样例不是对所有未来混合序列的无碰撞数学证明；应用提供当前结构检查结果。
