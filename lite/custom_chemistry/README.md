# Custom Chemistry v0.8.0

MOL/SDF → MolecularGraph → 选择真实 OH → BuildingBlock → 与标准库共用的 AssemblyGraph 和 linkage engine。

导入 V2000/V3000 MOL 或单分子 SDF。5/3 marker 自动识别失败时使用 manual fallback：点击真实 OH 的 O 或下拉选 atom。upstream/downstream 是方向，不表示该 OH 必须是天然糖环的 C5′/C3′。伯醇和仲醇均允许。

一个 OH：选择 upstream 或 downstream，保存后自然只适用于正确方向的末端。两个不同 OH：两个方向均可连接，可内部组装。不能把同一个 O 填成两个位点。Custom 不自动颠倒用户指定方向。

命名后 Save 立即进入 Single/Batch；Save & New 清空本次输入以连续录入；备份/恢复 JSON 保存到本地浏览器 localStorage。本包不带私人 library。

Custom 无 atom count、molecule size、文件字节或 coordinate bounding-box 硬上限，只受浏览器资源影响。大结构自动按 viewBox fit-to-view。Batch 自身输入仍有 25 MB 上限，与 Custom 文件导入独立。

支持范围：已定义的中性 CHNOPS/F 常见价态、无同位素 scaffold。带电、未定义 MOL 属性、多分子 SDF 拒绝，不猜测。现有 stereo fields 保留；未定义的 stereochemistry 不自动生成。复杂布局需检查，SVG 显示路由与 MOL/CDXML 的直键显示有差别。

PO/PS/PS2/Me-P/PN(DMI)/MsPA 与标准 O-linked sites 共用同一套 compatibility 和 phosphorus engine，不区分 Custom family。光学参数缺失时 chemistry 仍可用，OD 留空并注明 Needs parameter。
