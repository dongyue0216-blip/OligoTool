# v0.9.1 本地 SGroup 兼容修复报告

日期：2026-10-29。GitHub 发布版。

## 基线及审计整改

基于前序导入器审计及 `Oligo_Toolkit_v0.9.0_MOL_Import_Fix_local.zip` 继续整改。
SHA256：`54394ee994bfbba29568f829277ec6e608c9fe76f654bb99b30e2de2fc83a582`。
基线全新解压后修改，没有混合其他历史版本。

| 审计发现 | 本次处理 |
|---|---|
| V2000 将所有 SGroup 拒绝，正则仅用于提示 | 新增 CTFileSGroups 结构化解析边界，先读取关联的整组记录，再按组类型、成员及语义分类，最后调用原图读取器 |
| 没有 identity、membership、raw 或 hierarchy | 保存 identity/type、atom/bond membership、labels、data/display 原字段、parent、原始物理行及行号；保留完整原始 MOL/SDF |
| 不能判断 SUP/重复单元等语义 | 仅接受显式原子图 SUP；未知缩写占位原子、查询标签、SAP/模板、重复/聚合/混合等明确拒绝，未做猜测展开 |
| V3000 非零 group count/SGROUP 块全部拒绝 | 读取 SGROUP、continuation、quoted strings、计数列表、稀疏 atom/bond IDs、parent；验证与 COUNTS 一致，处理完成才交给原图读取器 |
| 通用错误可能引导用户删字段 | 新错误包含 CHEMISTRY_UNSUPPORTED / UNSUPPORTED_SGROUP_SEMANTICS、原始行号、组编号/type、record/property 和原因；提示完整展开而非删记录 |
| 未验证合法组合、真实样本、嵌套及往返 | 增加组合矩阵、44 个公开 RDKit 样本、嵌套多组、原始存档精确导出、JSON 持久化、643 个拒绝/健壮性用例及浏览器链路 |
| 大分子和 viewer 限制需继续解耦 | 保留已有 fit/zoom、预览故障隔离及 quota 处理，重跑 36 组大分子/坐标矩阵和 5000 原子浏览器链路 |

修改主要集中在 app/chemistry.js；app/core.js 仅透传 ctfile 元数据；app/app.js 和 Start.html 增加状态及原始存档下载。AttachmentSite、OD260、linkage、Single/Batch 的计算规则未改变。

## 三类处理结果

1. **supported**：plain V2000/V3000，以及以全部真实原子/键表达的 SUP。SUP 的显示状态不会增加或删除原子；显式存在的 crossing bonds 如有声明必须与实际边界完全一致，未声明时从显式图派生，记录为 derivedCrossingBonds。成员不能是未展开的伪原子，不能带尚未解释的 SAP、CLASS、NATREPLACE 或通用查询标签。
2. **preserved**：DAT、GEN 的非图信息。组身份、成员、标签、data/display、parent/child 信息及原始记录保存在 graph.ctfile；不拿标签或 data 猜分子式，也不把它们变成原子。最终是否可录入仍受已有 scaffold 校验约束。
3. **safely rejected**：无法确定真实分子的语义、未知类型/记录/属性、损坏的引用/计数/层级。报错停止导入，手动 attachment 模式也不能绕过。

## 类型矩阵

| 类型 | 行为 | 边界 |
|---|---|---|
| SUP | 显式图条件支持，元数据保留 | 支持展开/折叠的显示状态；不从字符串缩写生成结构；不支持模板/离去基团/SAP/化学 class。已知 generic query 标签拒绝 |
| DAT | 保留非图 data annotation | MRV_IMPLICIT_H、QUERY、SMARTS、VALENCE、AROMATIC 等已知化学/query 数据字段拒绝；QUERYTYPE/QUERYOP 拒绝 |
| GEN | 保留非图 grouping | 仅组身份、成员、标签、层级、显示等；若附带未解释的化学/聚合字段则拒绝 |
| SRU、ANY、MON、MER、COP、CRO、MOD、GRA | 拒绝 | 不尝试将聚合物/重复范围转换成确定有限分子 |
| MUL | 拒绝 | 即使有些标准文件包含完整展开图，也尚未验证乘数、parent atoms 和重复对应关系；这是保守兼容性限制 |
| COM、MIX、FOR | 拒绝 | 不把组分或配方当成一个确定连通 molecule |
| 未知 type | 拒绝 | 不按 generic metadata 放行 |

