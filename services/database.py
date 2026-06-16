"""
SQLite 持久化层
管理会话和消息的持久化存储
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "chat.db")

# 每个会话最多保留的消息轮数（user+assistant 算一轮）
MAX_CONTEXT_TURNS = 30


def get_connection() -> sqlite3.Connection:
    """获取数据库连接"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """初始化数据库表结构"""
    with get_connection() as conn:
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


# ====================================================================
# 会话操作
# ====================================================================

def create_session(session_id: str, title: str = "新对话") -> None:
    """创建新会话"""
    with get_connection() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO sessions (session_id, title) VALUES (?, ?)",
            (session_id, title),
        )
        conn.commit()


def delete_session(session_id: str) -> None:
    """删除会话及其所有消息"""
    with get_connection() as conn:
        conn.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
        conn.commit()


def rename_session(session_id: str, title: str) -> None:
    """重命名会话"""
    with get_connection() as conn:
        conn.execute(
            "UPDATE sessions SET title = ?, updated_at = ? WHERE session_id = ?",
            (title, datetime.now(), session_id),
        )
        conn.commit()


def list_sessions() -> list[dict]:
    """列出所有会话，按更新时间倒序"""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT session_id, title, created_at, updated_at "
            "FROM sessions ORDER BY updated_at DESC"
        ).fetchall()
        return [dict(r) for r in rows]


def get_session_title(session_id: str) -> str:
    """获取会话标题"""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT title FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row["title"] if row else "新对话"


def session_exists(session_id: str) -> bool:
    """检查会话是否存在"""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT 1 FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return row is not None


# ====================================================================
# 消息操作
# ====================================================================

def get_messages(session_id: str) -> list[dict]:
    """获取会话的所有消息"""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()
        return [dict(r) for r in rows]


def get_truncated_messages(session_id: str) -> list[dict]:
    """获取截断后的消息历史，保留 system prompt + 最近 N 轮对话"""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY id ASC",
            (session_id,),
        ).fetchall()

        if not rows:
            return []

        messages = [dict(r) for r in rows]

        # 分离 system 消息和对话消息
        system_msgs = [m for m in messages if m["role"] == "system"]
        chat_msgs = [m for m in messages if m["role"] != "system"]

        # 只保留最近 MAX_CONTEXT_TURNS 轮（每轮 = user + assistant）
        max_msgs = MAX_CONTEXT_TURNS * 2
        if len(chat_msgs) > max_msgs:
            chat_msgs = chat_msgs[-max_msgs:]

        return system_msgs + chat_msgs


def add_message(session_id: str, role: str, content: str) -> None:
    """添加一条消息并更新会话时间戳"""
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)",
            (session_id, role, content),
        )
        conn.execute(
            "UPDATE sessions SET updated_at = ? WHERE session_id = ?",
            (datetime.now(), session_id),
        )
        conn.commit()


def delete_last_message(session_id: str, role: str) -> bool:
    """删除指定会话中最后一条指定 role 的消息，返回是否成功"""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id FROM messages WHERE session_id = ? AND role = ? "
            "ORDER BY id DESC LIMIT 1",
            (session_id, role),
        ).fetchone()
        if row:
            conn.execute("DELETE FROM messages WHERE id = ?", (row["id"],))
            conn.commit()
            return True
        return False


def delete_last_n_messages(session_id: str, n: int) -> None:
    """删除指定会话中最后 n 条消息"""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id FROM messages WHERE session_id = ? AND role != 'system' "
            "ORDER BY id DESC LIMIT ?",
            (session_id, n),
        ).fetchall()
        if rows:
            ids = [r["id"] for r in rows]
            placeholders = ",".join("?" * len(ids))
            conn.execute(
                f"DELETE FROM messages WHERE id IN ({placeholders})", ids
            )
            conn.commit()


def clear_messages(session_id: str) -> None:
    """清空会话的消息（保留系统提示词）"""
    with get_connection() as conn:
        conn.execute(
            "DELETE FROM messages WHERE session_id = ? AND role != 'system'",
            (session_id,),
        )
        conn.commit()


# 启动时初始化
init_db()
