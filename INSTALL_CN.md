# 安装与升级

本版适用于 Windows x64、Python 3.13 x64。ZIP 包含应用源码和启动脚本；不包含
Python、虚拟环境或第三方安装包。请先使用获准的方式安装 Python。

解压到新的可写目录，双击 `install_dependencies.bat` 安装锁定依赖，再双击
`Start_Oligo_Toolkit.bat`。应用仅监听 `127.0.0.1:8501`；关闭命令窗口即可停止。
启动脚本不自动升级依赖，Streamlit 使用统计已关闭。

安装脚本遵循 pip 配置及 PIP_INDEX_URL。受限网络请使用所在单位批准的软件源，
不要把镜像凭据写进项目文件。Python 不在 PATH 时，可先在命令窗口设置
PYTHON_EXE 为已安装的 Python 路径，再运行安装脚本。

如需离线安装，在允许下载依赖的 Windows/Python 3.13 x64 电脑运行
`download_wheels.bat`，通过获准渠道转移完整 wheelhouse 文件夹，然后运行
`install_dependencies.bat offline`。第三方原始 wheel 的许可证及 NOTICE 应保持完整。
公开 Release 本身不附带 wheelhouse。

公共 Releases 页面及附件允许匿名下载；所在网络仍需允许 GitHub 及附件下载域名。
下载不需要在公司电脑登录个人 GitHub 或邮箱。

升级前备份旧目录的 `user_data` 文件夹。新版本解压到新目录，安装完成后复制你自己的
user_data，再启动。公开包不预置任何个人自定义单体。不要把该文件夹上传到公开仓库。
