# Presentation API / contract v0.1

状态：最小实验 API 可运行；下述 v1 语义字段为 integration 目标，不能视为全部已实现。

## 当前可执行接口

```js
const result = Presentation.layout({
  graph, // atoms[{e,h,q,s/other fields,x,y}], bonds[{a,b,o,s,...}]
  semantics: {
    groups: [{id:'fragment-2',kind:'reaction-fragment',atoms:[42,43,44]}],
    placements: [{group:'fragment-2',bonds:[40],
      angles:[{atoms:[20,21,42],degrees:120}]}],
    routes: [{bond:18,points:[[0,0],[0,12],[20,12]]}]
  },
  policy: {bondLength:1.5}
});
const drawingGraph = Presentation.materialize(graph, result);
```

graph 不会被修改。a/b、atoms 和 bond 索引均为零基。groups 必须互不重叠；允许未分组原子，未移动组和未分组原子视为固定背景。placements 按顺序执行；每个连接键必须恰好一个端点属于移动组。首个连接键长度固定为 bondLength，其他连接键仅软约束，残差超限给 warning。无 placements 时严格保留所有原始坐标。angles 是真实原子三元组，范围内的坐标约束，不生成新化学键。

返回：`schemaVersion:'presentation/0.1'`、`identity`、`coordinates[{x,y}]`（与输入原子顺序一致）、`visualBonds`、`bounds`、`groupBounds`、`metadata{engine,policy,transforms,closePairs,warnings}`。bounds 包含 route 点，groupBounds 只包含原子，尚未计入标签尺寸。transform.rotation 单位为弧度，determinant 恒为 +1。

单位是模板二维单位，默认目标键长 1.5；x 向右、y 向下。SVG 沿用；MOL/SDF y 取反；CDXML 使用冻结 exporter 的单位转换。坐标对比须先撤销各格式单位转换。

错误：COORDINATES_REQUIRED、INVALID_GROUP_PARTITION、MISSING_GROUP、INVALID_JOIN；materialize 对过期图抛 STALE_LAYOUT，对原子数不符抛 ATOM_COUNT_MISMATCH。v0.1 面向受信任的本地 fixture，不是完整输入验证器。不能依赖其拒绝一切无效 route 或策略参数。

## 推荐 v1 数据合同

```ts
interface PresentationRequest {
  graph: MolecularGraph; // immutable, stable atomId/bondId, chemistryRevision
  provenance: SemanticAnnotations;
  seedCoordinates?: Record<AtomId, Vec2>;
  policy: { oligo: OligoLayoutPolicy; terminal: TerminalModifierLayoutPolicy;
    postModification: PostModificationLayoutPolicy; conjugate: ConjugateLayoutPolicy;
    collision: CollisionPolicy; routing: RoutingPolicy; fit: FitPolicy };
}
interface SemanticAnnotations {
  schemaVersion: string; graphRevision: string;
  chains: {id:string; orderedResidues:string[]; direction:string}[];
  residues: {id:string; chainId:string; ordinal:number; atomIds:string[];
    localFrame?:Frame; upstream:AtomId; downstream:AtomId}[];
  fragments: {id:string; atomIds:AtomId[]; role:'terminal-modifier'|'reaction-fragment'|'linker';
    sourceBuildingBlock?:string; sourceReactionStep?:string; rigidGroups?:AtomId[][]}[];
  terminals: {chainId:string; end:'five'|'three'|'upstream'|'downstream';
    anchor:AtomId; phosphateAtoms?:AtomId[]; outwardVector?:Vec2}[];
  connections: {bondIds:BondId[]; fragmentIds:string[]; formedInStep?:string;
    templateId?:string; constraints?:GeometryConstraint[]}[];
  ancestry: {atomId:AtomId; sources:{stepId?:string; inputId:string; atomId:AtomId}[]}[];
}
```

v1 输出还应有 chemistryRevision、layoutRevision、policyVersion、coordsByAtomId、visualBondsByBondId、labelBoxes、diagnostics（severity、involved IDs、reason）、fitTransform、status=ok/review/unsupported。缓存键必须包含 chemistryRevision + annotationsRevision + policyVersion + seedCoordinatesRevision。UI 禁止从 DOM 反读作为下一步化学图。

Assembly adapter：building-block.position/node/local_atom → residue ownership；terminal-linkage.termination → terminal phosphate；linkage.edge/source/target → backbone connection。终端 5′/3′ 必须由 AssemblyGraph orientation/site 给出，不能仅根据 position==1 猜测。

Reaction adapter：递归 previous ancestry，并使用 input_atom_maps 将输入的 atom/bond/group/routes 映射到产品；null 表示真实离去原子，不可重新添加。reaction kind 标识新形成 bond，edited 标识旧键改变。新增片段应指本步引入且保留的试剂原子，不代表反应凭空生成原子。多步时为每个 step/input 保留独立 ID，不能把最近一次 input=1 当成全历史身份。原型 mappedStep 只覆盖本轮单步 fixture，通用递归 adapter 留待集成。

## Export 合同

先验证 graph revision，再 materialize，一次生成 shared drawingGraph，随后 SVG、MOL、SDF、CDXML 共用。atom/bond mapping 和 stereo 端点方向必须保留。route control points 仅写 SVG/布局 JSON；CDXML 如需曲线须用独立 visual object，不冒充 chemical nodes。本轮验证计数和化学字段保持；不宣称完成所有外部 ChemDraw stereo round-trip 兼容性验证。
