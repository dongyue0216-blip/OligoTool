# v0.8.0 — semantic assembly architecture

从直接解析结果组装迁移为五对象模型与独立 AssemblyGraph；新增完整 atom/bond provenance、v3 BuildingBlock、正式 linkage definitions、v2 Master Library 与迁移报告。修正单物理位点复制和 VP 伪位点，取消 artificial terminal-only 分类。新增 semantic round-trip / orientation / invalid contract regression。

旧序列 notation 保持兼容。错误接口升级到 oligo-lite/2；不兼容的 site/linkage 返回 CHEMISTRY_UNSUPPORTED。旧 terminal-only position guard 的错误码由 INVALID_POSITION 改为 CHEMISTRY_UNSUPPORTED；InvAb 两个位点真实兼容时允许内部连接。

尚未实现的化学不因此扩大。未进行 GitHub push/tag/release。
