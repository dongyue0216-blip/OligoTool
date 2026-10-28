# Migration / actual-library audit v0.8.0

基线：现有离线浏览器 Lite v0.7.0 candidate（不是 Python v1.0.0）。本报告审计实际 templates 与 Master Library，不把既有 metadata 视为已正确迁移。逐对象结果见 MIGRATION_AUDIT.json。

迁移 118 个真实 block graph：84 个 standard O-linked；5 个 TNA、4 个 GNA、5 个 PMO；其余为 VP/spacers/已实现 modifiers。所有 graphs 进入统一 v3 interface 与 AssemblyGraph，未改写原子结构以制造覆盖。

实际修正：VP 的上游 P 原子不是 free OH/NH，去除伪位点；C3N/C6N/FAM/NAG37 的重复 OH aliases 合并成一个物理位点。C3N/C6N 的旧两端用法用显式 reversible site + node orientation 保留，不能内部重复消耗。FAM/NAG37 保留真实可用的 downstream 方向。InvAb 的两个真实 sites 可内部使用，不再施加 terminal-only 类别。

保留 adapter：notation/alias；旧 flat graph registry/API；旧 component formula cross-check；PMO 空白 separator 在两端均声明 PMO 时解析为专属 PMO linkage；PP/PPP notation 解析为明确 terminal linkage path。所有新连接权限均由 site/linkage 判定。

| 未可靠迁移对象 | 原因 |
|---|---|
| pB | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| Ugn | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| cEt-A | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| cEt-T | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| cEt-CMe | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| cEt-G | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {Biotin} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {DIG} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {abasic} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {SMCC} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {MC} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {BCN} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {DBCO} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {SPDP} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {MC-VC-PABC} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {cOct} | No reliable atom-level scaffold/attachment/stereo definition in baseline; PENDING_CHEMISTRY |
| {TCO} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {CY5} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {CY3} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {CY5.5} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {555} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {647} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {594} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {488} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {568} | No reliable atom-level scaffold/attachment/stereo definition in baseline; STRUCTURE_VARIANT_PENDING |
| {C7N} | Not present in baseline registry; exact structure and attachment must be provided |

Biotin/C7N 不根据名称推测结构。terminal phosphate 是 LinkageDefinition + AssemblyGraph termination，不另造 terminal BuildingBlock 类别。spacer9/12/15/18/21 是现有 PEG aliases；符号 */**/^/!/# 是 linkage definitions，不应报告成缺失 block。

未扩大化学定义：TNA/GNA 的混合拓扑和 terminal phosphorus；PMO 的 generic O/O linkage；未定义位置的硫代 PP/PPP；charged/isotopic Custom。以上均保留明确拒绝原因。标准 O-linked 和 Custom OH 的六种 chemistry 不再按 family 区分。
