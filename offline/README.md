# Oligo Toolkit 1.1.0

## Windows 离线启动 / Offline use

Download the release ZIP → extract the **whole ZIP** → double-click root **Start.html**.
下载 Release ZIP → 完整解压 → 双击根目录 **Start.html**，使用 Windows Edge 或 Chrome。
不需要 Python、pip、Node、npm、服务器、管理员权限或网络。不要直接在压缩包里运行，不要只复制 HTML。
源码仓库使用根目录 Start.html 或 offline/Start.html；原 Python 版本作为历史版本保留。

## 当前能力 / Capabilities

- Sequence：已支持的 DNA/RNA 与修饰符号、formula、average MW、exact mass、OD260 状态及参数；SVG/MOL/SDF/CDXML/JSON 下载。
- Post Modification：Reaction Notebook，Starting / Secondary / Product 独立 viewer，真实反应位点高亮和 1-based 原子编号，Preview / Apply / Export / Add Next，多步 checkpoint 历史。
- Excel Batch：本地 XLSX、Sheet / ID / Sequence 映射、逐行验证、共同 A 化学和 C 展示引擎，results.xlsx、structures.zip。错误行如实标记，不伪造结构。
- Custom Chemistry：MOL/SDF 导入、OH attachment selection、Save / Save & New、保存列表 View / Delete、同名更新、本地库 JSON 导出。
- Presentation：oligo bamboo 折列、small-molecule/linker 局部坐标、SMCC/cap 递归放置。普通滚轮滚页面；Ctrl+滚轮或 +/- 缩放；拖动平移，Fit / Expand / Fullscreen。
- 中文 / English；语言选择保存在本地。用户输入、名称和化学数据不翻译。固定深色侧栏、青绿主色与用户已批准的深蓝化学 Logo；无 Accent Color 选择器。

## Local / Private / Offline 边界

产品代码不上传序列、文件、自定义库或计算结果；依赖全部 vendored，本次 Edge/Chrome file:// 测试远程请求为 0。GitHub 下载需要联网，运行不需要。
Custom 库保存在浏览器 localStorage，受浏览器、路径、清理设置影响；搬目录、换电脑或换浏览器不会自动迁移。升级前导出库 JSON 并保留原目录；当前没有通用旧库 JSON 导入界面。
Workflow 为当前会话状态，可导出 checkpoint JSON；尚无恢复工作流的 UI。浏览器扩展、系统备份、同步和用户主动导出文件的行为不属于本应用控制范围。
Release 仅包含代码、本地依赖、已批准 Logo 与自建/公开 fixture，不含用户保存库或公司数据。

## Known Gaps

Biotin 等缺少可靠原子图的输入会被阻止；未知 OD 参数显示 PARTIAL / NEEDS_PARAMETER。OD 模型不包含折叠、盐、pH 效应。
很大或密集的自定义结构可能有碰撞并标记 REVIEW。MOL/SDF 保存完整原子图和坐标，但不能编码 SVG 的折线路由；外部编辑器可能显示跨列直线。
部分 Batch 控件保留英文文案。未承诺超大工作簿性能。
**原始 C7N 的同结构视觉回归按用户明确指示跳过，未宣称通过。** 自建 amino-diol + 真实 SMCC + cap 的独立回归通过。
Logo 使用用户确认的原图本地 PNG，保留所有化学标注与 O⁻；没有用自动重画改变图案。小尺寸下细节可读性受限，原图可用于较大展示。

## 验收与许可

见 docs/ACCEPTANCE_MATRIX.md、docs/CAPABILITY_BASELINE.json 和 THIRD_PARTY_NOTICES.md。
tests/ 是开发回归入口，需要开发环境；日常运行只用 Start.html。
