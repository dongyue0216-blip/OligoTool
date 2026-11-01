# Integration Guide

2026-11-01 · 面向未来 Integration Work。唯一 baseline 必须是集成时最新、已验收的 Chemistry/Reaction Engine 主干。

## 边界

不要合并两份完整产品 ZIP，不要将 `ui_prototype/app.js` 覆盖生产 `app.js`。本支线只提供视觉 tokens、布局、组件职责和交互状态；所有 fixture、schematic SVG、demo download 和 demo state 都不能进入生产 chemistry 路径。

参考读取了本地 `outputs/v080/verified/.../Start.html` 与 `outputs/postmod-v0101/verification/.../Start.html`，确认历史页面包含顺序堆叠的序列、结构、结果、下载、Batch 和 Custom Chemistry 区域；也读取了后者 `app/reaction-ui.js` 的界面入口；v0.10.1 已有三栏、独立 viewer、site selector、结果与导出，集成应保留其能力。它们只是观察样本，不是集成 baseline。该文件及 DOM、函数名、schema 随主干变化，不在本设计中冻结。主干 ZIP、这些文件与 `sources/` 均未改动。

## 推荐组件映射

| 设计组件 | 职责 | 从最新主干接入 |
|---|---|---|
| WorkspaceShell / TaskNav | 任务切换、标题、草稿存在状态 | 现有页面/面板路由；保留旧操作可达性 |
| SequenceEditor | 输入、错误位置、生成按钮 | 当前 parser、支持 notation 与 generation action |
| StructureViewer | 渲染、Fit、zoom/pan、focus、selection overlay | 主干 renderer 和 view transform；不修改 graph |
| MoleculeSourceControl | current record / library / file 选择 | 当前导入器、库记录及 current molecule |
| SiteSelector | 语义标签、稳定 ID、click/select 同步 | engine 提供的候选与 validator；禁止 UI 推断拓扑 |
| ReactionWorkspace | A/B/C 布局与草稿状态 | 当前 reaction controller / Preview / Apply |
| WorkflowHistory | 已应用步骤和当前草稿 | 主干 workflow/provenance，只读展示 |
| MoleculeResultPanel | 六项指标、光学状态与来源 | 该 record 的统一结果服务 |
| ExportToolbar | format availability 与下载 | 当前 exporter、能力/experimental 标志 |
| LibraryBrowser / CustomEditor | 检索、角色、导入、attachments、save | 当前 library storage 与自定义结构校验 |
| BatchReview | 映射、行状态、inspect | 当前批处理器，不另写 chemistry 循环 |
| AdvancedDisclosure | coverage、debug、来源详细信息 | 当前诊断输出；默认折叠 |

Token 入口为 `ui_prototype/styles.css` 顶部 `:root`。可迁移色值、间距、边界、字体和 panel hierarchy。布局可复用 grid 比例、断点思路与面板顺序；应将选择器重命名或隔离到生产 design-system 根节点，禁止直接导入本原型对 `button` / `nav` / `svg` 的全局样式。

## UI adapter 的职责（概念映射，不是新 API/schema）

Integration 应先列出最新主干已经能表达什么，再做薄的 presentation adapter。下述是 UI 需要的语义，不要求改主干数据结构或添加同名字段：

- molecule identity / revision、source、graph 与 display-ready depiction。
- 对应 reaction 的 site candidates、稳定 atom/site identity、显示名称、当前选择和验证原因。
- preview identity 与其输入 revision；产物 graph、指标、optical status、export capabilities。
- Apply 是否已提交、当前 workflow product 与 provenance、可否继续下一步。

display label 不作为 identity；数组位置、SVG 元素顺序、旧 atom number 不能成为跨步骤连接依据。渲染后的 hit target → stable identity → engine candidate 应可双向追踪；重画/缩放只改显示坐标。第二个 O 的选择必须有明确 identity round-trip 验收，不能通过临时增加号码绕过 topology mismatch。

主干若缺少这些信息，先记录 capability gap 与具体适配需求，不能悄悄从 formula 或 SVG 文本反推。已有 schema 足够时不要为套 UI 再造 MolecularGraph 或 ReactionWorkflow。

## 建议集成次序

1. 在最新主干做隔离集成 checkout，记录 baseline/version 与原有 chemistry/export 验证结果。此阶段才评估实际 DOM、组件边界和事件。
2. 先接 tokens + shell + panel 布局，保留所有原有行为。将冗长帮助、coverage/debug 移入合适 disclosure，但保留 scientific status。
3. 接 Single：renderer 和结果面板共用 record，确认 sequence → structure → metrics → exports 没有变化。
4. 接 Reaction：先 A/B independent viewer 与 site identity，再 Preview/stale/错误，最后 Apply/Continue/history。
5. 接统一 exports 与 optical status；能力驱动禁用，检查 preview/applied file provenance。
6. 再迁移 Custom/Library/Batch。通过同一套验收后才替换旧界面入口；不要让新旧界面产生两个 current molecule 真相来源。

