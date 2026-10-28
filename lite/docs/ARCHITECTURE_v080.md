# Five-object architecture v0.8.0

The assembler connects attachment sites, not residue identities.

`app/core.js` 定义 MolecularGraph、BuildingBlock、AttachmentSite、LinkageDefinition 和 AssemblyGraph 的建立/兼容性验证；`app/chemistry.js` 保留 notation adapter、统一展开器、图派生计算与布局/export；`app/app.js`、`batch/batch.js` 调用相同 Lite.calculate。

## Objects and ownership

MolecularGraph 保存真实 atoms/bonds（e/h/q、键级 o、stereo s、坐标及已有其他 atom attributes），不以 formula 代替结构。graphFormula/masses 从最终图派生，旧 component/direct composition 作为独立交叉验证。显式 H 和 atom.h 是本引擎的氢表示。

BuildingBlock v3 = graph + sites + metadata + layout。family/base/sugar/name 只描述身份，不作为连接权限。核心对 Standard 与 Custom 调用同一个 buildingBlock adapter。`Lite.getBuildingBlock` 仍返回兼容旧 API 的对象，`Lite.core.buildingBlock(...)` 返回 v3。

AttachmentSite 用真实 atom index、direction、role、element、connection_class、compatibility_domain、unconnected state 和允许的 internal/terminal linkages 描述。upstream/downstream 是序列方向，不等于糖环 C5′/C3′。schema 保留 branch/other 方向；当前展开器拒绝尚未实现的 branch 连接。一个物理原子不可被多个连接重复消费。

LinkageDefinition v1 保存真实 fragment graph、center atom、source/target 元素及 role 要求、方向、terminal forms、H 消耗/bond edit rule 和布局模板。六种 O-linked definition 加专属 PMO 定义均由当前参考图迁移；phosphorusGeometry 读取正式 definition 的 graph。PMO source 为 N、target 为 O，绝不通过 generic O/O definition。

AssemblyGraph v1 是具体分子的总装计划：ordered nodes（position、orientation、block snapshot）、edges（source/target sites、linkage）、terminations。site termination 保留已定义 OH/NH；linkage termination 用有序 `linkages` 路径和 neutral-acid cap 表示 PO/PS/PS2 等。PO 的 PP/PPP 路径可展开；未定义位置的 modified polyphosphate 拒绝。已有 VP 的磷结构属于 block 自身，不能伪装成 free attachment。

`Lite.toAssemblyGraph(sequence)` 生成可序列化图；`Lite.expandAssemblyGraph(assembly)` 只依赖 block snapshots + versioned linkage definitions，不重新解析序列或查询 block registry。节点 orientation 约束真实 edge 端点；显式反向使用两端需交换端点。只有审计声明 reversible 的单点标准 modifier 允许旧 notation 自动定向，用户单点 Custom 的方向保留。

最终 `graph.provenance.atoms[i]` 与 `bonds[i]` 一一对应：block 项含 node/position/block/local atom/bond；internal linkage 项含 edge、linkage、source/target、positions；terminal 项含 termination/node/position/linkage/step。site 原子的 H 在连接时消耗，其来源仍属于 block，assembly edge 记录其编辑原因。图、stereo 和键级不受显示路由影响。

## Compatibility and migration adapters

连接许可 = source site ∩ linkage source/target requirements ∩ target site。兼容 domain 是迁移时写入真实 sites 的保守化学合同，不由运行时 family/name 判断。TNA/GNA 使用不同的已审计 O3/O2 domains，因此未定义的跨域边界被拒绝；未来可增加可靠的专用跨域 definition，而不是 family whitelist。

`reference-data.js` 是离线 runtime atomic snapshot；`master-library.v2.json` 是正式五对象 catalogue；旧 master-library.v1.json / flat building-block-registry.json 保留兼容工具的格式，由 sync-registry 检查。migrate-v080 生成 v2 和逐对象 audit；新 runtime 用户 Custom 经同一个 core normalization，不依赖另一个 assembler。

旧 terminal_only/allowed_positions/o5/o3 字段仅保留给旧 API/历史回归，不再作为化学许可。布局结果中的 o5/o3 是显示兼容字段，不是连接选择器。InvAb 有两个真实兼容位点，允许内部使用；旧 terminal-only 限制已移除。

## Future interchange

HELM R-groups 可映射 site id/attachment atom，capping 映射 unconnected state 或 terminal linkage path；SCSR semantic superatom 对应 block/node，expanded atom/bond mapping 对应 provenance；BigSMILES 的 connection/termination 思想对应显式 edge requirements 与 terminations。当前没有完整 HELM/SCSR/BigSMILES parser/export，不声称标准符合性。

目前可靠范围为 connected linear assembly。branch、环、额外 capping chemistry、用户自定义 linkage registration 和结构缺失的 modifiers 必须先有可靠图与 edit rule；不会输出猜测结构。
