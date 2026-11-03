# Oligo Toolkit 2.0.0

解压后双击 Start.html，用 Windows Edge 或 Chrome 打开。无需安装、服务器或网络。

升级规则：升级前 Export User Library JSON；保留备份；在新版 Import/Merge User Library。Built-in Library 只读，永不被用户导入覆盖。数据保存在当前浏览器中，跨文件夹/浏览器请使用 JSON 备份。

Compatibility begins with this release: `oligo-user-chemistry-library`, `schemaVersion: 1`. Pre-release legacy Custom Chemistry data is not guaranteed compatible and is not automatically migrated. Old browser keys are left untouched. Future releases must accept this baseline or use explicit forward version migrations; unknown newer schemas are rejected without changing the library.

See tests/RELEASE_TEST_REPORT.md for tested scope and known gaps.
