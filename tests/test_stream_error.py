"""
验证流式 chat_stream 在 API 异常时不会把错误文案当作 assistant 回复污染历史。
"""

from tests.conftest import set_scripted
from services import database as db


class _RaisingClient:
    """永远抛异常的假客户端。"""

    @property
    def chat(self):
        outer = self

        class _C:
            def create(self, **kw):
                raise RuntimeError("boom")

        return _C()


def _drain(gen):
    return "".join(list(gen))


def test_chat_stream_api_error_does_not_pollute_history(patched_service):
    svc = patched_service
    svc.client = _RaisingClient()

    reply = _drain(svc.chat_stream("s", "hello"))
    # 用户仍能看到错误提示
    assert "信号中断" in reply

    # 关键：错误文案不应作为 assistant 消息存入历史
    msgs = db.get_messages("s")
    roles = [m["role"] for m in msgs]
    contents = [m["content"] for m in msgs]
    assert roles == ["system", "user"], \
        f"API 异常不应写入 assistant，实际: {roles}"
    assert contents[1] == "hello"
    assert not any("信号中断" in c for c in contents), \
        "错误文案不应进入历史"


def test_chat_stream_success_saves_both(patched_service):
    """对照测试：成功时正常保存 user + assistant。"""
    svc = patched_service
    set_scripted(svc, ["好的"])
    reply = _drain(svc.chat_stream("s", "hi"))
    assert reply == "好的"

    msgs = db.get_messages("s")
    assert [m["role"] for m in msgs] == ["system", "user", "assistant"]
    assert [m["content"] for m in msgs][1:] == ["hi", "好的"]
