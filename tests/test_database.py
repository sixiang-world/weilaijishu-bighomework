"""数据库层基础测试 — 不依赖网络/API。"""

import services.database as db  # noqa: F401  (会触发 init_db，被 tmp_db 覆盖)


def test_create_and_get_session(tmp_db):
    assert not tmp_db.session_exists("s1")
    tmp_db.create_session("s1")
    assert tmp_db.session_exists("s1")
    assert tmp_db.get_session_title("s1") == "新对话"


def test_add_message_appends_in_order(tmp_db):
    tmp_db.create_session("s1")
    tmp_db.add_message("s1", "user", "hello")
    tmp_db.add_message("s1", "assistant", "hi")
    msgs = tmp_db.get_messages("s1")
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert [m["content"] for m in msgs] == ["hello", "hi"]


def test_delete_last_message_returns_bool(tmp_db):
    tmp_db.create_session("s1")
    assert tmp_db.delete_last_message("s1", "assistant") is False
    tmp_db.add_message("s1", "user", "q")
    tmp_db.add_message("s1", "assistant", "a1")
    tmp_db.add_message("s1", "assistant", "a2")
    assert tmp_db.delete_last_message("s1", "assistant") is True
    msgs = tmp_db.get_messages("s1")
    assert [m["content"] for m in msgs] == ["q", "a1"]


def test_truncated_keeps_system_and_recent(tmp_db):
    tmp_db.create_session("s1")
    tmp_db.add_message("s1", "system", "SYS")
    for i in range(40):  # 远超 MAX_CONTEXT_TURNS
        tmp_db.add_message("s1", "user", f"u{i}")
        tmp_db.add_message("s1", "assistant", f"a{i}")
    msgs = tmp_db.get_truncated_messages("s1")
    roles = [m["role"] for m in msgs]
    assert roles[0] == "system"          # system 总在最前
    assert roles.count("user") == 30     # 截断到最近 30 轮
    assert msgs[-1]["content"] == "a39"
