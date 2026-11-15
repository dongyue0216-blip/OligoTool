# Oligo Toolkit v2.4.2

完整解压 ZIP，然后用 Edge 或 Chrome 打开 `Start.html`。只需浏览器，可离线使用。

- 在 Sequence 工作区建立起始分子，点「添加步骤」，选择内置试剂或上传 MOL/SDF。界面会自动识别反应。看到预览后点「应用」，可直接用该产物继续下一步。
- 还原二硫键时，保留第二反应物为空。若还原会生成两个不同片段，界面会询问保留哪一个。存在不同 SPAAC 产物时，下拉框列出两条新 C–N 键的原子编号。
- `examples/` 提供合成 JQ1–DIBAC 的 MOL 和 V2000 芳香键版。可以把示例 `propyl-azide.mol` 的内容粘贴到 Sequence 工作区的 MOL/SDF 输入框并建立起始分子，再将 JQ1–DIBAC 样本作为第二反应物上传。原始 JQ1.mol 已在 Edge 中完成验证，两种连接方式均可预览并应用。
- 分支延长按 5′→3′ 输入子链，自动用子链的 3′ 位点接到母链分支。
- 巯基–噁二唑反应支持快速自动识别，也可在「高级 / 手动」选择。上传具有甲磺酰基-1,3,4-噁二唑结构的 MOL/SDF 作为第二反应物，角色可互换。
- 在 `chemistry-library/` 中按类别查阅内置单体、连接、修饰、后修饰试剂和光学参数。
- 在自定义化学中管理 User Library。换解压目录前，从原版本导出 User Library JSON，再在新版本导入。
- 在分子属性中查看 Mass per OD₂₆₀。展开 Optical details 可查看采用的参数与近似条件。带 ≈ 的结果是估算。

发布回归要求：逐个覆盖有限的内置反应定义和可选试剂。通过须经过 `Start.html` 的实际选择或上传、自动发现、预览和应用。多步测试沿用上一步已应用的状态。仅在组合空间无法穷举时，采用边界、成对组合和固定随机种子的压力测试。分开报告内置、上传和多步的分母、失败与未测项。

## JQ1 SPAAC

Apply the built-in DBCO reagent to a C6N oligo, add a step, and upload examples/JQ1.mol. Quick mode detects SPAAC. If two different connectivities appear, select the C-N bond pairing before Preview and Apply. Advanced / Manual starts at Auto-detect for each new step.
