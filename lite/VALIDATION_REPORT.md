# v0.2.1 验收报告

日期：2026-10-23。结果：85/85 引擎回归、5/5 界面事件模拟通过。

## 范围与方法

实际运行打包中的 JavaScript 引擎与 regression-tests.js；UI 检查执行真实 app.js 事件处理器，使用模拟 DOM/localStorage。没有把模拟检查写作真实浏览器验收。Edge/Chrome 未暴露给 UI 工具；内置浏览器禁止 file://，未绕过。真实 Windows 浏览器视觉/文件选择/下载手势及 localStorage 跨真实进程重启验收未执行。

覆盖已有 golden 序列（RNA、DNA、2′F、2′OMe、MOE、PO/PS/PS2/MsPA、mixed）、bamboo 24-mer 两处换列、历史 rArA、通用 custom [ID] 两端/内部/多个/混合端基、旧 {ID}、unknown ID、非法语法、ChemDraw isotope 与 alias 标记、缺失/歧义标记 fallback、SDF 首 molecule、SMILES 拒绝未支持语法。

## Terminal graph validation

5′/3′ × mono/di/triphosphate 全六种均通过：正确原始 attachment O、每 P 一个 P=O 与三个 P–O、每条多磷酸链 n−1 个 P–O–P 桥、P 五价与 O 二价、整体连通、neutral H 计数、MOL 导出再导入分子式。

以 rArA 为基准，每个末端 phosphate 增加 HPO3，exact mass 增加 79.96633088936 Da。P/PP/PPP 分别为 C20H26N10O13P2 / C20H27N10O16P3 / C20H28N10O19P4，exact mass 为 676.115604934 / 756.081935823 / 836.048266712 Da；两端结果相同。不是仅 parser 接受。双端组合也通过组装/导出检查。验证限于中性模型、组成、拓扑与价态，未使用外部化学软件独立重读新版端基或实验验证。

历史 rArA = C20H25N10O10P，exact mass 596.149274044 Da，通过。

## Custom end-to-end

自动：MOL 识别真实 O → 移除 marker → 简洁确认 → 保存 localStorage → 新 UI 上下文恢复 → rA[PEG4]*eC 计算为 C24H36N8O15P2S，通过。

手动：OCCO 导入 → fallback 展开 → 指定两个 O → 保存 → [ManualPEG]rA 真实组装，通过。引擎和处理器链路贯通；真实 SVG 鼠标命中和浏览器持久化仍待人工浏览器验收。

## 导出与限制

SVG/CDXML 生成与 atom/bond counts、MOL/SDF 分子式往返通过；原始参考模板未修改。CDXML 实际 ChemDraw 打开未经验证，仍为 Experimental。MsPA 原有互变异构模型、受限 SMILES、60 单元、V2000 999 atom/bond 上限、custom OD 不支持、LNA/UNA/盐等限制保留。

程序仅包含本地静态资源，无外部 URL 脚本、fetch、网络导入、服务器、Excel 或 npm 运行依赖。
