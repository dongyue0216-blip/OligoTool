# Oligo Toolkit Infinity · I1

## 基线与交付

本轮自主完成五个迭代周期。采用本地最新 CL2（v2.4.3-rc.3）ZIP 为基线，使用独立实验副本。当前项目根目录未初始化 Git，因此选择用户授权的 copy 隔离方式。实验目录为 infinity/inf，参考副本为 infinity/base。

基线 ZIP SHA-256 为 016637eb116a1f152902f06ecd10798dafde0b6d6fd26620430f70905c3ff17a。参考副本逐文件与 ZIP 相等。chemistry-library 全目录与基线逐字节相等。

交付包为 Oligo-Toolkit-Infinity-I1.zip，顶层目录 Infinity。完整解压后双击 Start.html，使用 Edge 或 Chrome。应用运行依赖均随包附带。研发测试使用的 Node 与浏览器调试接口不属于应用运行依赖。

本轮 GitHub push、tag、release、发布操作均为 0。

## 审计范围与分级

检查了 A Core、B 工作流、C Presentation、parser/linkage/AttachmentSites、库持久化与迁移、Builder、Reaction、Batch 2.1/2.2、光学、双链注释、导出、语言切换、file:// 加载、测试及遗留入口。app 与 chemistry-library 共 99 个原始文件参与清点，关键路径进行了运行验证。

| 等级 | 问题与处理 |
| --- | --- |
| P0 | 反应检查点可接受越界原子映射、重复产物归属、与产物图不一致的快照。基线接受 3/3 人为损坏样本，Infinity 拒绝 3/3，合法状态完整 round-trip 通过。 |
| P0 | 在共享文件 origin 的浏览器中，实验版与稳定版可能写同一份库/偏好数据。加入 Infinity copy-on-write 命名空间，既有键作为只读迁移来源。 |
| P1 | 结构导出触发 viewer 的 abbreviation、SVG 与全量质量诊断，部分工作对原子格式导出多余。建立共享的 drawing/svg 出口，保留图和质量不变量检查。 |
| P1 | 布局 24×24 刚体搜索对远处固定原子和键重复评分。加入保守空间边界筛选，原评分顺序保持一致。 |
| P1 | 反应检测反复全扫 bonds 求邻接，价态验证逐原子扫描 bonds。改为同步扫描作用域内的邻接索引及单次价态汇总。 |
| P1 | Optical 的异常可能中断分子计算。公共分析边界明确返回 OPTICAL_ANALYSIS_ERROR，图、反应和质量计算可以完成。 |
| P2 | AttachmentSite 映射逐项线性查找 provenance。按 node/local atom 建立索引。 |
| P2 | 部分旧测试仍假定旧默认列数、旧控件、独立 Team 或旧光学政策。维护了当前适用测试，并保留初次失败日志。 |
| P2 | 深层多步 provenance 的复制与序列化开销仍高，内存增长需要专门测量。保留为后续工作。 |
| P3 | 品牌与导出摘要版本信息滞后。更新为 Infinity I1，并在新条目 provenance 记录实验版来源。 |

本轮未发现需要改变已支持反应化学语义的证据。检查点修复保证当前序列化图、映射、输入快照与输出快照的一致性。它不能验证任意人同时伪造整套历史的化学真实性。

## 五轮迭代

1. **测量与 Presentation**。在 21/60/100/150 nt 脂质偶联批次上定位热点。去掉导出路径附带的 viewer 分析，加入几何评分的空间边界筛选。每轮比对完整产物状态与导出文本。
2. **Core 扫描成本**。优化 motif 邻接查找、价态汇总与 AttachmentSite provenance 定位。索引在同步只读检测结束时清除，事务编辑继续读取当前图。
3. **持久化与故障边界**。实现 Infinity 存储隔离，保留旧库自动读取与手动导入。光学异常独立呈现为 unsupported，加入 Batch 阶段计时。
4. **工作流与自审**。补齐原子 SVG 导出路径，增加“化学计算/生成结构”进度反馈。完成实际 Excel 上传、预览、计算、下载和语言切换。修正旧测试的失效前提。
5. **检查点完整性**。对损坏映射与快照建立基线复现，再增加严格校验。重新跑核心、迁移、真实反应 UI、性能与确定性回归。

