"""
千禧梦 — 千禧年梦幻机器人聊天
基于 Flask + Moonshot/Kimi API
"""

import json
import uuid
import re
import urllib.request
import urllib.error

from flask import Flask, request, jsonify, render_template, Response, stream_with_context
from flask_cors import CORS

from config import Config
from services.chat_service import chat_service


def create_app() -> Flask:
    """创建并配置 Flask 应用"""
    app = Flask(__name__)
    CORS(app)

    # ================================================================
    # 路由：页面
    # ================================================================

    @app.route("/")
    def index():
        """提供前端聊天页面"""
        return render_template("index.html")

    # ================================================================
    # 路由：API
    # ================================================================

    @app.route("/api/chat", methods=["POST"])
    def api_chat():
        """处理聊天请求

        请求体：{"content": "用户消息", "session_id": "可选，不传则自动生成"}
        返回体：{"reply": "AI 回复", "session_id": "会话 ID"}
        """
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        session_id = (data.get("session_id") or "").strip()

        if not content:
            return jsonify({"reply": "滴～信号为空……请再说一次？", "session_id": session_id})

        reply = chat_service.chat(session_id, content)

        return jsonify({
            "reply": reply,
            "session_id": session_id,
        })

    @app.route("/api/chat/stream", methods=["POST"])
    def api_chat_stream():
        """流式聊天接口（SSE）

        请求体：{"content": "用户消息", "session_id": "会话 ID"}
        返回体：text/event-stream，每行一个 data: {"token": "..."}
        """
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        session_id = (data.get("session_id") or "").strip()

        if not content:
            return jsonify({"reply": "滴～信号为空……请再说一次？", "session_id": session_id})

        def generate():
            for token in chat_service.chat_stream(session_id, content):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield "data: [DONE]\n\n"

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @app.route("/api/sessions", methods=["GET"])
    def api_list_sessions():
        """列出所有会话"""
        sessions = chat_service.list_sessions()
        # 将 datetime 转为字符串
        for s in sessions:
            for key in ("created_at", "updated_at"):
                if key in s and s[key] is not None:
                    s[key] = str(s[key])
        return jsonify(sessions)

    @app.route("/api/sessions/delete", methods=["POST"])
    def api_delete_session():
        """删除一个会话"""
        data = request.get_json(silent=True) or {}
        session_id = (data.get("session_id") or "").strip()
        if session_id:
            chat_service.delete_session(session_id)
        return jsonify({"ok": True})

    @app.route("/api/sessions/rename", methods=["POST"])
    def api_rename_session():
        """重命名一个会话"""
        data = request.get_json(silent=True) or {}
        session_id = (data.get("session_id") or "").strip()
        title = (data.get("title") or "").strip()
        if session_id and title:
            chat_service.rename_session(session_id, title)
        return jsonify({"ok": True})

    @app.route("/api/sessions/<session_id>/messages", methods=["GET"])
    def api_session_messages(session_id):
        """获取指定会话的消息列表"""
        from services.database import get_messages
        msgs = get_messages(session_id)
        # 过滤掉 system 消息返回给前端
        user_messages = [m for m in msgs if m["role"] != "system"]
        return jsonify({"messages": user_messages})

    @app.route("/api/clear", methods=["POST"])
    def api_clear():
        """清空对话历史

        请求体：{"session_id": "会话 ID"}
        返回体：{"reply": "确认消息"}
        """
        data = request.get_json(silent=True) or {}
        session_id = (data.get("session_id") or "").strip()

        chat_service.clear(session_id)

        return jsonify({
            "reply": "滴～记忆体已清空，梦境重启。",
        })

    # ================================================================
    # 路由：发布到 textdb
    # ================================================================

    TEXTDB_BASE = "https://textdb.hunluan.space"

    def repair_html(html):
        """修复常见 HTML 结构问题"""
        # 修复 charset
        html = re.sub(r'charset=["\']?GB2312["\']?', 'charset="UTF-8"', html, flags=re.IGNORECASE)
        html = re.sub(r'charset=["\']?gbk["\']?', 'charset="UTF-8"', html, flags=re.IGNORECASE)

        # 确保有 DOCTYPE
        if not html.strip().lower().startswith('<!doctype'):
            html = '<!DOCTYPE html>\n' + html

        # 确保有 html 标签
        if '<html' not in html:
            html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<html lang="zh-CN">', 1)
            if '</html>' not in html:
                html += '\n</html>'

        # 确保有 head
        if '<head>' not in html.lower():
            head = '<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>'
            html = re.sub(r'(<html[^>]*>)', r'\1\n' + head, html, count=1)

        # 确保有 viewport meta
        if 'viewport' not in html:
            html = re.sub(r'(<head>)', r'\1\n<meta name="viewport" content="width=device-width, initial-scale=1.0">', html, count=1)

        # 确保有 body
        if '<body' not in html.lower():
            head_end = html.lower().find('</head>')
            if head_end != -1:
                html = html[:head_end + 7] + '\n<body>' + html[head_end + 7:]

        # 修复未闭合的常见标签（在 body 关闭前插入）
        unclosed = []
        for tag in ['div', 'p', 'span', 'section', 'article', 'header', 'footer', 'main', 'nav', 'ul', 'li', 'h1', 'h2', 'h3']:
            opens = len(re.findall(f'<{tag}[\\s>]', html, re.IGNORECASE))
            closes = len(re.findall(f'</{tag}>', html, re.IGNORECASE))
            if opens > closes:
                unclosed.extend([f'</{tag}>'] * (opens - closes))

        if unclosed:
            # 在 </body> 前插入闭合标签
            body_close = html.lower().rfind('</body>')
            if body_close != -1:
                html = html[:body_close] + '\n'.join(unclosed) + '\n' + html[body_close:]
            else:
                html += '\n' + '\n'.join(unclosed) + '\n</body>'

        # 确保有 </body>
        if '</body>' not in html.lower():
            html += '\n</body>'

        # 确保有 </html>
        if '</html>' not in html.lower():
            html += '\n</html>'

        # 移除 script 标签（安全考虑）
        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL|re.IGNORECASE)

        return html

    @app.route("/api/publish", methods=["POST"])
    def api_publish():
        """将内容发布到 textdb，返回可访问链接

        请求体：{"content": "内容", "type": "doc|ppt|page"}
        返回体：{"key": "xxx", "url": "渲染链接", "type": "doc|ppt|page"}
        """
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        pub_type = (data.get("type") or "page").strip()

        if not content:
            return jsonify({"error": "内容为空"}), 400

        # 网页类型自动修复 HTML（后端规则修复 + AI 修复）
        if pub_type == "page":
            content = repair_html(content)
            # AI 深度修复
            content = chat_service.repair_html(content)

        # 生成唯一 key
        key = f"qx_{pub_type}_{uuid.uuid4().hex[:8]}"

        # POST 到 textdb
        try:
            req = urllib.request.Request(
                f"{TEXTDB_BASE}/update/",
                data=json.dumps({"key": key, "value": content}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                pass
        except Exception as e:
            return jsonify({"error": f"发布失败: {str(e)}"}), 502

        # 根据类型返回渲染链接
        if pub_type == "doc":
            url = f"{TEXTDB_BASE}/md/{key}"
        elif pub_type == "ppt":
            url = f"{TEXTDB_BASE}/p/{key}"
        else:
            url = f"{TEXTDB_BASE}/p/{key}"

        return jsonify({"key": key, "url": url, "type": pub_type})

    return app


# ================================================================
# 入口
# ================================================================

if __name__ == "__main__":
    # 验证配置
    Config.validate()

    app = create_app()

    print("=" * 56)
    print("  🤖  千禧梦 · 构成主义聊天")
    print("=" * 56)
    print(f"  🌐  访问地址  http://127.0.0.1:{Config.PORT}")
    print(f"  🧠  模型      {Config.MODEL_NAME}")
    print(f"  🎨  风格      构成主义 × 千禧年梦幻")
    print("=" * 56)

    app.run(debug=Config.DEBUG, host='0.0.0.0', port=Config.PORT)
