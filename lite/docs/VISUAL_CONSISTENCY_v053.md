# Structure Visual Consistency / Aesthetic QA — v0.5.3

基线：工作区最新 v0.5.2（含 terminal PO/PS/PS2/Me-P/PN(DMI)/MsPA、Batch、coverage 和目录整理）。本次仅改变 depiction/layout；没有启动 Conjugation engine。

## 根因与修复

1. `assemble` internal linkage 原来把 PO/PS/PS2/Me-P 的非桥接原子重新放在 P 左右，而 terminal 分支直接平移 `REFERENCE.links` 的原始坐标。原始 PO/PS/PS2 坐标各自有不同斜向，因此同类结构末端/内部不一致。
2. PN(DMI)/PMO 和 MsPA 的规整逻辑只在 internal 分支生效。现在这些分支全部收进唯一 `phosphorusGeometry(code,x,y)`，两端与内部调用同一个函数。保留复杂侧链原有拓扑，禁止添加显示用假原子或键。
3. SVG 原来把整个 OH/SH/NH 字串居中，元素本身偏离键端。现在元素 tspan 独立以原子 x 居中，H 作为右侧后缀；碰撞检测的标签框也随之调整。
4. 末端原有轴向 attachment=3.0，distal OH=1.8，上下不平衡。尝试全部缩短到 1.8 时，2′OMe 案例出现真实碰撞，因此固定两侧轴向长度为 3.0；多磷酸 P 间距 6.0。此为示意图留白单位，不代表真实键长。

## 局部规范

- P 作为局部原点；主链/末端 OH 沿纵轴，非桥接侧基沿横轴，保持固定正交示意投影，未改变糖环和碱基几何。
- PO/PS/PS2/Me-P：双键侧基 (-1.7,0)，单键侧基 (+1.7,0)。PS2 对应 S/S；Me-P 单键侧为真实甲基 C。
- PN(DMI)/PMO：P=O (+1.7,0)，P–N (-1.5,0)，复杂侧链按原模板刚体旋转到固定方向。
- MsPA：P=O (+1.7,0)，N (-1.7,0)，S (-3.2,0)，两个 sulfonyl O (-3.2,±1.45)，Me (-5.05,0)。不要求化学不对称侧链的整体 bbox 左右对称。
- 5′/3′ 不再自由旋转侧基；仅纵向 attachment 的正负方向受控。末端局部 P 到上下 O 距离均为 3.0。
- 双键始终关于原子间轴线对称，两条线偏移 ±0.08；元素中心与轴线端点共享相同坐标。白色描边给字形留白。

## 自动与浏览器验证

- 72 个完整并排案例：RNA rA、DNA dA、2′OMe mG、2′F fU × 六类 motif × 5′/3′/internal；另加 200-mer、CMe、I、GalNAc 与两端多磷酸，共 78 例。
- 同 motif 局部相对坐标容差 1e-8；观测 bond-length/angle variance 为 0。terminal 纵轴上下对称误差 0。检查异常长键、原子/标签/键碰撞和跨列 connector 碰撞均通过。
- 与 v0.5.2 比较 formula/MW、所有原子化学属性与完整键拓扑相同；MOL 回读 formula 一致，CDXML 生成通过；确定性 SVG 重算一致。
- terminal 专项 144 例通过，15 例非法输入正确拒绝；既有回归 240/240 + 125/125；Batch 专项 145 行、576 个结构文件，visual Batch 72 行、288 文件。
- Microsoft Edge 实际 file:// 渲染 72 张 SVG；元素字形 bounding box 横向中心最大偏移 0.025452（容差 0.04，约 0.6 px@23px/unit，含字体度量误差）。不是只检查 text 属性。
- 人工查看 gallery-top、gallery-ps2、gallery-complex 截图：PO/PS/PS2 两端与内部排列一致，O/S 及双键居中；MsPA 和 PN(DMI) 两端的侧链方向一致。查看 200-mer 应用截图，bamboo 与跨列 connector 保留。
- 可打开 `tests/visual/gallery.html` 做肉眼回归。截图、当前数值证据分别在 tests/visual 与 tests/evidence/VISUAL_*；此前版本证据保留为历史记录。

## 保留的视觉限制

- 内部主链 O–P attachment 距离由核苷模板与竹节间距决定，并非所有真实主链键都等长；本次冻结的是磷侧基局部几何与末端几何。长链跨列线仍是 display routing。
- MOL/SDF/CDXML 复用规整原子坐标，真实 graph 不变；这些格式仍不保存 SVG 跨列折线路径，外部软件可能需要重新排版。
- 采用清晰的正交磷中心示意投影；尚未提供 ChemDraw 风格选择器或磷立体构型楔线。
- 元素中心修复覆盖 SVG；CDXML 的最终字体度量取决于打开它的软件。任意 custom monomer 仍需单独视觉检查。

## 重跑

`node tests/regression/visual.cjs` 和 `node tests/regression/terminal.cjs`。基线 engine 已置于 tests/fixtures/baseline-v052，不需要相邻旧版目录。浏览器脚本 tests/regression/visual-browser.cjs 需要 Playwright 与 Edge；其依赖路径须按本机安装调整。
