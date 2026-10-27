# Terminal chemistry audit — v0.6.0

Current support: [attachment matrix](ATTACHMENT_SUPPORT_MATRIX.md). The v0.5.2 sections below are historical; v0.6.0 supersedes their family restrictions.

基线：完整复制 v0.5.1 的 app、batch、custom_chemistry、docs、tests、vendor 和入口；没有启动 Conjugation engine。

## 发现与修复
- 旧 parser 先剥离末端 phosphate，再把末端 operator 当悬空 internal linkage。现以正式端点 token 匹配和 canonical AST 字段处理，无字符串替换。
- 旧 terminal assembler 写死 PO，独立 formula 也写死 HPO3；现 terminal 与 internal 使用同一 REFERENCE.links 磷中心片段，末端以真实 OH 补足第二 attachment。
- 特殊 modifier 的 distal attachment 不能靠 o3 fallback 猜测：现拒绝未经验证的末端 attachment。已导入的 Custom Chemistry 仍使用其明确的 5/3 O attachment。
- 多磷酸修饰位置不明确，语法能识别，但 chemistry validation 明确拒绝。

## 支持矩阵
| operator | 5′ | 3′ | 定义 |
|---|---|---|---|
| 无 | `(p)rA` | `rA(p)` | P(=O)(OH)2 |
| * | `(p)*rA` | `rA*(p)` | P(=S)(OH)2 |
| ** | `(p)**rA` | `rA**(p)` | P(=S)(SH)(OH) |
| ^ | `(p)^rA` | `rA^(p)` | P(=O)(Me)(OH) |
| ! | `(p)!rA` | `rA!(p)` | 既有 PN(dmi) 磷中心加 OH |
| # | `(p)#rA` | `rA#(p)` | 既有 P(=O)(NH-SO2-Me) 加 OH |

以上支持 DNA、RNA、2′OMe、2′F，单 residue、长链和双端；磷立体构型未指定，采用既有中性自由酸模型。这定义了软件结构语义，不表示已验证合成路线或溶液中质子化状态。

canonical 为 `(p)`、`(pp)`、`(ppp)`；`[p]` / `[pp]` / `[ppp]`、`[PHO]`、`[phosphorylation]` 映射到同一 AST；不区分这些 terminal token 的大小写。无修饰 PP/PPP 保留。canonical 从旧方括号输出改为圆括号。

## 验证
- 144 terminal cases：独立硬编码元素增量、Average MW / Exact Mass 差值、graph / component / direct formula 一致，5′ o5 和 3′ o3 实际 P–O 键检查，MOL 回读、CDXML 真实 P、SVG 与布局检测通过。
- RNA A：PO C10H14N5O7P，PS C10H14N5O6PS，PS2 C10H14N5O5PS2。PO→PS 每次 O→S，H/P 不变，Exact +15.97715655483，Average +16.061。
- 旧 regression 240/240；Sequence Chemistry Coverage 125/125。
- 7 条 internal / complex sequence 与 v0.5.1 的 chemistry 和 graph 精确相等，包括五种 internal operators。
- Batch 145 行：144 正确 + 1 错误，576 个 SVG/MOL/SDF/CDXML 文件，错误行不影响其他行；全部 formula 与 Single 相等。
- Edge file:// 实际 Single UI 计算、12 个 browser Single/Batch 对照通过，无页面错误。人工查看 12 格结构图，糖/碱基/末端标签无明显碰撞；图片见 tests/output/terminal-contact-sheet.png。
- 测试详单：tests/evidence/TERMINAL_QA.json、TERMINAL_BROWSER_QA.json；新增脚本在 tests/regression/。

## 明确不支持
- 修饰 `(pp)` / `(ppp)`：未指明修饰磷中心。
- 与 C6N / C3N、spacer、dye、GalNAc、倒置或其他未验证结构直接相邻的 terminal phosphate；错误为 CHEMISTRY_UNSUPPORTED。
- PMO、TNA、GNA 等非标准 terminal topology 本版没有扩展。
- 悬空/连续 operator、无 residue、内部 phosphate token、空 token 均报错。没有新增反应或 Conjugation assembly。

## v0.6.0 attachment-driven terminal phosphorus

MOE and all 84 declared standard monomers now share the same attachment-driven engine for PO, PS (*), PS2 (**), Me-P (^), PN(DMI) (!), MsPA (#), at both termini. Examples: (p)*eA, (p)*eCMe, (p)*eG, eA*(p). [p] resolves to the same canonical notation/AST chemistry as (p). 2′ sugar modifications do not select terminal rules.

The monomer declares 5_prime_attachment / 3_prime_attachment with an atom index, atom role, element, standard compatibility and supported terminal/internal chemistries. Runtime validates a real neutral alcohol OH before creating its P bond. Custom import produces the same contracts after attachment validation. Internal standard attachments validate these contracts too. Syntax errors use SYNTAX_ERROR; undefined attachments use CHEMISTRY_UNSUPPORTED; Batch isolates failed rows.

See [generated support matrix](ATTACHMENT_SUPPORT_MATRIX.md), [architecture](ATTACHMENT_ARCHITECTURE.md), and tests/evidence/ATTACHMENT_MATRIX.json. Canonical phosphorus geometry is reused unchanged. CDXML retains its existing Experimental status.
