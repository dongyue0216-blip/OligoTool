# Custom Chemistry

此目录保存发布资源，不是浏览器用户库。

- attachment-demo.mol：attachment marker 示例。
- custom-MOE-5-3-example.mol：MOE 核苷 5/3 示例。
- custom-extinction.schema.json：可选 extinction metadata schema。

从根目录 Start.html → Advanced / Custom Chemistry 上传 V2000 / V3000 MOL 或单分子 SDF，确认一个或两个 OH attachment，Save 后立即使用 `[ID]`，Single 与 Batch 共用相同引擎。

两个 OH 分别指定 upstream / 5′ side 和 downstream / 3′ side；伯醇、仲醇均可。单端 upstream-only 只能置于序列下游末端（如 `rA[Up]`），downstream-only 只能置于上游末端（如 `[Down]rA`）；不会生成第二位点。方向标签不代表固定糖环碳编号。

标记支持：连接 OH 的 dummy marker 的 3/5 isotope/map/alias，R1→upstream、R2→downstream；真实 O 上的 3/5 map/alias；SDF 的 `UPSTREAM_ATTACHMENT` / `DOWNSTREAM_ATTACHMENT`（或 `5_PRIME_ATTACHMENT` / `3_PRIME_ATTACHMENT`，1-based O atom index）。有冲突时使用 manual fallback，再确认真实 OH。标记移除后会重新编号，预览显示实际编号。

Save 保留当前编辑；Save & New 保存后清空文件、预览、位点和编辑状态，立即录入下一项；New Custom Chemistry 清空当前编辑并保留已存 library。无文件大小、原子数或坐标跨度的人为上限；浏览器内存和 localStorage 容量仍有限。完整结构自动 fit-to-view。

数据保存在 localStorage（oligo-lite-custom-v2），可备份/恢复，旧版两端库自动重建方向契约。更换文件路径或浏览器前请备份。默认支持中性连通 CHNOPS/F、常规价态、Kekulé 键、wedge/hash；带电/同位素、query、未定义的扩展 MOL 属性会明确拒绝。详见 [architecture](../docs/BUILDING_BLOCK_ARCHITECTURE.md)。
