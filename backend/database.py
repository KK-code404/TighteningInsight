"""CHANGE [2026-09-09 15:18 +08:00] [WH400]: 使用零配置 SQLite 保存拧紧明细、导入批次与任务留痕。"""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "tightening.db"


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 集中创建表结构，保证首次启动无需单独建库步骤。
def initialize_database() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS tightening_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                station TEXT NOT NULL,
                program TEXT NOT NULL,
                esn TEXT NOT NULL,
                torque_upper REAL,
                torque_lower REAL,
                final_torque REAL,
                angle_upper REAL,
                angle_lower REAL,
                final_angle REAL,
                result_status TEXT,
                result_time TEXT NOT NULL,
                bolt TEXT,
                import_batch TEXT NOT NULL,
                imported_at TEXT NOT NULL,
                dedup_key TEXT NOT NULL UNIQUE
            );
            CREATE INDEX IF NOT EXISTS idx_records_time ON tightening_records(result_time DESC);
            CREATE INDEX IF NOT EXISTS idx_records_filter ON tightening_records(station, program, result_status);
            CREATE TABLE IF NOT EXISTS import_batches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL UNIQUE,
                filename TEXT NOT NULL,
                imported_at TEXT NOT NULL,
                accepted_rows INTEGER NOT NULL,
                skipped_rows INTEGER NOT NULL,
                invalid_rows INTEGER NOT NULL,
                status TEXT NOT NULL,
                message TEXT
            );
            CREATE TABLE IF NOT EXISTS export_tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at TEXT NOT NULL,
                finished_at TEXT,
                mode TEXT NOT NULL,
                status TEXT NOT NULL,
                filename TEXT,
                row_count INTEGER DEFAULT 0,
                message TEXT
            );
            -- CHANGE [2026-10-10 13:20 +08:00] [WH400]: 在本机数据库保存单例邮件告警配置及发送去重记录，避免密码进入源码或 GitHub。
            CREATE TABLE IF NOT EXISTS email_alert_config (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                enabled INTEGER NOT NULL DEFAULT 0,
                smtp_host TEXT NOT NULL DEFAULT '',
                smtp_port INTEGER NOT NULL DEFAULT 587,
                security TEXT NOT NULL DEFAULT 'starttls',
                username TEXT NOT NULL DEFAULT '',
                password TEXT NOT NULL DEFAULT '',
                sender TEXT NOT NULL DEFAULT '',
                recipients TEXT NOT NULL DEFAULT '',
                subject_prefix TEXT NOT NULL DEFAULT '[拧紧数据告警]',
                station TEXT NOT NULL DEFAULT '',
                program TEXT NOT NULL DEFAULT '',
                result_status TEXT NOT NULL DEFAULT 'Result was OK',
                updated_at TEXT,
                last_checked_at TEXT,
                last_sent_at TEXT,
                last_error TEXT
            );
            INSERT OR IGNORE INTO email_alert_config (id) VALUES (1);
            CREATE TABLE IF NOT EXISTS email_alert_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_key TEXT NOT NULL UNIQUE,
                event_date TEXT NOT NULL,
                direction TEXT NOT NULL,
                torque_average REAL NOT NULL,
                upper_control REAL NOT NULL,
                lower_control REAL NOT NULL,
                mean REAL NOT NULL,
                sigma REAL NOT NULL,
                scope TEXT NOT NULL,
                recipients TEXT NOT NULL,
                sent_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_email_alert_events_date ON email_alert_events(event_date DESC);
            """
        )


# CHANGE [2026-09-09 15:18 +08:00] [WH400]: 每次请求使用独立连接并自动提交或回滚，避免跨线程复用连接。
@contextmanager
def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

