# Oligo Toolkit UI/UX Design Specification

版本 1.1 · 2026-11-01 · 独立设计支线，供未来 Integration Work 使用。

## 1. 范围与设计结论

以结构画布为核心的 chemistry workstation：固定的任务导航、紧凑的操作区、足够大的独立 viewer、邻近的化学位点选择、统一的结果记录。默认使用深色导航与浅色工作面；这是一项 Oligo 的设计选择，不声称 Cronin Group 有统一的设计系统。

研究发现：公开 ChemIDE 的确提供深色双工作区、紧凑顶部工具栏、Procedure / XDL 视图及 Translate / Reagents / Hardware 面板；XDL 文档说明按步骤编辑、模拟与执行，以及逐步骤可折叠日志。详见 [公开来源审计](PRIOR_ART_UI_AUDIT.md)。借鉴其任务导向和持续可见的工作面，不照搬其菜单层级或紫色品牌。

本目录没有生产程序，不包含 chemistry engine、第三方前端库或主干代码。`ui_prototype/` 内的结构是原创示意片段，省略化学键，不可作结构文件使用；所有化学结果保留 `—`，不伪造 formula、MW 或 OD 数据。原型可以检验交互位置和状态，但不能证明 Cap 位点或产物正确。

## 2. 信息架构

| 一级任务 | 默认工作面 | 次级内容与去向 |
|---|---|---|
| Single Sequence（默认首页） | 左侧序列设置 + 右侧大结构 viewer；下方结果与导出 | 语法帮助折叠；Use in reaction 把当前已生成记录送入 Reaction Workspace |
| Reaction Workspace | Starting molecule / Second reagent / Product 三栏 | 反应模板、步骤历史、产物结果、Advanced；当前优先 Cap，其他反应按主干能力开放 |
| Chemistry & Library | Saved Library 检索、类型筛选、选中条目的结构预览 | Custom Chemistry 编辑器作为同区域的明确子任务；导入 → 检查 → attachment → 命名保存 |
| Batch | 文件导入、列映射、逐行校验表格 | 单行 Inspect 打开结构侧面板；保留任务上下文和滚动位置；结果与错误均可导出 |
| Results & Exports | 按 molecule record / workflow step 查看结果 | Single 与 reaction product 使用同一结果组件，不重复计算；详情引用生成时的 record/version |

OD260 是各个 molecule result 的标准一部分，不再要求用户滚到单独页面找 OD。若原产品有浓度换算工具，可作为 Results 中的二级工具，清楚标明输入 record、光程与单位。Home 不做营销式 landing page：回到 Single 或最近任务，少一个中转页。

导航换页不丢弃未完成输入；草稿、预览、已应用记录要区分。浏览器持久化和恢复能力由当前主干决定，UI 不擅自承诺自动保存。Advanced / Developer 中容纳 coverage、debug、内部映射、回归检查、原始 JSON 预览；科学结果是否估算/缺参等重要状态仍必须在主工作面可见。

## 3. 视觉语言与 tokens

| Token | 值 | 使用 |
|---|---|---|
| `--nav` | `#172831` | 深色固定导航，减少页面视觉噪声 |
| `--bg` | `#edf1f2` | 工作台背景 |
| `--surface` | `#ffffff` | 结构画布和信息面板 |
| `--ink` / `--muted` | `#192e36` / `#596d77` | 正文 / 辅助信息 |
| `--line` | `#d4dee2` | 1px 面板边界、细分隔线 |
| `--accent` / `--accent-soft` | `#126b66` / `#e7f3f0` | 主操作、选择、轻背景 |
| `--error` / `--warn` | `#a23838` / `#8a4f10` | 错误 / 需要用户关注 |
| `--radius` | 8px 面板，4–5px 控件 | 克制的圆角，无大面积卡片阴影 |
| spacing | 4 / 8 / 12 / 16 / 24 / 32px | 组件内紧凑，任务组之间留空间 |
| font | Segoe UI → Arial → sans-serif | 系统字体，无网络字体；中文生产版补 Microsoft YaHei / PingFang SC |
| code / metrics | Consolas → monospace | 序列、数值、ID；禁止用等宽字体展示所有正文 |

