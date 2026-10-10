"""CHANGE [2026-09-10 09:15 +08:00] [WH400]: 兼容 Power BI 聚合字段表头，让正常汇总明细文件可被平台直接导入。"""

from __future__ import annotations

import hashlib
import io
import math
import re
import statistics
import uuid
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from .database import get_connection

COLUMN_MAP = {
    "电枪工位": "station", "程序名称": "program", "ESN": "esn",
    "扭矩上限": "torque_upper", "扭矩下限": "torque_lower", "最终扭矩": "final_torque",
    "角度上限": "angle_upper", "角度下限": "angle_lower", "最终角度": "final_angle",
    "结果状态": "result_status", "ResultTime": "result_time", "螺栓": "bolt",
}
NUMERIC_COLUMNS = ["torque_upper", "torque_lower", "final_torque", "angle_upper", "angle_lower", "final_angle"]


# CHANGE [2026-09-09 17:14 +08:00] [WH400]: 保留原始行以自动识别 Power BI 导出中可能前移的真实表头，并兼容 CSV 中文编码。
def read_upload(filename: str, content: bytes) -> pd.DataFrame:
    if filename.lower().endswith(".xlsx"):
        return pd.read_excel(io.BytesIO(content), engine="openpyxl", header=None)
    if filename.lower().endswith(".csv"):
        for encoding in ("utf-8-sig", "gb18030", "utf-8"):
            try:
                return pd.read_csv(io.BytesIO(content), encoding=encoding, header=None)
            except UnicodeDecodeError:
                continue
    raise ValueError("仅支持 .xlsx 或 .csv 文件")


# CHANGE [2026-09-10 09:15 +08:00] [WH400]: 去除 Power BI 自动附加的“的总和”等聚合后缀，再扫描前 20 行定位标准业务表头。
def locate_detail_table(raw: pd.DataFrame) -> pd.DataFrame:
    def normalize(value: object) -> str:
        if pd.isna(value):
            return ""
        text = re.sub(r"\s+", "", str(value)).lstrip("\ufeff")
        return re.sub(r"的?(总和|平均值|计数|最大值|最小值)$", "", text)

    required = set(COLUMN_MAP)
    for row_index in range(min(len(raw), 20)):
        normalized = [normalize(value) for value in raw.iloc[row_index].tolist()]
        if required.issubset(set(normalized)):
            columns = [value or f"未命名列{index}" for index, value in enumerate(normalized)]
            frame = raw.iloc[row_index + 1:].copy()
            frame.columns = columns
            return frame.dropna(how="all").reset_index(drop=True)
    preview = " ".join(normalize(value) for value in raw.head(5).to_numpy().ravel())
    if "应用的筛选器" in preview:
        raise ValueError(
            "该文件仅包含 Power BI“应用的筛选器”摘要，不是拧紧数据明细表；"
            "请从明细表视觉对象的“更多选项 → 导出数据”重新导出"
        )
    raise ValueError(f"前 20 行未找到完整明细表头，必需列为：{'、'.join(COLUMN_MAP)}")