## 必须等主干稳定后适配

| 待确认契约 | 依赖原因 |
|---|---|
| 候选 site 与 topology validation | UI 无权判定 Cap 的第二个 O 或其他反应的合法位点 |
| Preview 输出与输入版本关联 | 决定 stale preview、异步竞态处理 |
| Apply 的提交时机和 current product | 决定 Continue 仅开下一步还是完成提升；避免重复应用 |
| 结果与 optical 计算支持范围 | 决定哪些数值有值、estimated 或缺参 |
| exporter 与 workflow/provenance | 决定可下载格式、metadata 和 experimental 状态 |
| 图渲染与稳定 atom ID | 决定 selection overlay 与准确点击位置 |

可立即使用的成果：视觉 tokens、页面信息架构、三栏/响应式布局原则、控件分组、文案与状态规范、结果字段顺序、Advanced disclosure 规则。这些仍需走生产代码评审，不能将“可迁移”解释成已经接入。

## 关键验收场景

- 从当前 oligo / import / library 分别载入，A/B 无需互相等待即可显示结构。
- 对一个确有多个可用 terminal O 的真实 engine fixture，点击第二个 O 与 dropdown 完全一致；合法/非法均继承 engine 结果。
- 改 source/site/template 时清除有效 preview；连续快速 Preview 时旧响应不覆盖新响应。
- Apply 双击、页面切换、返回不会重复增加 step；Continue 使用 applied graph，历史引用保留。
- 单体/长链/大 reagent 的 Fit、pan、zoom、element labels 和 site hit area 正常；不会因 CSS 重置丢失 stereobond。
- Preview/Apply 后 formula、average MW、exact mass、optical status 与全部导出指向同一 record。
- 缺 optical 参数不显示 0 或旧结果；结构可导出与光学缺参分别表达。
- 1280px、宽屏、390px、200% zoom、键盘、中文长标签、批量失败行。

原型检查见 `QA_REPORT.json`。这些检查仅证明隔离原型的布局和状态逻辑，不替代任何 chemistry regression。



## v1.1：i18n 与持久 checkpoint 集成契约（优先于旧 Continue/history 描述）

将 ReactionWorkspace 拆为有序 ReactionStepList + 每步三栏；不是单个可覆盖的 workspace 加 history strip。Apply 提交 checkpoint，Export 读取指定 checkpoint，Add Next 仅创建引用上一产物的新草稿。这三个事件彼此独立。逐步 records / revisions 和 exports 都从最新主干现有接口映射；本说明不是新增 chemistry API。

Presentation adapter 持有 UI step ID → engine record/revision、输入引用、反应类型、候选 site identity、结果与能力映射。Apply 成功后建立只读 UI snapshot 引用；不要复制或改写 MolecularGraph；不要靠 formula、DOM、序列或旧 renderer 恢复历史 graph。若主干只保留 current product 而无法获取历史 record/export，必须登记 capability gap，不能用缓存 SVG 假装完整 checkpoint。待有受支持的记录保留路径后再开放相应功能。

TranslationProvider 在 shell 层提供 t()/locale。将现有 labels、errors、menus、dialogs、tooltips、aria 与动态 status 逐项替换 key；engine code → localized message 的映射放 adapter。用户 payload、化学 ID、公式、导出内容原样保留。持久化仅 locale；不以本轮语言记忆承诺分子自动保存。安装 i18n 不改 parser、ReactionDefinition、质量/OD 算法或 serializer。

Track C 负责真实结构内部布局与 depiction；Track B 仅接 viewer 容器、view transform、fit bounds、highlight overlay、stable site hit identity。原型的示意 SVG 不进入产品，不调整分子坐标来适应翻译长度。

迁移顺序：冻结 baseline → 文案 inventory/key parity → 语言 provider → shell 与页面组件 → step list adapter → checkpoint exports → 五页面双语与真实 1/3/5-step regression。主干已有化学 API 保持不变；功能缺口单独报告，不在此 Track 内补引擎。

验收必须同时满足：语言切换不发起 chemistry 调用；数值/graph/export payload 前后一致；原始 chemical tests 通过；历史 checkpoint 导出在追加 5 步后仍绑定原 record/revision；中英文 file://、长文案、200% zoom、键盘/读屏和每个 engine error 分支完成生产验收。本轮 QA 仅原型级，未进行主干 integration。
