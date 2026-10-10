# 拧紧数据自动导出与解析平台

面向 Windows 内网部署的质量数据工作台。支持 Excel/CSV 导入、SQLite 去重入库、明细查询、趋势监控、过程能力计算，以及 OA → Power BI 自动/半自动导出。

## 快速启动

1. 双击 `run.bat`，首次运行会安装 Python 与前端依赖。
2. 浏览器打开 <http://127.0.0.1:8000>。
3. 可直接使用首页的“载入演示数据”，或上传包含标准 12 列的 `.xlsx/.csv`。

开发模式：

```powershell
py -3.11 -m venv .venv
.venv\Scripts\pip install -r requirements.txt
cd frontend
npm install
npm run dev
```

另开终端运行 `.venv\Scripts\python -m backend.main`。Vite 会将 `/api` 代理到 8000 端口。

## 自动导出

复制 `.env.example` 为 `.env` 并只在本机填写账号密码。首次建议半自动模式：

```powershell
.venv\Scripts\python -m automation.exporter --mode semi-auto
```

全自动模式：

```powershell
.venv\Scripts\python -m automation.exporter --mode auto
```

<!-- CHANGE [2026-09-11 10:23 +08:00] [WH400]: 说明按工位拆分策略及配置入口，避免用户再次执行会被静默截断的全量导出。 -->
脚本启用自签名证书忽略、持久化浏览器会话、失败重试、关键步骤截图、T-1 日期与下载非空校验。默认根据 `.env` 的 `EXPORT_STATIONS` 按工位逐批导出，每个文件名包含工位号，并校验文件仅含目标工位且未达到 Power BI 的 15 万行上限。可按实际工位增删逗号分隔的工位号。Power BI 画布会因报表版本变化而改变，首次进入真实内网后请在 `automation/exporter.py` 的定位器清单处校准。

可用 Windows 任务计划程序每日调用上述命令。建议工作目录设置为本项目目录，执行时间与 `.env` 中 `SCHEDULE_TIME` 保持一致。

## 数据口径

- 唯一键：`ESN + ResultTime + 螺栓`；缺少螺栓时回退为工位/程序组合。
- Cpk：移动极差估计组内标准差；Ppk：样本标准差。
- UCL/LCL：均值 ± `2.66 × MR̄`。
- 当前实现按标准统计公式计算，需与 Power BI 报表作者最终核对。

## 安全说明

真实账号、密码、会话文件和下载数据均被 `.gitignore` 排除；日志不会输出密码。
