# Oligo Toolkit v2.4.3

完整解压 ZIP，然后用 Edge 或 Chrome 打开 `Start.html`。只需浏览器，可离线使用。

- 在 Sequence 工作区建立起始分子，点「添加步骤」，选择内置试剂或上传 MOL/SDF。界面会自动识别反应。看到预览后点「应用」，可直接用该产物继续下一步。
- 还原二硫键时，保留第二反应物为空。若还原会生成两个不同片段，界面会询问保留哪一个。存在不同 SPAAC 产物时，下拉框列出两条新 C–N 键的原子编号。
- `examples/` 提供合成 JQ1–DIBAC 的 MOL 和 V2000 芳香键版。可以把示例 `propyl-azide.mol` 的内容粘贴到 Sequence 工作区的 MOL/SDF 输入框并建立起始分子，再将 JQ1–DIBAC 样本作为第二反应物上传。原始 JQ1.mol 已在 Edge 中完成验证，两种连接方式均可预览并应用。
- 分支延长按 5′→3′ 输入子链，自动用子链的 3′ 位点接到母链分支。
- 巯基–噁二唑反应支持快速自动识别，也可在「高级 / 手动」选择。上传具有甲磺酰基-1,3,4-噁二唑结构的 MOL/SDF 作为第二反应物，角色可互换。
- 在 `chemistry-library/` 中按类别查阅内置单体、连接、修饰、后修饰试剂和光学参数。
- 「化学库」保留「内置化学库」和「我的自定义」。在左侧搜索并选中化合物，右侧查看结构、标出的连接位点、分子式、质量和光学性质。点击「编辑」或「新建自定义化学」打开编辑器。导入 .oligoentry 或 .olib 后，在合并预览中处理冲突，再应用到「我的自定义」。旧版团队条目载入时归入「我的自定义」。
- 在分子属性中查看 Mass per OD₂₆₀。展开 Optical details 可查看采用的参数与近似条件。带 ≈ 的结果是估算。

发布回归要求：逐个覆盖有限的内置反应定义和可选试剂。通过须经过 `Start.html` 的实际选择或上传、自动发现、预览和应用。多步测试沿用上一步已应用的状态。仅在组合空间无法穷举时，采用边界、成对组合和固定随机种子的压力测试。分开报告内置、上传和多步的分母、失败与未测项。

## 从旧版迁移 / Upgrading from CL1

旧版数据保存在浏览器里。若用原来的浏览器配置打开同一路径，程序会尝试自动载入。若使用新的解压目录，可先在旧版导出「我的自定义」及旧团队条目，再在新版「化学库」点击「导入」。旧版 JSON 备份也可导入。新库为空时可选择「恢复旧版我的自定义库」。

Browser storage can be isolated by file path and profile. When extracting to a new folder, export My Custom and any former team records from CL1, then choose Import in the new Chemistry Library. A previous library JSON backup can also be restored into an empty library.

## JQ1 SPAAC

Apply the built-in DBCO reagent to a C6N oligo, add a step, and upload examples/JQ1.mol. Quick mode detects SPAAC. If two different connectivities appear, select the C-N bond pairing before Preview and Apply. Advanced / Manual starts at Auto-detect for each new step.


## v2.4.3

- 分子展示可设定每列碱基数，默认 5。ChemDraw 沿用原子级视图的平行纵列，跨列骨架连接采用直线化学键。
- 02 批量处理分为 2.1 批量序列计算和 2.2 批量后合成修饰。2.1 模板含序列编号、Compound ID、Sequence。计算后可下载精简 Results Excel 和 structures.zip。
- 结果提供 ε₂₆₀、nmol/OD₂₆₀ 和 µg/OD₂₆₀。后合成修饰缺少 ε₂₆₀ 数据时，按产物分子量给出估算值。


### ChemDraw 跨列连接

ChemDraw 导出使用原子级视图的纵列坐标。每处跨列连接由一个可编辑的直线化学键表示。2.1 的 Schematic SVG 使用 Presentation C 简图，保留跨列折线路径，并与 ChemDraw 共用每列碱基数设置。