# CHANGE [2026-09-09 17:14 +08:00] [WH400]: 导入前先提取真实明细区域，再做类型规范化和稳定去重，避免错误视觉对象产生误导性缺列提示。
def import_records(filename: str, content: bytes) -> dict[str, Any]:
    frame = locate_detail_table(read_upload(filename, content))
    frame = frame[list(COLUMN_MAP)].rename(columns=COLUMN_MAP)
    for column in NUMERIC_COLUMNS:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame["result_time"] = pd.to_datetime(frame["result_time"], errors="coerce")
    required = ["station", "program", "esn", "result_time", "final_torque"]
    invalid_mask = frame[required].isna().any(axis=1)
    invalid_rows = int(invalid_mask.sum())
    frame = frame.loc[~invalid_mask].copy()
    batch_id = uuid.uuid4().hex[:12]
    imported_at = datetime.now().isoformat(timespec="seconds")
    accepted = skipped = 0
    with get_connection() as connection:
        for row in frame.to_dict(orient="records"):
            result_time = pd.Timestamp(row["result_time"]).isoformat()
            bolt = "" if pd.isna(row["bolt"]) else str(row["bolt"])
            identity = f"{row['esn']}|{result_time}|{bolt or row['station'] + '|' + row['program']}"
            dedup_key = hashlib.sha256(identity.encode("utf-8")).hexdigest()
            values = [None if pd.isna(row.get(column)) else row.get(column) for column in COLUMN_MAP.values()]
            # CHANGE [2026-09-09 15:18 +08:00] [WH400]: 按字段映射实际顺序写回规范时间与螺栓，避免错位覆盖结果状态。
            values[10] = result_time
            values[11] = bolt
            cursor = connection.execute(
                """INSERT OR IGNORE INTO tightening_records
                (station, program, esn, torque_upper, torque_lower, final_torque, angle_upper,
                 angle_lower, final_angle, result_status, result_time, bolt, import_batch, imported_at, dedup_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (*values, batch_id, imported_at, dedup_key),
            )
            accepted += cursor.rowcount
            skipped += 1 - cursor.rowcount
        connection.execute(
            """INSERT INTO import_batches
            (batch_id, filename, imported_at, accepted_rows, skipped_rows, invalid_rows, status, message)
            VALUES (?, ?, ?, ?, ?, ?, 'completed', ?)""",
            (batch_id, filename, imported_at, accepted, skipped, invalid_rows, "导入完成"),
        )
    return {"batchId": batch_id, "accepted": accepted, "skipped": skipped, "invalid": invalid_rows}


# CHANGE [2026-09-17 13:35 +08:00] [WH400]: 结果状态改为严格匹配，避免“Result was OK”误包含“Looseningresult was OK”并拉低聚合均值；文本检索字段保留模糊查询。
def build_filter(params: dict[str, Any]) -> tuple[str, list[Any]]:
    clauses, values = [], []
    fuzzy_mapping = {"station": "station", "program": "program", "esn": "esn"}
    for key, column in fuzzy_mapping.items():
        if params.get(key):
            clauses.append(f"{column} LIKE ?")
            values.append(f"%{params[key]}%")
    if params.get("status"):
        clauses.append("result_status = ?")
        values.append(params["status"])
    if params.get("start"):
        clauses.append("result_time >= ?")
        values.append(params["start"])
    if params.get("end"):
        clauses.append("result_time < ?")
        values.append((pd.Timestamp(params["end"]) + pd.Timedelta(days=1)).isoformat())
    return (" WHERE " + " AND ".join(clauses) if clauses else ""), values


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 返回可分页、可排序的明细数据，并保留前端所需的总量信息。
def list_records(params: dict[str, Any]) -> dict[str, Any]:
    where, values = build_filter(params)
    allowed_sort = {"result_time", "station", "program", "esn", "final_torque", "final_angle", "result_status"}
    sort = params.get("sort") if params.get("sort") in allowed_sort else "result_time"
    direction = "ASC" if params.get("order") == "asc" else "DESC"
    page, size = max(1, int(params.get("page", 1))), min(200, max(10, int(params.get("size", 20))))
    with get_connection() as connection:
        total = connection.execute(f"SELECT COUNT(*) FROM tightening_records{where}", values).fetchone()[0]
        rows = connection.execute(
            f"SELECT * FROM tightening_records{where} ORDER BY {sort} {direction} LIMIT ? OFFSET ?",
            (*values, size, (page - 1) * size),
        ).fetchall()
    return {"items": [dict(row) for row in rows], "total": total, "page": page, "size": size}


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 导出路径读取全部筛选结果而不受页面 200 行上限影响，并恢复业务中文列名。
def export_records(params: dict[str, Any]) -> pd.DataFrame:
    where, values = build_filter(params)
    columns = ", ".join(COLUMN_MAP.values())
    with get_connection() as connection:
        rows = connection.execute(
            f"SELECT {columns} FROM tightening_records{where} ORDER BY result_time DESC", values
        ).fetchall()
    frame = pd.DataFrame([dict(row) for row in rows])
    return frame.rename(columns={value: key for key, value in COLUMN_MAP.items()})


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 首页统计合并最近任务与导入批次，减少前端首屏请求数量。
def dashboard_summary() -> dict[str, Any]:
    with get_connection() as connection:
        total, ok = connection.execute(
            "SELECT COUNT(*), SUM(CASE WHEN result_status='Result was OK' THEN 1 ELSE 0 END) FROM tightening_records"
        ).fetchone()
        latest_import = connection.execute("SELECT * FROM import_batches ORDER BY id DESC LIMIT 1").fetchone()
        latest_task = connection.execute("SELECT * FROM export_tasks ORDER BY id DESC LIMIT 1").fetchone()
        activities = connection.execute(
            """SELECT imported_at AS time, '数据导入' AS type, filename AS name,
            accepted_rows AS row_count, status FROM import_batches ORDER BY id DESC LIMIT 6"""
        ).fetchall()
    return {
        "recordCount": total,
        "passRate": round((ok or 0) / total * 100, 2) if total else 0,
        "importBatches": _count("import_batches"),
        "latestImport": dict(latest_import) if latest_import else None,
        "latestTask": dict(latest_task) if latest_task else None,
        "activities": [dict(row) for row in activities],
    }


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 简单计数封装用于首页聚合信息。
def _count(table: str) -> int:
    with get_connection() as connection:
        return int(connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 按日聚合扭矩和角度曲线，供 ECharts 三线趋势图直接消费。
def trend_data(params: dict[str, Any]) -> list[dict[str, Any]]:
    where, values = build_filter(params)
    with get_connection() as connection:
        rows = connection.execute(
            f"""SELECT substr(result_time,1,10) AS date,
            AVG(final_torque) AS torque_avg, AVG(torque_upper) AS torque_upper, AVG(torque_lower) AS torque_lower,
            AVG(final_angle) AS angle_avg, AVG(angle_upper) AS angle_upper, AVG(angle_lower) AS angle_lower,
            COUNT(*) AS count FROM tightening_records{where} GROUP BY date ORDER BY date""", values
        ).fetchall()
    return [dict(row) for row in rows]


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 按标准 I-MR 口径计算 Cpk/Ppk 与控制线，并向界面返回可核对的样本序列。
def capability_data(params: dict[str, Any]) -> dict[str, Any]:
    where, values = build_filter(params)
    with get_connection() as connection:
        rows = connection.execute(
            f"SELECT esn, final_torque, torque_upper, torque_lower, result_time FROM tightening_records{where} ORDER BY result_time",
            values,
        ).fetchall()
    items = [dict(row) for row in rows]
    series = [float(row["final_torque"]) for row in rows if row["final_torque"] is not None]
    if len(series) < 2:
        return {"metrics": None, "items": items[-200:], "series": series, "histogram": []}
    mean = statistics.fmean(series)
    stdev = statistics.stdev(series)
    moving_ranges = [abs(series[index] - series[index - 1]) for index in range(1, len(series))]
    mr_mean = statistics.fmean(moving_ranges)
    within_sigma = mr_mean / 1.128 if mr_mean else 0
    upper_values = [float(row["torque_upper"]) for row in rows if row["torque_upper"] is not None]
    lower_values = [float(row["torque_lower"]) for row in rows if row["torque_lower"] is not None]
    usl = statistics.mode(upper_values) if upper_values else max(series)
    lsl = statistics.mode(lower_values) if lower_values else min(series)
    cpk = min((usl - mean) / (3 * within_sigma), (mean - lsl) / (3 * within_sigma)) if within_sigma else None
    ppk = min((usl - mean) / (3 * stdev), (mean - lsl) / (3 * stdev)) if stdev else None
    bins = min(18, max(6, round(math.sqrt(len(series)))))
    counts, edges = pd.cut(series, bins=bins, retbins=True, include_lowest=True)
    histogram = [{"label": str(interval), "center": round((edges[i] + edges[i + 1]) / 2, 3), "count": int((counts == interval).sum())} for i, interval in enumerate(counts.categories)]
    return {
        "metrics": {"cpk": _round(cpk), "ppk": _round(ppk), "mrDenominator": len(moving_ranges),
                    "mean": _round(mean), "usl": _round(usl), "lsl": _round(lsl),
                    "ucl": _round(mean + 2.66 * mr_mean), "lcl": _round(mean - 2.66 * mr_mean), "stdev": _round(stdev)},
        "items": items[-200:], "series": series[-500:], "histogram": histogram,
    }


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 统一数值展示精度，同时保留无法计算时的空值语义。
def _round(value: float | None) -> float | None:
    return round(value, 3) if value is not None else None


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 生成半年脱敏样例用于首次启动演示和验收，不包含真实生产标识。
def demo_frame(days: int = 150, per_day: int = 8) -> pd.DataFrame:
    rows = []
    start = datetime.now() - timedelta(days=days)
    for day in range(days):
        for index in range(per_day):
            moment = start + timedelta(days=day, minutes=index * 67)
            wave = math.sin(day / 9) * 3.8 + math.cos(index * 1.7) * 2.1
            torque = 190 + wave + ((day * 7 + index * 3) % 11 - 5) * 0.55
            rows.append({
                "电枪工位": "60400" if index < 5 else "20800", "程序名称": "190Nm" if index < 5 else "135Nm+180deg-ISM11",
                "ESN": f"D{moment:%y%m%d}{index:02d}", "扭矩上限": 210 if index < 5 else 350,
                "扭矩下限": 170 if index < 5 else 224, "最终扭矩": round(torque if index < 5 else torque + 86, 2),
                "角度上限": 185, "角度下限": 175, "最终角度": round(180 + math.sin(day / 7) * 1.7 + index * 0.08, 2),
                "结果状态": "Result was NOK" if (day + index) % 47 == 0 else "Result was OK",
                "ResultTime": moment.strftime("%Y/%m/%d %H:%M:%S"), "螺栓": str(index % 4 + 1),
            })
    return pd.DataFrame(rows)
