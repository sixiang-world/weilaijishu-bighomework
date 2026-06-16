"""
验证「重新生成」的上下文构造。

场景：u1 -> r1 -> u2 -> r2，点 r1 重新生成时，
应基于 u1, r1, u2 重新生成 r2，DB 与发送给模型的消息序列都正确。
"""

import pytest
from tests.conftest import set_scripted, make_fake_client


def _drain(gen):
    return "".join(list(gen))


def test_regenerate_uses_correct_context(patched_service):
    svc = patched_service

    # 第一轮：u1 -> r1
    set_scripted(svc, ["r1"])
    _drain(svc.chat_stream("s", "u1"))
    # 第二轮：u2 -> r2
    set_scripted(svc, ["r2"])
    _drain(svc.chat_stream("s", "u2"))

    # 现在重新生成最后一条回复
    set_scripted(svc, ["r2_new"])
    svc.client.calls = []
    _drain(svc.regenerate_stream("s", "u2"))

    sent = svc.client.calls[0]
    roles = [m["role"] for m in sent]
    contents = [m["content"] for m in sent]

    # 关键断言：序列应为 system, user(u1), assistant(r1), user(u2)
    # —— 不能重复 user(u2)，也不能残留旧 r2
    assert roles == ["system", "user", "assistant", "user"], \
        f"上下文序列错误: {roles}"
    assert contents[1:] == ["u1", "r1", "u2"], \
        f"上下文内容错误: {contents}"


def test_regenerate_removes_old_reply_from_db(patched_service):
    from services import database as db

    svc = patched_service
    set_scripted(svc, ["r1"])
    _drain(svc.chat_stream("s", "u1"))
    set_scripted(svc, ["r2"])
    _drain(svc.chat_stream("s", "u2"))

    # 重新生成
    set_scripted(svc, ["r2_new"])
    _drain(svc.regenerate_stream("s", "u2"))

    contents = [m["content"] for m in db.get_messages("s")]
    # 旧 r2 应被替换为 r2_new，u2 只出现一次
    assert contents.count("u2") == 1
    assert "r2" not in contents
    assert contents[-1] == "r2_new"
