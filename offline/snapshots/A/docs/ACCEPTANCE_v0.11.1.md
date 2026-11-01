# Track A · v0.11.1 验收报告

日期：2026-11-01（Asia/Shanghai）

基线：Production v0.11.0。未接入 Track B UI prototype 或 Track C Presentation prototype；未发布 GitHub。已有 chemistry.js、core.js、绘图与 reaction apply 实现保持原样；仅更改 workflow checkpoint 层、reaction-ui.js 和 schema。

## 验收结论

**通过：24 个既有 CJS 回归套件 + 2 个新增 checkpoint 套件，共 26/26。**

| 项目 | 结果 |
|---|---|
| 1-step、2-step、3-step 实际操作 | 通过；包含两种不同的两步链 |
| 三步纵向卡片，每步各自 Starting / Secondary / Product 三栏 | 通过 |
| 每步展开、折叠；最后 Applied 展开，Add Next 后历史折叠 | 通过 |
| 每步独立 Results：formula、MW、exact mass、ε260/status、nmol/OD、µg/OD、optical method/status | 通过；结构和质量指标从该步 Product Graph 派生 |
| 每步 MOL / SDF / CDXML / SVG / JSON / Report | 通过；三步共 18 次独立导出 |
| Step N Product = Step N+1 Starting Graph | 通过，完整对象比较 |
| 导出中间步骤不改变 workflow | 通过，导出前后持久化 workflow 相同 |
| 下一步修改导致 Preview 失效时，历史仍可导出 | 通过 |
| 本地刷新恢复完整三步历史 | 通过 |
| JSON replay / schema / provenance / step_index / APPLIED status | 通过 |
| Applied checkpoint 深度冻结 | 通过；修改嵌套原子被拒绝 |
| Revert to Product / Revert before Step | 已实现；明确删除后续步骤或本步及后续步骤；含回到 Step 1 之前 |
| Existing chemistry regression | 全部通过；独立 RDKit 校验 12 个旧反应产物、7 个下载产物、15 个 reagent 产物 |
| 批量计算与导出 | 382/382 检查通过，含 100/500/1000 行 |

## 三步工作流证据

Amine + SMCC → Maleimide-bearing product + azidothiol → CuAAC + alkyne。各步均有独立结构、结果和导出。

![三步纵向工作流](../tests/evidence/checkpoints.png)

## 数据和交互语义

Apply Modification 仅提交当前步骤；Export 仅导出选定 checkpoint；Add Next Modification 从最新产物创建下一步草稿。不存在不可逆 Final 状态，也没有固定步数限制。

Checkpoint 保存两个输入图、reagent 来源、definition id 与 rule version、selected sites、output、derived properties、graph provenance 中的 atom/bond mapping 与 edits，以及 step index/status。导出的中间 JSON 是截至该步的完整可重放 workflow，可加载后继续。支持旧 workflow/1 JSON 自动补充 step index/status。

刷新使用本地 localStorage，导出的 JSON 仍是可移植的显式保存方式。本地浏览器若禁止存储，状态栏会提示使用 JSON 保存。Branch 本轮未实现；通过 Revert 明确截断后续步骤。

ε260 的既有 ESTIMATED / NEEDS_PARAMETER 语义保持原样；不支持的光学计算显示状态，不伪造可用数值。此轮只做语义必需 UI，未优化结构坐标。

## 回归记录

详见 tests/evidence/v0111-results.json、checkpoint-acceptance.json、integrity-changes.json，以及既有 reaction / postmod / reagent evidence。

旧浏览器用例将“Apply 后在复用工作区查看历史”的定位改为卡片导出和显式 Add Next，保留原化学与导出断言。批量套件首次唯一失败为旧哈希指纹；审核后只更新 reactions.js、reaction-ui.js、reaction.schema.json 三项，重跑全部 382 检查通过。浏览器在受限运行环境首次未能启动，随后在获准的本地浏览器环境运行通过。

## 使用

解压 ZIP，双击根目录 Start.html。运行完全本地离线。测试依赖仅供开发者使用。