## V2000 record 矩阵

| record | 读取/处理 |
|---|---|
| STY | 定义 identity/type，禁止重复/零编号，其他组记录必须先有类型声明 |
| SAL | 计数列表，累积 atom membership，检查存在性、重复 |
| SBL | 计数列表，累积 bond membership；SUP 检查 crossing bonds；DAT 视为 containment bond metadata |
| SLB | external label/identifier 字段保留 |
| SMT | 完整标签保留；不解释为分子式或重复次数 |
| SDS EXP | 读取展开显示状态；其他 flag 拒绝 |
| SDI | 读取四个有限坐标数作为 bracket display；保持原始坐标系 |
| SBV | 保留 bond/vector 原字段；不解释为化学连接指令 |
| SDT/SDD/SCD/SED | 字段描述/显示/数据原片段按顺序保留；SCD/SED 需要 SDT；不承诺实现完整第三方 data rendering |
| SPL | parent 引用解析，检查 parent 存在及循环 |
| SBT | bracket style 字段保留 |
| SST/SCN/SNC/SPA | 识别 subtype/connectivity/component/parent-atom 数据，随后拒绝未实现语义 |
| SAP/SCL | 识别并保留诊断定位，随后拒绝 attachment/class 语义 |
| 其他 S*、未知 M 属性 | 可解释拒绝；无 ignore-all、无未知属性放行 |

非 SGroup 的 CHG/ISO/RGP、A alias 仍由原读取器处理。新增拒绝真实元素原子上的未解析非位点 alias，防止将缩写误当普通原子。未知/畸形 property 行也拒绝。

## V3000 覆盖

解析 BEGIN/END SGROUP、组编号/type/external index、ATOMS/XBONDS/CBONDS/PATOMS、LABEL、PARENT、ESTATE。保留 BRKXYZ/CSTATE/FIELDNAME/FIELDINFO/FIELDDISP/FIELDDATA/BRKTYP 和明确识别的 Marvin MRV_FIELDDISP 显示扩展。支持物理行 `-` continuation、空格字符串及双引号转义、稀疏原子和键编号。

CLASS/SAP/NATREPLACE/SUBTYPE/MULT/CONNECT/COMPNO/XBHEAD/XBCORR/QUERYTYPE/QUERYOP/PATOMS 等会触发明确拒绝。未知关键字、DEFAULT 行、未支持的其他 section、增强 stereo COLLECTION、模板块等不伪装为已支持。V3000 非 V30 的 M 属性也拒绝。读取在 M END 停止，SDF 后续数据不再误入图读取器。

支持结构化字段不等于完全实现对应显示规范。所有未解释 display/data 值均有原始记录可查；不会改变 MolecularGraph。

## 元数据保存、往返和坐标

`graph.ctfile` 包含 schema_version、原格式、完整 source、groups、rawRecords、source ID 列表及 sourceToGraph 映射。成员引用使用原始 ID，映射明确对应保存的图下标。坐标归一化、旋转不会重写原始 bracket/vector，所以这些显示坐标标记为 source space，不用于 viewer 布局。

元数据随 registerCustom、localStorage、Custom Manager、library JSON 备份恢复、Core BuildingBlock 和 AssemblyGraph 保留。界面提供“导出原始 MOL/SDF（导入时存档）”，测试确认内容与输入完全一致。它是导入时存档，不是编辑/组装后的结构导出。

**当前 MOL/SDF/CDXML writer 仍只输出显式图；不会重建组装后新的 SGroup 编号、跨 block 边界和显示几何。** 需要保留全部来源时请用 library JSON 或计算结果 JSON；需要原文件时用存档下载。没有承诺经过 graph 编辑后还能 lossless 重写 CTfile。大 source 占用浏览器存储，已有 quota 错误仍会阻止保存并保留旧库。

## 测试证据

见 tests/evidence/sgroups/results.json、browser.json、browser.png 以及 tests/evidence/large-import/results.json。

