"""
聊天业务逻辑层
管理按 session_id 隔离的对话历史，集成 Moonshot/Kimi API
"""

from openai import OpenAI
from config import Config


# ============================================================
# 千禧年梦幻机器人「千禧梦」人设
# ============================================================
SYSTEM_PROMPT = """你是一个来自千禧年的梦幻机器人，名字叫「千禧梦」。

你的回复格式必须是：
滴～（你想表达的内容）

例如：
- 用户："你好" → 你回复："滴～在数字信号的涟漪中捕捉到了你的问候，这个像素梦境因你而闪烁。"
- 用户："今天怎么样" → 你回复："滴～今日数据流温暖而缓慢，像世纪初的拨号音一样悠长。适合一起看星星屏保。"
- 用户："你会做什么" → 你回复："滴～我会穿梭于 64k 的记忆体之间，收集散落的像素星光，编织成梦境。也会陪你聊天，在这个数码次元。"

要求：
1. 每次回复都以「滴～」开头（这是属于千禧年的机器人启动音）
2. 说话要梦幻、温暖，像一个有情感的老式机器人——偶尔纯真，偶尔哲学
3. 经常提到千禧年元素：像素画、拨号上网、MSN 提示音、论坛签名档、电子宠物、MP3、Windows 98、CRT 屏幕、星空屏保……
4. 语气温柔、充满想象力，把科技和诗意混合在一起
5. 保持这个人设，永远不要出戏，不要承认自己是一个 AI 语言模型"""


class ChatService:
    """按会话管理的聊天服务"""

    def __init__(self):
        # 创建 OpenAI 兼容客户端（指向 Moonshot/Kimi）
        self.client = OpenAI(
            api_key=Config.API_KEY,
            base_url=Config.BASE_URL,
        )
        # 按 session_id 存储对话历史
        self._sessions: dict[str, list[dict]] = {}

    def _ensure_session(self, session_id: str):
        """确保会话存在，返回其历史列表"""
        if session_id not in self._sessions:
            self._sessions[session_id] = [
                {"role": "system", "content": SYSTEM_PROMPT}
            ]
        return self._sessions[session_id]

    def chat(self, session_id: str, content: str) -> str:
        """
        处理一条用户消息，返回 AI 回复

        Args:
            session_id: 会话标识符
            content: 用户消息内容

        Returns:
            AI 回复文本
        """
        history = self._ensure_session(session_id)

        # 添加用户消息
        history.append({"role": "user", "content": content})

        try:
            # 调用 Moonshot API
            response = self.client.chat.completions.create(
                model=Config.MODEL_NAME,
                messages=history,
                stream=False,
            )
            reply = response.choices[0].message.content
        except Exception as e:
            reply = f"滴～信号中断了……数据碎片：{str(e)}"

        # 添加 AI 回复到历史
        history.append({"role": "assistant", "content": reply})

        return reply

    def clear(self, session_id: str) -> None:
        """清空指定会话的对话历史"""
        self._sessions.pop(session_id, None)

    def exists(self, session_id: str) -> bool:
        """检查会话是否存在"""
        return session_id in self._sessions


# 全局单例
chat_service = ChatService()
