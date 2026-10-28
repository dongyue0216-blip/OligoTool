# Support / compatibility matrix v0.8.0

| 实际 registry | Graph/interface | Internal | Terminal phosphorus |
|---|---|---|---|
| DNA 6；RNA/OMe/F/MOE/LNA/FANA/NMA/UNA/C16/C22/ENA 各 7，加 Benner Z 共84 | 统一 v3 | PO/PS/PS2/Me-P/PN(DMI)/MsPA | 同六种，受实际 site 存在约束 |
| MOE eA/eCMe/eG/eT/eI | 同上 | 六种对称覆盖 | 两端六种覆盖 |
| TNA 5 | 真实 O3/O2 sites | 同域六种 | 尚无可靠合同，拒绝 |
| GNA 4 | 真实 O3/O2 sites | 同域六种 | 尚无可靠合同，拒绝 |
| PMO 5 | 真实 N/O sites | 专属 PMO | 尚未定义，拒绝 |
| Benner Z | 对应实际 registry graph | 随其 sites | 随其 sites |
| VP 8 | 已有 terminal VP graph + 一个真实 OH site | 仅可用端点连接 | 不另接 terminal phosphorus |
| C3N/C6N、FAM/NAG37 | 一个物理 OH | 自然 terminal-only | 按已有 site 合同，未声明则拒绝 |
| InvAb / spacers / 其他已实现 modifiers | 按实际 sites | 两个兼容 sites 可内部使用 | 按已有合同 |
| Custom 一个 OH | 同一核心 | 仅正确方向末端 | 六种 |
| Custom 两个 OH，任意伯/仲组合 | 同一核心 | 六种 | 六种 |
| cEt / Biotin / C7N / 其他无图对象 | 无可靠图 | CHEMISTRY_UNSUPPORTED | CHEMISTRY_UNSUPPORTED |

PP/PPP 只定义 PO。terminal PS/PS2 是明确的单磷终止路径，不能据此推测混合硫代 PP/PPP。已知失败在输出 JSON 和 Batch 行中带原因，不返回假结构。
