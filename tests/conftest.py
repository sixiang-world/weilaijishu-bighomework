"""
测试公用夹具：
- tmp_db：每个测试用独立的临时数据库。
- make_fake_client：可编程的假 OpenAI 客户端，用于断言「真正发给模型的消息序列」。
"""

import os
import sys

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


@pytest.fixture
def tmp_db(tmp_path, monkeypatch):
    """把数据库重定向到临时目录并重新初始化。"""
    import services.database as db

    tmp_db_path = tmp_path / "test_chat.db"
    monkeypatch.setattr(db, "DB_PATH", str(tmp_db_path))
    db.init_db()
    return db


# ---- 假 OpenAI 客户端 -------------------------------------------------

class _FakeDelta:
    def __init__(self, content):
        self.content = content


class _FakeStreamChunk:
    def __init__(self, content):
        if content is None:
            self.choices = [type("C", (), {"delta": None})()]
        else:
            self.choices = [type("C", (), {"delta": _FakeDelta(content)})()]


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


class _Completions:
    def __init__(self, fake_client):
        self._fake = fake_client

    def create(self, model=None, messages=None, stream=False, **kw):
        self._fake.calls.append([dict(m) for m in messages])
        if not self._fake._scripted:
            raise RuntimeError("FakeClient: 没有预设回复了")
        reply = self._fake._scripted.pop(0)
        if stream:
            chunks = [_FakeStreamChunk(ch) for ch in reply]
            chunks.append(_FakeStreamChunk(None))  # 结束 chunk
            return iter(chunks)
        return _FakeResponse(reply)


class FakeClient:
    """可编程假客户端：按队列返回回复；记录每次 create 的 messages。"""

    def __init__(self, scripted=None):
        self._scripted = list(scripted or [])
        self.calls = []

    @property
    def chat(self):
        # 每次访问返回新的 _Completions，但共享同一个 fake
        return type("Chat", (), {"completions": _Completions(self)})()


def make_fake_client(scripted):
    """构造一个预置回复队列的 FakeClient。"""
    return FakeClient(scripted)


@pytest.fixture
def patched_service(tmp_db):
    """返回一个用 FakeClient 的 ChatService（测试自行 set client）。"""
    from services import chat_service as cs

    svc = cs.ChatService.__new__(cs.ChatService)
    svc.client = FakeClient()
    return svc


def set_scripted(svc, scripted):
    svc.client = make_fake_client(scripted)
    return svc
