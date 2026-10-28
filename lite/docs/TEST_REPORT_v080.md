# Test report v0.8.0

日期：2026-10-28。基线为实际浏览器 Lite v0.7.0。测试总数有交叉，不合并夸大计数。完整本轮汇总见 tests/evidence/TEST_RESULTS_v080.json。

| 检查 | 本轮结果 |
|---|---|
| 新五对象核心、独立 JSON 重放、atom/bond provenance、显式 orientation、无效契约拒绝 | 118 registry graphs，219 cases，通过 |
| Standard + Custom building-block regression | 84 standard blocks；1,625 structure cases；520,432 assertions，通过 |
| Standard O-linked family symmetry | 1,512 positional/linkage cases；581,514 assertions；408 unsupported checks，通过 |
| 完整 release regression | 277 tests，0 failures |
| Batch、Single equality、Excel/ZIP、取消、错误隔离、100/500/1000 行 | 382 tests，0 failures |
| Terminal phosphorus | 144 cases、15 invalid cases、145 batch rows / 576 files；legacy checks 240/240 与125/125，通过 |
| Geometry / exports | 78 cases；288 batch files；局部 phosphorus geometry deterministic，layout/collision checks 通过 |
| Edge Custom UI | Save & New、New、persistence、单点、Single/Batch 4格式一致；约2.18MB MOL、1200 atoms 自动 fit，通过，无 page errors |
| Edge family comparisons | 30 组对照通过，元素标签居中最大偏移约0.024 coordinate units |
| Edge visual / long-chain | 新截图已生成并检查；200-mer 页面通过；label offset 最大约0.0255，小于0.04 |
| 大 MOL/SDF / markers | 1,200/12,000 atoms，V2000/V3000、巨大坐标范围、3/5 aliases/maps、手动 fallback，通过 |
| Schema / registry drift | 实际 v2 catalogue 与 runtime result schema validation、sync-registry --check，通过 |
| Packaging guard | nested release、old ZIP、debug/cache/temp、duplicate entry 和 broken resource 注入测试通过；clean ZIP 的内容/CRC/hash/sensitive scan 另见包外 PACKAGING_AUDIT.json |

Sanity 保留：rArA = C20H25N10O10P；exact mass 与596.149274 Da差小于1e-6。

本轮遇到并修正的失败：重复 attachment aliases、VP 非反应性位点、旧布局假设所有 attachment y=0、旧 InvAb terminal-only 断言、旧版本 integrity hash 与旧 Batch 错误码断言。更新断言的原因是明确的模型/接口变化；所有化学 formula/graph/export 检查仍保留。verify-release 现在任一失败会返回非零退出码。

已知限制：当前只支持线性 AssemblyGraph；没有完整 HELM parser；charged/isotopic Custom 与任意用户 linkage registration 未实现；cEt/Biotin/C7N 等缺可靠图对象保留 unsupported；TNA/GNA/PMO 的未定义跨域或末端化学拒绝。CDXML 未经原生 ChemDraw GUI 验证。原库立体化学未由本轮实验重新确证，P Rp/Sp 未指定。浏览器资源仍限制极大结构与内存 ZIP。

为使 clean ZIP 可重复运行，78 条旧引擎的 graph/chemistry 对照保存为 CHEMICAL_BASELINE.json 固定测试数据；不打包旧引擎或历史版本目录。