## 化学与展示

MolecularGraph 继续作为化学真值，Batch 调用共享 Builder/Reaction，AssemblyGraph、AttachmentSites 与状态来源结构保持兼容。反应候选仍由实际 motif 决定，多候选保持 review。未知 notation/linkage 保持 fail closed。

ChemDraw 继续输出真实 atom-level 直线 bond。serializer 生成 n/b 元素，保留元素、氢、形式电荷与 wedge/hash。没有新增 graphic bond 覆盖路径。5 个 CDXML 场景通过原子/键数、坐标尺度及导出检查，真实 ChemDraw 打开、编辑及重新保存见环境限制。

ε260、nmol/OD260、µg/OD260 的现有政策与参数保留。缺少 modifier ε260 时保留继承 oligo ε 与 Δε=0 的明确估算假设，质量采用最终产物 MW。现有 CAP structural compatibility、formal condensation 和反应产物范围限制保留。Tm 仍 defer。

## UX

保留 CL2 Browser + Inspector + 按需 Editor。Built-in/My Custom、结构连接点、公式/质量/光学、import/export/merge、dirty draft、语言和窄屏工作流均完成测试。

Batch 显示当前化学计算或结构生成阶段。细分计时写入 Batch.run 的 stageTimings，并进入 Batch 2.2 Results 工作簿的 Summary。结果表仍在处理完成后统一更新，沿用首 100 行与需审核条目显示策略。

Infinity 写入使用 oligo.infinity.v1: 前缀。首次读取可继承浏览器可见的旧数据，写入实验副本后继续使用实验数据。不同路径/浏览器配置可能隔离 file:// 存储，遇到空库可从原版导出 .oligoentry/.olib 再导入。旧数据的 graph、site ID、权限、坐标、光学和扩展字段兼容性通过测试。

## Batch 性能

环境为 Windows、AMD Ryzen 5 7640HS，Edge 157，headless，file://。每次处理同一脂质活性酯和四条不同长度 RNA，分别为 21、60、100、150 nt。各模式重复两次。下表为两次的中位数，包含逐行 yield，XLSX 与 ZIP 封装单独测量。

| 四条混合长度批次 | CL2 | Infinity I1 | 比值 |
| --- | --- | --- | --- |
| 化学计算 | 2.050 s | 0.709 s | 2.89× |
| 化学 + CDXML/MOL/原子 SVG/示意 SVG 请求 | 36.814 s | 2.215 s | 16.62× |

含结构模式的 CL2 两次为 38.834/34.795 s，Infinity 两次为 1.966/2.463 s。反应后示意 SVG 超出当前语法的情况继续明确标记为部分不支持，实际输出的 CDXML、MOL、原子 SVG 共 24/24 份文本与基线相等。

16/16 个完整 MoleculeState 在仅归一化随机 UUID 后哈希相等，包含 graph、formula、MW、optical、反应历史及 provenance。对应结果行也相等。80/80 个固定种子几何场景与原算法的完整布局结果相等。

最初的四条 CDXML/MOL/示意 SVG 测试中，结构布局入口累计约 24.05 s，其中绘图质量诊断约 4.06 s。试剂解析只有 1 次约 1.8 ms，catalog 初始化也只在批次边界进行。计算路径内反复邻接扫描是另一个热点。

测量覆盖独立 parse、assembly validation、graph expansion、motif discovery 微测，及整批 sequence/checkpoint、reaction/checkpoint、optical、properties、layout、SVG/CDXML、progress callback、XLSX、ZIP。嵌套 inclusive 计时不能相加当作总耗时。CPU 采样还包含测试自身哈希/正则成本，报告中的加速比采用 Batch.run elapsed。

持久计时覆盖 library、sequenceAndCheckpoint、reactionAndCheckpoint、presentationRecord、layout、逐格式 serialize、schematicSVG、resultCallback 和 progressUI。首个导出批次的 XLSX 写入约 3.6 ms，ZIP 约 31.5 ms。

此结果来自上述本机样本。用户原始慢批次及数千行、多步骤长链的耗时尚未复现到相同输入，无法将该比值推广到所有任务。

## 最终回归与分母

