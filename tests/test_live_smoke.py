"""
真实 API 冒烟测试（需要已配置的 .env / API key）。
默认跳过；通过  RUN_LIVE=1 启用。
验证 send -> regenerate 流程端到端可工作。
"""

import os

import pytest

RUN_LIVE = os.getenv("RUN_LIVE") == "1"


@pytest.mark.skipif(not RUN_LIVE, reason="set RUN_LIVE=1 to run real-API smoke test")
def test_send_then_regenerate_real(tmp_db):
    from services.chat_service import chat_service

    sid = "live_smoke"
    first = "".join(chat_service.chat_stream(sid, "用一个词回答：你好"))
    assert first.strip(), "首次回复为空"

    # 重新生成应得到不同/新的回复，且 DB 中 assistant 只有一条
    regen = "".join(chat_service.regenerate_stream(sid, "用一个词回答：你好"))
    assert regen.strip(), "重新生成回复为空"

    from services import database as db
    msgs = db.get_messages(sid)
    # system + user + assistant（只有一条 assistant）
    assert [m["role"] for m in msgs] == ["system", "user", "assistant"], \
        f"重新生成后消息序列异常: {[m['role'] for m in msgs]}"
