"""CHANGE [2026-09-09 15:18 +08:00] [WH400]: 提供平台 HTTP API、前端静态托管与一键本地启动入口。"""

from __future__ import annotations

import io
import smtplib
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .alerts import check_torque_alerts, check_torque_alerts_safely, get_email_alert_config, save_email_alert_config, send_test_email
from .database import initialize_database
from .services import capability_data, dashboard_summary, demo_frame, export_records, import_records, list_records, trend_data

ROOT = Path(__file__).resolve().parents[1]


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 使用 FastAPI 生命周期初始化数据库，避免弃用事件接口产生启动警告。
@asynccontextmanager
async def lifespan(_: FastAPI):
    initialize_database()
    yield


app = FastAPI(title="拧紧数据自动导出与解析平台", version="1.0.0", lifespan=lifespan)


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 导入成功后在后台检查 ±3σ 越界，邮件故障不阻塞或回滚已完成的数据导入。
@app.post("/api/import")
async def upload_data(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    try:
        result = import_records(file.filename or "upload.xlsx", await file.read())
        background_tasks.add_task(check_torque_alerts_safely)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 演示数据导入也走同一后台检测入口，保证配置测试与真实导入口径一致。
@app.post("/api/demo")
def load_demo_data(background_tasks: BackgroundTasks):
    buffer = io.BytesIO()
    demo_frame().to_excel(buffer, index=False, engine="openpyxl")
    result = import_records("脱敏演示数据.xlsx", buffer.getvalue())
    background_tasks.add_task(check_torque_alerts_safely)
    return result


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 用受约束模型接收邮件配置，防止无效端口或安全模式写入本机数据库。
class EmailAlertConfigPayload(BaseModel):
    enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = Field(default=587, ge=1, le=65535)
    security: Literal["starttls", "ssl", "none"] = "starttls"
    username: str = ""
    password: str = ""
    sender: str = ""
    recipients: str = ""
    subject_prefix: str = "[拧紧数据告警]"
    station: str = ""
    program: str = ""
    result_status: str = "Result was OK"


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 提供邮件配置读取与保存接口，响应只返回密码是否已配置。
@app.get("/api/alert-config")
def read_alert_config():
    return get_email_alert_config()


@app.put("/api/alert-config")
def update_alert_config(payload: EmailAlertConfigPayload):
    try:
        return save_email_alert_config(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 测试邮件和手动检测接口让管理员可在配置页完成端到端验收。
@app.post("/api/alert-config/test")
def test_alert_email():
    try:
        return send_test_email()
    except (ValueError, OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=400, detail=f"测试邮件发送失败：{exc}") from exc


@app.post("/api/alert-config/check")
def run_alert_check():
    try:
        return check_torque_alerts(force=True)
    except (ValueError, OSError, smtplib.SMTPException) as exc:
        raise HTTPException(status_code=400, detail=f"告警检测失败：{exc}") from exc


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 统一解析列表、趋势与能力页面的查询参数，保证筛选联动口径一致。
def _params(station: str | None, program: str | None, esn: str | None, status: str | None,
            start: str | None, end: str | None) -> dict:
    return {"station": station, "program": program, "esn": esn, "status": status, "start": start, "end": end}


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 首页接口一次返回 KPI、任务与活动，减少首屏往返。
@app.get("/api/dashboard")
def dashboard():
    return dashboard_summary()


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 明细接口接受筛选、分页与白名单排序参数。
@app.get("/api/records")
def records(station: str | None = None, program: str | None = None, esn: str | None = None,
            status: str | None = None, start: str | None = None, end: str | None = None,
            page: int = 1, size: int = 20, sort: str = "result_time", order: str = "desc"):
    params = _params(station, program, esn, status, start, end) | {"page": page, "size": size, "sort": sort, "order": order}
    return list_records(params)


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 趋势接口复用统一筛选并返回日聚合序列。
@app.get("/api/trends")
def trends(station: str | None = None, program: str | None = None, esn: str | None = None,
           status: str | None = None, start: str | None = None, end: str | None = None):
    return trend_data(_params(station, program, esn, status, start, end))


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 能力接口返回标准公式指标、直方图与控制图数据。
@app.get("/api/capability")
def capability(station: str | None = None, program: str | None = None, esn: str | None = None,
               status: str | None = None, start: str | None = None, end: str | None = None):
    return capability_data(_params(station, program, esn, status, start, end))


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 导出当前筛选结果为 Excel，复用明细查询的安全筛选与排序逻辑。
@app.get("/api/export")
def export_filtered(station: str | None = None, program: str | None = None, esn: str | None = None,
                    status: str | None = None, start: str | None = None, end: str | None = None):
    frame = export_records(_params(station, program, esn, status, start, end))
    buffer = io.BytesIO()
    frame.to_excel(buffer, index=False, engine="openpyxl")
    return Response(buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": "attachment; filename=tightening_filtered.xlsx"})


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 构建后的 React 应用由同一 FastAPI 进程托管，便于内网一键运行。
FRONTEND_DIST = ROOT / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=False)