| 检查 | 结果 |
| --- | --- |
| Core 原回归 | PASS 72/72 |
| Legacy library 保存/恢复 | PASS 26/26 |
| 当前适用 Node suites | PASS 15/15，包含上述两套 |
| Branch suite | PASS 29/29，含长链、嵌套、混合反应及状态恢复 |
| Hardening suite | PASS 14/14 |
| C8 presentation suite | PASS 10/10 |
| A/C fixture invariants | PASS 114 assertions / 10 fixtures |
| 真实反应 UI | PASS 95/95 scenes，112 PASS + 5 MANUAL PASS + 12 EXPECTED REJECTION，共129步骤 |
| 有限反应定义 | PASS 8/8 |
| 内置试剂适用组合 | PASS 25/25，覆盖16/16试剂，另1个reference-only条目 |
| 双输入交换专项 | PASS 32/32 pairs，12个可物化plan检查 |
| Batch 2.2 | PASS 22/22预期结果，16成功、4预期失败、2需审核；16/16与逐个Builder结果一致 |
| Batch 2.1 | PASS Edge/Chrome 实际工作簿上传、预览、计算、双语、结果Excel与ZIP下载 |
| Library UI | PASS Edge 15/15，Chrome 15/15，含旧库、单/多attachment、merge、真实下载和窄屏 |
| Infinity 专项 | PASS Edge/Chrome各8个独立组，另附invariant/finite分母详情 |
| 几何等价 | PASS 80/80 |
| 基线化学库文件 | PASS 逐字节一致 |
| 打包后复核 | PASS 解压副本 file:// 入口、8组专项、15项库 UI、72项Core、26项迁移及registry parity |

catalog audit 清点156个序列条目，其中138个 assembly_ready，18个未就绪条目按既有状态呈现。反应目录17条中16个可选试剂，1条reference-only。未就绪条目未被算入已支持分母。

扩展旧测试初跑为8/14套通过。其余涉及已变化的UI大小写、5′/3′分支端点、旧版registry哈希与VM缺失依赖。五套完成维护后复跑通过。CL1专属历史harness仍依赖缺失的rc243-r3目录及已取消的Team目标，该原harness初跑FAIL，当前迁移通过26项保存回归和双浏览器15项库工作流覆盖。交付的活跃测试集采用当前适用入口。

## 自审与剩余限制

- **FAIL记录**。历史测试初跑失败及原因保留在研发证据中。当前活跃发布验收无失败。
- **ENVIRONMENT LIMITATION**。真实 ChemDraw 打开、编辑、再次保存没有自动化环境验证。检查的是输出XML、化学图及浏览器导出。
- **NOT TESTED**。真实合成结果、实验收率、modifier吸收实测、用户原始慢Excel、数千行大包、极深反应历史、其它浏览器/操作系统。
- **NOT TESTED**。全部化合物两两组合空间未穷举。有限内置试剂的适用定义组合已穷举。
- 反应简图仍有明确范围限制。原子导出保留真实化学图，某些长跨列直线键的视觉效果仍需要用户在ChemDraw评估。
- 主线程仍按行yield。一条极重任务期间的取消响应和长历史序列化仍可能变慢，尚未引入worker。
- 旧Reaction Notebook与多个入口仍有prototype痕迹，本轮优先保留兼容性与已验证流程。
- 存储quota/浏览器策略沿用库的备份与并发更改检测。跨所有真实浏览器配置的数据迁移仍需用户导出文件核对。
- 一个旧audit脚本初跑时重新生成了项目根目录原有builtin-audit.json。后续默认输出已限定在实验目录。原审计文件此前内容未留快照，无法确认恢复；Toolkit基线ZIP与程序文件核验保持完整。

## 下一阶段最值得做的五件事

1. 用用户实际慢Excel和真实试剂重跑，测定大批次CPU、峰值内存与每步耗时。
2. 将深历史checkpoint的重复快照改为版本化引用/结构共享，先建立旧状态迁移和replay证据。
3. 为file://提供可回退的worker执行路径，验证取消、异常恢复与跨浏览器兼容。
4. 在真实ChemDraw验证5类代表性输出，整理可编辑性、跨列直键和往返保真矩阵。
5. 收集有来源的modifier ε260与实验边界资料，优先消除现有光学假设及反应产品scope的不确定性。