正文 14px，常规标签 12–13px，主标题 28–30px；原型中的 9–11px 紧凑辅助标签在集成时按最终设备和中文长度调整，不承载关键操作说明。控件至少 36px 高，触控布局目标 44px；focus ring 为 3px。不要仅靠绿色/红色表达状态。错误文字、状态标签及位点轮廓需同时存在。

默认不强制全深色：白底结构画布更容易保持现有元素颜色和导出配色一致。未来深色主题必须单独验证元素文字、立体键、highlight 和打印输出，不能对 SVG 整体反色。Prototype 只实现一个主题。

Buttons：每个操作阶段一个主按钮；次要操作 outlined；危险的 clear/delete 使用明确文字。Inputs：标签始终可见，placeholder 不是标签；单位置于标签或数值旁。Dropdown：显示化学语义与稳定显示 ID，长条目使用 tooltip/详情，不让原始大数组占满界面。面板表头固定而短，说明文字放在需要的位置。

## 4. 布局与结构画布

桌面导航宽 216px（较窄桌面 184px），顶部栏 64px，内容边距 28px（较窄 18px）。Single 设置区宽约 300px，剩余空间全部给 viewer。结构至少占首屏主要内容的一半，避免把大段 notation / coverage 说明放在图之前。

Reaction 在 >1000px 视口下三栏，宽比 1 : 1 : 1.12；面板间距 14–16px，列使用 `minmax(0, …)`，不让长字符串把页面撑宽。1280px 仍三栏，但载入控件可换行。≤1000px 时 reactants 并列、Product 独占下一行；≤650px 时 A → B → C 纵向排列，保留清楚角色标题。禁止把三栏压成三个不可读的窄缩略图。

每个 viewer 独立 zoom / pan / Fit / Expand：桌面默认高 320px，宽屏 390px；Single 400px；生产版可在图形复杂时提高至 420–520px。短屏允许整页滚动，不能为塞入首屏而压缩 viewer 到 200px。Expand 在复杂结构时提供接近整屏画布，Escape 返回；生产版若用 modal，需 focus trap、恢复触发按钮焦点和屏幕阅读器标题。

Fit 根据图实际 bounds + 24px 安全边距，不修改 molecular graph 或原子坐标。新载入时 Fit 一次；点选位点不自动重排整图。三个 viewer 缩放互不影响，滚轮只在画布内消费。支持键盘 +/-、Fit、方向键平移；触控 pinch 作为集成项，原型仅实现拖动与按钮。不得把原子 label 缩放到无法读而无放大路径。

## 5. Reaction Workflow：纵向 ReactionStep cards（v1.1 替代旧单 workspace）

每一步是独立三栏卡：Starting Molecule / 起始分子、Secondary Reagent / 第二反应物、Product Preview / Result / 产物预览与结果。每步拥有自己的输入引用、候选选择、preview、applied checkpoint、结果和 exports；不再把当前产物放进单一全局 lastResult 后覆盖历史。

状态为 Empty → Ready → Preview → Applied。缺反应物或位点时 Preview 禁用；输入变化使本步 preview 失效；无兼容位点给本地化错误。引擎才决定位点是否合法。Applied 后输入锁定，重复 Apply 禁用，旧 checkpoint 不受后续修改影响。若未来允许修改旧步骤，必须另开分支并显式使下游失效，不能静默覆盖。

Apply Modification、Export、+ Add Next Modification 三个独立动作，不使用 Apply & Finish。Apply 确认并冻结本步，但保留本步展开以便检查和导出；Add Next 才将已应用步骤折叠为 summary，并展开新草稿。最近一步默认展开。历史随时 Expand 后恢复原三栏、结果、来源和导出；用户可同时展开多个步骤。

Summary 显示 step number、reaction type、Applied/Draft/Preview、product ID、MW / formula 摘要、Expand/Collapse、Export。历史导出直接绑定其 checkpoint，绝不引用当前步骤。Add Next 仅在当前步骤 Applied 后可用，输入自动引用上一产物完整 record/revision；不重新用起始序列生成分子，也不再次执行化学反应。

