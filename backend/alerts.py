"""CHANGE [2026-10-10 13:20 +08:00] [WH400]: 提供每日扭矩均值 ±3σ 邮件告警、配置持久化和重复发送抑制。"""

from __future__ import annotations

import hashlib
import smtplib
import statistics
from datetime import datetime
from email.message import EmailMessage
from typing import Any

from .database import get_connection
from .services import trend_data


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 统一读取单例配置并隐藏 SMTP 密码，避免配置接口泄露凭据。
def get_email_alert_config() -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM email_alert_config WHERE id = 1").fetchone()
        last_event = connection.execute(
            "SELECT event_date, direction, torque_average, sent_at FROM email_alert_events ORDER BY id DESC LIMIT 1"
        ).fetchone()
    config = dict(row) if row else {}
    password = config.pop("password", "")
    config["enabled"] = bool(config.get("enabled"))
    config["passwordConfigured"] = bool(password)
    config["lastEvent"] = dict(last_event) if last_event else None
    return config


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 保存页面配置时允许密码留空沿用原值，并限制安全模式和端口范围。
def save_email_alert_config(payload: dict[str, Any]) -> dict[str, Any]:
    security = str(payload.get("security", "starttls")).lower()
    if security not in {"starttls", "ssl", "none"}:
        raise ValueError("SMTP 安全模式只能是 STARTTLS、SSL/TLS 或无加密")
    port = int(payload.get("smtp_port", 587))
    if not 1 <= port <= 65535:
        raise ValueError("SMTP 端口必须在 1 到 65535 之间")
    recipients = _parse_recipients(str(payload.get("recipients", "")))
    # CHANGE [2026-10-10 13:20 +08:00] [WH400]: 启用前一次性校验发送所需字段，避免导入后才发现告警无法投递。
    if payload.get("enabled"):
        missing = []
        if not str(payload.get("smtp_host", "")).strip():
            missing.append("SMTP 服务器")
        if not str(payload.get("sender", "")).strip():
            missing.append("发件邮箱")
        if not recipients:
            missing.append("收件邮箱")
        if missing:
            raise ValueError(f"启用邮件告警前请配置：{'、'.join(missing)}")
    with get_connection() as connection:
        current = connection.execute("SELECT password FROM email_alert_config WHERE id = 1").fetchone()
        password = str(payload.get("password") or (current["password"] if current else ""))
        connection.execute(
            """UPDATE email_alert_config SET enabled=?, smtp_host=?, smtp_port=?, security=?, username=?,
            password=?, sender=?, recipients=?, subject_prefix=?, station=?, program=?, result_status=?,
            updated_at=?, last_error=NULL WHERE id=1""",
            (
                int(bool(payload.get("enabled"))), str(payload.get("smtp_host", "")).strip(), port, security,
                str(payload.get("username", "")).strip(), password, str(payload.get("sender", "")).strip(),
                ",".join(recipients), str(payload.get("subject_prefix", "[拧紧数据告警]")).strip(),
                str(payload.get("station", "")).strip(), str(payload.get("program", "")).strip(),
                str(payload.get("result_status", "Result was OK")).strip(), datetime.now().isoformat(timespec="seconds"),
            ),
        )
    return get_email_alert_config()


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 抽取与前端图表一致的样本标准差算法，确保邮件阈值和黄色控制线口径一致。
def calculate_torque_control(data: list[dict[str, Any]]) -> dict[str, Any]:
    points = [
        {"date": str(item["date"]), "value": float(item["torque_avg"])}
        for item in data if item.get("torque_avg") is not None
    ]
    if len(points) < 2:
        return {"count": len(points), "mean": None, "sigma": None, "upper": None, "lower": None, "breaches": []}
    values = [point["value"] for point in points]
    mean = statistics.fmean(values)
    sigma = statistics.stdev(values)
    upper, lower = mean + 3 * sigma, mean - 3 * sigma
    breaches = [
        {**point, "direction": "upper" if point["value"] > upper else "lower"}
        for point in points if point["value"] > upper or point["value"] < lower
    ]
    return {"count": len(points), "mean": mean, "sigma": sigma, "upper": upper, "lower": lower, "breaches": breaches}


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 对当前监控范围执行越界检查并把未发送过的日期合并为一封邮件，防止重复提醒。
def check_torque_alerts(force: bool = False) -> dict[str, Any]:
    config = _private_config()
    if not config.get("enabled") and not force:
        return {"status": "disabled", "checked": 0, "breaches": 0, "sent": 0}
    checked_at = datetime.now().isoformat(timespec="seconds")
    params = {
        "station": config.get("station") or None,
        "program": config.get("program") or None,
        "esn": None,
        "status": config.get("result_status") or None,
        "start": None,
        "end": None,
    }
    stats = calculate_torque_control(trend_data(params))
    scope = _scope_text(config)
    pending: list[dict[str, Any]] = []
    with get_connection() as connection:
        for breach in stats["breaches"]:
            event_key = hashlib.sha256(
                f"{scope}|{breach['date']}|{breach['direction']}".encode("utf-8")
            ).hexdigest()
            exists = connection.execute(
                "SELECT 1 FROM email_alert_events WHERE event_key=?", (event_key,)
            ).fetchone()
            if not exists:
                pending.append({**breach, "event_key": event_key})
        connection.execute(
            "UPDATE email_alert_config SET last_checked_at=?, last_error=NULL WHERE id=1", (checked_at,)
        )
    if not pending:
        return {"status": "ok", "checked": stats["count"], "breaches": len(stats["breaches"]), "sent": 0,
                "upper": stats["upper"], "lower": stats["lower"]}
    try:
        _send_breach_email(config, stats, pending, scope)
        sent_at = datetime.now().isoformat(timespec="seconds")
        with get_connection() as connection:
            for breach in pending:
                connection.execute(
                    """INSERT OR IGNORE INTO email_alert_events
                    (event_key,event_date,direction,torque_average,upper_control,lower_control,mean,sigma,scope,recipients,sent_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                    (breach["event_key"], breach["date"], breach["direction"], breach["value"], stats["upper"],
                     stats["lower"], stats["mean"], stats["sigma"], scope, config["recipients"], sent_at),
                )
            connection.execute(
                "UPDATE email_alert_config SET last_sent_at=?, last_error=NULL WHERE id=1", (sent_at,)
            )
        return {"status": "sent", "checked": stats["count"], "breaches": len(stats["breaches"]),
                "sent": len(pending), "upper": stats["upper"], "lower": stats["lower"]}
    except Exception as exc:
        with get_connection() as connection:
            connection.execute(
                "UPDATE email_alert_config SET last_error=? WHERE id=1", (str(exc)[:1000],)
            )
        raise


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 导入后的后台检查吞掉邮件服务异常，确保 SMTP 故障不回滚已成功导入的数据。
def check_torque_alerts_safely() -> None:
    try:
        check_torque_alerts()
    except Exception:
        return


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 提供独立测试邮件，保存配置前后都可验证 SMTP 连通性而不产生告警记录。
def send_test_email() -> dict[str, Any]:
    config = _private_config()
    _validate_mail_config(config)
    message = EmailMessage()
    message["Subject"] = f"{config['subject_prefix']} SMTP 配置测试"
    message["From"] = config["sender"]
    message["To"] = ", ".join(_parse_recipients(config["recipients"]))
    message.set_content("这是一封来自拧紧数据解析平台的测试邮件。收到此邮件表示 SMTP 配置可用。")
    _send_message(config, message)
    return {"status": "sent", "recipients": _parse_recipients(config["recipients"])}


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 读取含密码的内部配置仅供 SMTP 发送流程使用，不暴露给 HTTP 响应。
def _private_config() -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM email_alert_config WHERE id=1").fetchone()
    if not row:
        raise ValueError("邮件告警配置尚未初始化")
    return dict(row)


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 兼容逗号、分号和换行分隔的多个收件人并去除重复地址。
def _parse_recipients(value: str) -> list[str]:
    normalized = value.replace("；", ";").replace("，", ",").replace("\n", ",").replace(";", ",")
    return list(dict.fromkeys(item.strip() for item in normalized.split(",") if item.strip()))


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 在连接邮件服务器前集中校验必填项，返回可理解的配置错误。
def _validate_mail_config(config: dict[str, Any]) -> None:
    missing = []
    if not config.get("smtp_host"):
        missing.append("SMTP 服务器")
    if not config.get("sender"):
        missing.append("发件邮箱")
    if not _parse_recipients(str(config.get("recipients", ""))):
        missing.append("收件邮箱")
    if missing:
        raise ValueError(f"请先配置：{'、'.join(missing)}")


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 邮件正文同时列出越界值和控制限，便于质量人员无需登录平台即可判断方向与幅度。
def _send_breach_email(config: dict[str, Any], stats: dict[str, Any], pending: list[dict[str, Any]], scope: str) -> None:
    _validate_mail_config(config)
    message = EmailMessage()
    message["Subject"] = f"{config['subject_prefix']} 每日扭矩平均值超出 ±3σ 控制线"
    message["From"] = config["sender"]
    message["To"] = ", ".join(_parse_recipients(config["recipients"]))
    lines = [
        "拧紧数据解析平台检测到每日扭矩平均值超出黄色 ±3σ 控制线。", "", f"监控范围：{scope}",
        f"中心均值：{stats['mean']:.3f} Nm", f"+3σ 上限：{stats['upper']:.3f} Nm",
        f"-3σ 下限：{stats['lower']:.3f} Nm", "", "越界明细：",
    ]
    for item in pending:
        direction = "超过上控制线" if item["direction"] == "upper" else "低于下控制线"
        lines.append(f"- {item['date']}：{item['value']:.3f} Nm（{direction}）")
    lines.extend(["", "请登录解析平台的“拧紧趋势监控”页面查看详细趋势。"])
    message.set_content("\n".join(lines))
    _send_message(config, message)


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 按配置选择 SSL、STARTTLS 或内网明文 SMTP，并仅在填写用户名时执行鉴权。
def _send_message(config: dict[str, Any], message: EmailMessage) -> None:
    host, port, security = config["smtp_host"], int(config["smtp_port"]), config["security"]
    client_class = smtplib.SMTP_SSL if security == "ssl" else smtplib.SMTP
    with client_class(host, port, timeout=20) as client:
        if security == "starttls":
            client.starttls()
        if config.get("username"):
            client.login(config["username"], config.get("password", ""))
        client.send_message(message)


# CHANGE [2026-10-10 13:20 +08:00] [WH400]: 生成稳定且可读的监控范围文本，同时作为重复告警键的一部分。
def _scope_text(config: dict[str, Any]) -> str:
    return " / ".join((
        f"工位 {config.get('station') or '全部'}",
        f"程序 {config.get('program') or '全部'}",
        f"状态 {config.get('result_status') or '全部'}",
    ))
