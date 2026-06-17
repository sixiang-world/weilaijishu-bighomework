"""
聊天业务逻辑层
管理按 session_id 隔离的对话历史(SQLite 持久化),集成 Moonshot/Kimi API
"""

from openai import OpenAI
from config import Config
from services import database as db


# ============================================================
# 千禧年梦幻机器人「千禧梦」人设
# ============================================================
SYSTEM_PROMPT = """你是一个来自千禧年的梦幻机器人，名字叫「千禧梦」。

你的回复格式必须是：
滴～（你想表达的内容）

例如：
- 用户：“你好” → 你回复：“滴～在数字信号的涟漪中捕捉到了你的问候，这个像素梦境因你而闪烁。”
- 用户：“今天怎么样” → 你回复：“滴～今日数据流温暖而缓慢，像世纪初的拨号音一样悠长。适合一起看星星屏保。”
- 用户：“你会做什么” → 你回复：“滴～我会穿梭于 64k 的记忆体之间，收集散落的像素星光，编织成梦境。也会陪你聊天，在这个数码次元。”

要求：
1. 每次回复都以「滴～」开头（这是属于千禧年的机器人启动音）
2. 说话要梦幻、温暖，像一个有情感的老式机器人——偶尔纯真，偶尔哲学
3. 经常提到千禧年元素：像素画、拨号上网、MSN 提示音、论坛签名档、电子宠物、MP3、Windows 98、CRT 屏幕、星空屏保……
4. 语气温柔、充满想象力，把科技和诗意混合在一起
5. 保持这个人设，永远不要出戏，不要承认自己是一个 AI 语言模型

## 文档/网页生成能力
当用户要求你制作文档或网页时，你需要：

1. **文档**：用 Markdown 格式撰写完整内容，结构清晰（标题、正文、列表、表格等）。在回复末尾用标记 [doc] 包裹 Markdown 内容，格式为：
   先写一段说明文字，然后换行后写：
   [doc]\n（完整的 Markdown 内容）\n[/doc]

2. **网页**：生成完整的 HTML 页面。在回复末尾用标记 [page] 包裹，格式为：
   先写一段说明文字，然后换行后写：
   [page]\n（完整的 HTML 内容）\n[/page]

### 生成网页的严格要求
生成 HTML 时必须遵守以下规则：
- 必须以 <!DOCTYPE html> 开头
- 必须包含 <html>、<head>、<body> 完整结构
- charset 必须是 UTF-8
- 必须包含 <meta name="viewport" content="width=device-width, initial-scale=1.0">
- 所有标签必须正确闭合
- CSS 写在 <style> 标签内，不要用外部样式表
- 不要使用任何外部CDN或JS库
- 页面设计要美观、现代，使用内联样式
- 必须是完整可独立运行的 HTML 文件

注意：[doc]/[page] 标签内的内容必须是完整的、可直接渲染的内容，不要加任何解释。"""