原型的 1 / 3 / 5 步按钮是显式视觉 fixture，会重置演示步骤；均用加帽示意，不能证明连续加帽有效。所有指标为 —，仅用于证明长流程布局。生产 reaction template 及可用性来自 engine，不能复制 fixture。预览检查和合法性需保留请求版本控制及防重复提交。

## 6. 结果与导出的一致性

Single 与 Post-modification 都使用同一个 `MoleculeResultPanel`，字段顺序一致：Formula、Average MW、Exact mass、ε260、nmol/OD260、µg/OD260。Formula 允许换行，数值保留单位；Exact mass 不混用 Average MW 名称。form/charge model 放在表头，不能隐藏在 debug。

Optical status 必须直观显示 Calculated / Estimated / Missing parameters / Unsupported 等主干实际提供的状态，不把缺参当 0。展开 provenance 展示方法、贡献项、source、confidence；状态和缺失原因始终可见。结构成功不代表 OD 有值，允许结构可导出但光学字段缺失。

导出位于结果面板，MOL / SDF / CDXML / SVG / JSON 共享同一 record/version，不从某个旧 DOM SVG 或全局 lastResult 偷取数据。输出能力由主干决定，experimental 标识继承主干。JSON 保留 workflow/provenance；导出文件名包含 record 或 step，并区分 preview/applied。预览导出若主干不支持则禁用并说明，不添加另一个 chemistry serializer。

原型仅下载标注 UI demo 的逐 checkpoint JSON；MOL/SDF/CDXML/SVG/Result Report 按钮禁用并说明待接入。所有六项指标使用 `—`。这不是功能验收结果。

## 7. 其他任务的组件规范

Custom Chemistry：导入区 280–320px，右侧 viewer；attachment、方向和 reagent role 贴近结构。Save 之前显示名称冲突、缺少 attachment 等 engine 返回的问题；保存后加入同一 Saved Library。Optical metadata 是可选折叠区，缺失不阻碍保存结构，具体支持边界继承主干。

Saved Library：搜索+role filter，密集行列表，选中后结构检查；Use in sequence / Use as reagent 仅在适用角色开放。备份/恢复位于库级工具栏，删除位于条目菜单，不能与 Load 并排做同权主按钮。

Batch：固定列头，状态图标+文字，错误行可定位；Inspect 共享 viewer，不能一次渲染数百个完整结构。页内显示成功/失败计数、处理进度、可取消状态；导出明确是否包含失败行，保留错误原因。

Results：按来源和 step 选择记录，复用 viewer/metrics/exports。不可跨记录拼接旧的结构、新的 MW 和另一个步骤的 OD。以 record ID + revision 关联显示内容。

## 8. 原型范围与全局 i18n

v1.1 原型覆盖五个导航页面的中英文文案、语言持久化、独立 viewer zoom/pan/fit/highlight、纵向 step cards、逐步 apply / append / export、历史展开和结果记录选择。Library / Custom / Batch 是信息架构示意，导入和化学保存操作仅提示需接引擎；不宣称实现生产功能。

语言统一调用 translation key，无散落语言判断。默认 en，记忆用户选择，全本地运行；用户数据不翻译。详见 I18N_ARCHITECTURE.md 和 BILINGUAL_TERMINOLOGY.md。当前原型不持久化 workflow，不实现真实 chemistry、批处理、图布局或 serializer。

## 9. Integration 验收门槛

1. 同一主干 chemistry 测试和原始输出在套新 UI 后保持有效；UI 不重写验证逻辑。
2. 载入任一 reactant 即可独立看图、缩放和选位点；第二个 terminal O 用稳定 ID 可准确选中，其合法性由 engine 判断。
3. Preview 产物、指标和 exports 的 record/version 一致；改输入会使其失效；过期响应不能复活。
4. Apply 一次只有一个 workflow step；Add Next 使用完整 product graph，不回退至初始 oligo。
5. 大分子、长 formula、长 site 名、invalid site、缺 optical 参数、窄屏和 200% zoom 均可操作。
6. Advanced 默认折叠，重要 scientific status 可见；没有 Cronin/Chemputer logo、品牌、源码或专有图标。
