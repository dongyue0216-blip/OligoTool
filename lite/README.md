# Oligo Chemistry Toolkit Lite v0.2.1

解压整个文件夹，双击 Start.html，在 Windows 11 的 Edge / Chrome 中打开。程序仅使用本地 HTML/CSS/JavaScript，无安装、服务器或联网依赖。旧包未覆盖。

## 输入

- RNA rA/rC/rG/rU/rI；DNA A/C/G/T 或 dA/dC/dG/dT；2′F f、2′OMe m、MOE e + A/C/G/U。
- 默认 PO；* PS；** PS2；& MsPA。原来的模板、骨架和 bamboo 布局保留。
- [ID] 查找本地 Custom Chemistry Library，ID 为字母开头、1–24 位字母/数字/下划线，区分大小写。并非只支持示例名字。旧 {ID} 输入兼容，输出统一 [ID]。
- 两端均支持 (p)/(pp)/(ppp)，也接受大写；canonical 输出小写。例如 (ppp)rA*rC(pp)。六种端基均有真实中性游离酸分子图。
- 不识别的 terminal chemistry 明确拒绝；不支持内插括号端基。最多 60 个结构单元，MOL V2000 另有 999 atom/bond 上限。

## Custom Chemistry

打开 Advanced / Custom Chemistry。上传 MOL V2000 / SDF（读取首个 molecule）。推荐 ChemDraw 在真实 alcohol O 外接单键 terminal dummy，alias 标 5 和 3；也兼容 dummy atom map / isotope 5/3、R1/R2。

识别成功直接显示真实 O 编号与结构，输入 ID 后 Save Custom Chemistry。marker 和 marker bond 删除，真实 O 保留；保存时再次验证两个不同的中性 C–OH 位点。识别缺失/歧义时自动展开 Manual attachment selection：点预览上的 O，再 Set as 5′ / Set as 3′；编号 dropdown 放在次级折叠项。

保存后在序列输入 [ID]，可位于两端或内部，也可连续多个；本版 custom 都要求两个有效 alcohol O。组装真实连接到各 O，重新计算 formula / exact mass / average MW，支持 SVG/MOL/SDF/CDXML/JSON。Custom 无 extinction coefficient，因此明确不计算 OD。

Library 保存在浏览器 localStorage；路径、浏览器、配置文件变化可能改变存储范围。升级或换电脑前导出 library JSON，必要时恢复；不应仅依赖浏览器存储作为备份。

SMILES 保留受限的中性非环 C/N/O/S/F/H、分支、单/双/三键子集；不支持环、芳香、[]、电荷、同位素、立体语法和分子点分隔。不支持的输入拒绝，复杂结构请用 Kekulé MOL/SDF。Scaffold 不支持带电或 isotope 原子、V3000、部分 MOL 属性及芳香键编码。

## 离线接口

加载 reference-data.js → chemistry.js 后可调用：

- Lite.calculate(sequence)：成功返回 JSON；无效输入抛出 Error。
- Lite.calculateSafe(sequence)：返回 status ok/error 与稳定 errors 列表，适合未来逐条循环；本轮无 batch UI、Excel library 或 batch export。
- Lite.buildStructure(sequence)：返回相同引擎的真实分子图。

JSON 包含 input_sequence、canonical_sequence、formula / exact_mass / average_mw（chemistry 内）、optical 与 provenance、residues/linkages/modifications、status/errors、graph。接口版本 oligo-lite/1.1，见 interface.schema.json。customLibrary 内部保留旧 {ID} 键以兼容旧备份。

## 验证与限制

Advanced 中 Run Regression Checks 可重复执行 85 项离线测试，不改写 localStorage。详见 VALIDATION_REPORT.md 和 TEST_EVIDENCE.json。

本轮通过引擎与界面事件模拟验收；未完成真实 Edge/Chrome 视觉与点击验收。CDXML 保留 Experimental，未在真实 ChemDraw 打开验证。MsPA 保留原版本 P(OH)=N–SO2Me 互变异构模型与审阅提示；LNA/UNA、盐和其余端基仍不支持。所有 mass 为 neutral free acid。磷立体化学未指定。自定义布局仍需人工检查，跨列折线仅 SVG/JSON 显示层元数据，MOL/SDF/CDXML 仍为真实原子间键。