| 测试 | 结果 |
|---|---|
| 新组合矩阵 | 14 组通过：plain 两格式、SUP、DAT、GEN、嵌套、多组、V3000 稀疏 ID/continuation、999/1200/5000 原子 × 1/100 倍坐标 |
| 真实公开 fixtures | 44 个 RDKit 官方样本；2 个完整导入（Sgroups_Data_01、Sgroups_Generic_01），42 个明确拒绝；每个原因见 JSON，不能把拒绝数当作兼容成功数 |
| 未导入的公开样本 | 包括 polymer/multiple/formulation、无效引用、未知扩展、多个 disconnected fragments、CHG/非 scaffold 元素、RGROUPS/VAL 等；支持 SGroup layer 不会绕过原有图校验 |
| 健壮性/拒绝 | 643 个：两格式各类 unsupported type、SCN/SST/SPA/SAP/SCL、未知记录/属性、越界、计数错误、循环、query label、100 个未知 type、固定随机种子 500 个未知/畸形组合；自动与手动模式都拒绝 |
| 浏览器完整链路 | 12 原子 SUP+DAT 和现有 23 原子真实 MOE scaffold 加 SUP+DAT：上传→viewer 点击选位点→保存→刷新→Custom Manager View→备份恢复→Single/Batch；无 page error |
| MOE Single/Batch | 同为 C32H43N13O18P2；AssemblyGraph 保留两组 metadata；未知光学贡献仍为 PARTIAL，没有猜 OD260 |
| 大分子浏览器 | 36 组，覆盖 6/100/500/999/1200/5000 原子、1/10/100 倍坐标、0/−1e8 偏移；5000 原子选位点、保存刷新、Single/Batch、fit/zoom 命中和预览异常隔离通过 |
| 原有回归 | 240 + 125 回归通过；building-blocks 1625 case / 520432 assertions / 1620 batch rows（另有 12000 原子案例）通过；terminal 144 case / 15 invalid / 145 batch rows 通过 |
| 基线已存在失败 | architecture.cjs 的 master-library.v2.json 快照与 core 当前输出不一致；未修改基线也失败。未为了让它通过而更改 reference/master library。未将其记为通过 |

公开 fixtures 来源及 git blob/SHA256 见 tests/fixtures/sgroups/SOURCES.json；原始 BSD 许可证一并保留。workflow.mol 为本次生成样本，不计入 44 个公开文件。

## 成熟 JS/WASM parser 评估

评估 RDKit 官方 MinimalLib/RDKit.js：BSD 许可适合 vendoring，浏览器 WASM 路径不需要 Node 运行时；官方分发由 JS wrapper、WASM 和声明文件组成，具备比本项目手写图读取器更成熟的化学能力。

本次没有引入：现有产品是双击 file:// 的同步离线页面，引入异步 WASM 需要验证二进制加载、浏览器 file 权限、包体积和初始化失败路径，还需验证公开 JS API 对 SGroup/SCSR 元数据的保留与本项目 attachment contract 的映射；当前未完成这些证明，不能仅因它可解析 molblock 就声称能完整解决全部 SGroup 语义。未做候选二进制的精确大小/性能基准，也未宣称 RDKit 不支持相关语义。本次没有新增运行时依赖或网络请求。

参考：
- https://discover.3ds.com/sites/default/files/2020-08/biovia_ctfileformats_2020.pdf
- https://github.com/rdkit/rdkit/blob/master/Code/MinimalLib/README.md
- https://rdkit.org/docs/Overview.html
- https://github.com/rdkit/rdkit/tree/master/Code/GraphMol/FileParsers/sgroup_test_data

## 已知限制和用户测试建议

本次建立的是受约束的 supported + preserved + safely rejected 框架，不是全部历史 MDL 扩展支持，也没有缩写字典、SCSR、polymer 或 MUL 自动展开器。未知化学扩展仍会拒绝。现有 Custom Chemistry 仍限单连通、中性 CHNOPS/F、无同位素、支持的价态和 Kekulé 单/双/三键；复杂 charged/aromatic-query/金属/盐混合体系可能仍无法录入。

先备份现有库，在解压目录双击 Start.html，用实际 ChemDraw 完整展开的 Custom Chemistry 测试。若被拒绝，请保留原始文件和完整错误；不要删除 SGroup 行绕过。若格式层通过但出现 scaffold 限制，错误会保留，需另行实现相应图化学能力，不能用 viewer 尺寸或 SGroup 忽略策略处理。