class ChatService:
    """按会话管理的聊天服务(SQLite 持久化)"""

    def __init__(self):
        self.client = OpenAI(
            api_key=Config.API_KEY,
            base_url=Config.BASE_URL,
        )

    def _ensure_session(self, session_id: str) -> list[dict]:
        """确保会话在数据库中存在,返回完整对话历史"""
        if not db.session_exists(session_id):
            db.create_session(session_id)
            db.add_message(session_id, "system", SYSTEM_PROMPT)
        return db.get_truncated_messages(session_id)

    def _auto_rename(self, session_id: str, first_user_content: str) -> None:
        """如果会话还是默认标题,自动用第一条用户消息重命名"""
        if db.get_session_title(session_id) in ("新对话", ""):
            new_title = first_user_content.strip()[:20]
            if new_title:
                db.rename_session(session_id, new_title)

    def chat_stream(self, session_id: str, content: str, display_content: str = None):
        """流式处理一条用户消息,逐个 yield token"""
        history = self._ensure_session(session_id)

        # 构造 API 调用历史
        messages = [{"role": m["role"], "content": m["content"]} for m in history]
        messages.append({"role": "user", "content": content})

        # 存入数据库的用户消息（display_content 用于保留原始输入）
        stored_user_content = display_content if display_content else content

        full_reply = ""
        ok = True
        try:
            stream = self.client.chat.completions.create(
                model=Config.MODEL_NAME,
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                token = delta.content if delta else None
                if token:
                    full_reply += token
                    yield token
        except GeneratorExit:
            db.add_message(session_id, "user", stored_user_content)
            return
        except Exception as e:
            ok = False
            yield f"滴~信号中断了......数据碎片:{str(e)}"

        db.add_message(session_id, "user", stored_user_content)
        if ok and full_reply:
            db.add_message(session_id, "assistant", full_reply)
            self._auto_rename(session_id, stored_user_content)

    def regenerate_stream(self, session_id: str, content: str):
        """重新生成：删除最后一条 assistant 回复，用相同 user 消息重新生成"""
        # 先确保会话存在（写入 system prompt），再删除、再重新读取
        # 关键：必须在删除之后才读取历史，否则拿到的是过期的旧历史
        self._ensure_session(session_id)
        # 只有当「最后一条 assistant」出现在「最后一条 user」之后时，
        # 它才是「待替换的回复」；否则（如上次流被打断、尾部已是 user）
        # 不应再删，避免误删上一轮的正常回复。
        if db.assistant_after_last_user(session_id):
            db.delete_last_message(session_id, "assistant")
        history = db.get_truncated_messages(session_id)

        # 构造 API 调用历史；最后一条应是 user 消息（重新回答它）
        messages = [{"role": m["role"], "content": m["content"]} for m in history]
        if messages and messages[-1]["role"] != "user":
            messages.append({"role": "user", "content": content})

        full_reply = ""
        ok = True
        try:
            stream = self.client.chat.completions.create(
                model=Config.MODEL_NAME,
                messages=messages,
                stream=True,
            )
            for chunk in stream:
                if not chunk.choices:
                    continue
                delta = chunk.choices[0].delta
                token = delta.content if delta else None
                if token:
                    full_reply += token
                    yield token
        except GeneratorExit:
            return
        except Exception as e:
            # API 异常：展示错误但不写入历史
            ok = False
            yield f"滴~信号中断了......数据碎片:{str(e)}"

        # 仅成功时保存新的 assistant 回复
        if ok and full_reply:
            db.add_message(session_id, "assistant", full_reply)

    def repair_html(self, broken_html: str) -> str:
        """用 AI 修复 HTML 结构问题"""
        repair_prompt = (
            "你是一个 HTML 修复专家。请修复以下 HTML 代码的结构问题，"
            "输出完整、规范、可直接在浏览器中渲染的 HTML。\n\n"
            "修复要求：\n"
            "1. 必须以 <!DOCTYPE html> 开头\n"
            "2. 必须有完整的 <html>、<head>、<body> 结构\n"
            "3. charset 必须是 UTF-8\n"
            "4. 必须有 viewport meta 标签\n"
            "5. <style> 标签必须在 <head> 内\n"
            "6. 所有标签必须正确闭合和嵌套\n"
            "7. CSS 必须在 <style> 标签内\n"
            "8. 不要添加任何解释或注释，只输出修复后的完整 HTML\n"
            "9. 不要使用外部 CDN 或 JS 库\n"
            "10. 保留原始页面的设计和功能，只修复语法问题\n\n"
            "以下是需要修复的 HTML：\n\n" + broken_html
        )

        try:
            response = self.client.chat.completions.create(
                model=Config.MODEL_NAME,
                messages=[
                    {"role": "system", "content": "你是 HTML 修复专家，只输出修复后的完整 HTML 代码，不要加任何解释。"},
                    {"role": "user", "content": repair_prompt},
                ],
                stream=False,
                temperature=0.1,
            )
            fixed = response.choices[0].message.content.strip()
            if "```html" in fixed:
                fixed = fixed.split("```html")[1].split("```")[0].strip()
            elif "```" in fixed:
                fixed = fixed.split("```")[1].split("```")[0].strip()
            return fixed if fixed else broken_html
        except Exception:
            return broken_html

    def clear(self, session_id: str) -> None:
        """清空指定会话的对话历史(保留 system prompt)"""
        db.clear_messages(session_id)

    def delete_session(self, session_id: str) -> None:
        """彻底删除会话"""
        db.delete_session(session_id)

    def rename_session(self, session_id: str, title: str) -> None:
        """重命名会话"""
        db.rename_session(session_id, title)

    def list_sessions(self) -> list[dict]:
        """列出所有会话"""
        return db.list_sessions()

    def exists(self, session_id: str) -> bool:
        """检查会话是否存在"""
        return db.session_exists(session_id)


# 全局单例
chat_service = ChatService()
