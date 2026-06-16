"""
验证重新生成在各种尾部状态下都能自洽，不产生重复 user 或残留 assistant。

覆盖场景：
- 正常尾部 ...u1,r1,u2,r2 -> 重新生成 -> ...u1,r1,u2,r2_new
- 中断尾部 ...u1,r1,u2（上一次流被打断，未存 assistant）-> 重新生成不应重复 u2
- user 是最后一条且无 assistant 可删 -> delete 返回 False，仍正确生成
"""

from tests.conftest import set_scripted
from services import database as db


def _drain(gen):
    return "".join(list(gen))


def _build(svc, pairs):
    """pairs: [(user, reply), ...]，按顺序灌入 chat_stream。"""
    for u, r in pairs:
        set_scripted(svc, [r])
        _drain(svc.chat_stream("s", u))


def test_regenerate_normal_tail(patched_service):
    svc = patched_service
    _build(svc, [("u1", "r1"), ("u2", "r2")])

    set_scripted(svc, ["r2_new"])
    svc.client.calls = []
    _drain(svc.regenerate_stream("s", "u2"))

    sent = svc.client.calls[0]
    assert [m["role"] for m in sent] == ["system", "user", "assistant", "user"]
    assert [m["content"] for m in sent][1:] == ["u1", "r1", "u2"]
    contents = [m["content"] for m in db.get_messages("s")]
    assert contents[-1] == "r2_new"
    assert contents.count("u2") == 1


def test_regenerate_interrupted_tail_no_duplicate_user(patched_service):
    """上次流被打断：DB 尾部是 ...u1,r1,u2（无 r2）。重新生成不应重复 u2。"""
    svc = patched_service
    _build(svc, [("u1", "r1"), ("u2", "r2")])
    # 模拟中断：删掉最后一条 assistant，模拟上次没存成
    db.delete_last_message("s", "assistant")

    set_scripted(svc, ["r2_new"])
    svc.client.calls = []
    _drain(svc.regenerate_stream("s", "u2"))

    sent = svc.client.calls[0]
    roles = [m["role"] for m in sent]
    # system, u1, r1, u2 —— u2 只出现一次
    assert roles == ["system", "user", "assistant", "user"]
    contents = [m["content"] for m in sent]
    assert contents.count("u2") == 1
    # DB 末尾是新回复，且没有遗留空回复
    db_contents = [m["content"] for m in db.get_messages("s")]
    assert db_contents[-1] == "r2_new"
    assert db_contents.count("u2") == 1
