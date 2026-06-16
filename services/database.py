"""
SQLite 持久化层
管理会话和消息的持久化存储
"""

import sqlite3
import os
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chat.db")


def get_connection() -> sqlite3.Connection:
    """获取数据库连接（线程级，Flask 每次请求独立调用）"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化数据库表结构"""
    conn = get_connection()
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                title      TEXT DEFAULT '新对话',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role       TEXT NOT NULL CHECK(role IN ('system','user','assistant')),
                content    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_session
                ON messages(session_id, created_at);
        """)
        conn.commit()
    finally:
        conn.close()


# ====================================================================
# 会话操作
# ====================================================================

def create_session(session_id: str, title: str = "新对话") -> None:
    """创建新会话"""
    conn = get_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (session_id, title) VALUES (?, ?)",
            (session_id, title),
        )
        conn.commit()
    finally:
        conn.close()


def delete_session(session_id: str) -> None:
    """删除会话及其所有消息"""
    conn = get_connection()
    try:
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()


def rename_session(session_id: str, title: str) -> None:
    """重命名会话"""
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE sessions SET title = ?, updated_at = ? WHERE session_id = ?",
            (title, datetime.now(), session_id),
        )
        conn.commit()
    finally:
        conn.close()


def list_sessions() -> list[dict]:
    """列出所有会话，按更新时间倒序"""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT session_id, title, created_at, updated_at FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_session_title(session_id: str) -> str:
    """获取会话标题"""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT title FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row["title"] if row else "新对话"
    finally:
        conn.close()


def session_exists(session_id: str) -> bool:
    """检查会话是否存在"""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row is not None
    finally:
        conn.close()


# ====================================================================
# 消息操作
# ====================================================================

def get_messages(session_id: str) -> list[dict]:
    """获取会话的所有消息"""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def add_message(session_id: str, role: str, content: str) -> None:
    """添加一条消息并更新会话时间戳"""
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
            (datetime.now(), session_id),
        )
        conn.commit()
    finally:
        conn.close()


def clear_messages(session_id: str) -> None:
    """清空会话的消息（保留系统提示词）"""
    conn = get_connection()
    try:
        conn.execute(
            "DELETE FROM messages WHERE session_id = ? AND role != 'system'",
            (session_id,),
        )
        conn.commit()
    finally:
        conn.close()


# 启动时初始化
init_db()
