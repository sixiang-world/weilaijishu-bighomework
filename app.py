"""
千禧梦 — 千禧年梦幻机器人聊天
基于 Flask + Moonshot/Kimi API
"""

import json
import uuid
import re
import os
import time
import logging
import urllib.request
import urllib.error
from functools import wraps
from collections import defaultdict

from flask import Flask, request, jsonify, render_template, Response, stream_with_context
from flask_cors import CORS

from config import Config
from services.chat_service import chat_service

# ================================================================
# 日志配置（控制台 + 文件）
# ================================================================
_log_dir = os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(_log_dir, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(_log_dir, "app.log"),
            encoding="utf-8",
        ),
    ],
)
logger = logging.getLogger("千禧梦")


def create_app() -> Flask:
    """创建并配置 Flask 应用"""
    app = Flask(__name__)

    # 只允许指定域名跨域
    ALLOWED_ORIGINS = [
        "https://bighomework.hunluan.space",
        "https://bighomework.sixiang.tech",
        "https://textdb.hunluan.space",
    ]
    CORS(app, resources={r"/api/*": {"origins": ALLOWED_ORIGINS}})

    # ================================================================
    # 简易速率限制（内存令牌桶，宽松配置）
    # ================================================================
    # 格式：{ip: {endpoint: [timestamps]}}
    _rate_limit_store: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    # 限制规则：(时间窗口秒, 最大请求数)
    RATE_LIMITS = {
        "/api/chat/stream":      (60, 30),   # 60秒内最多30次
        "/api/chat/regenerate":  (60, 20),   # 60秒内最多20次
        "/api/publish":          (60, 10),   # 60秒内最多10次
        "/api/sessions/delete":  (60, 10),   # 60秒内最多10次
        "/api/clear":            (60, 10),   # 60秒内最多10次
        "_default":              (60, 60),   # 其他接口：60秒内最多60次
    }

    def rate_limit(f):
        """速率限制装饰器"""
        @wraps(f)
        def decorated(*args, **kwargs):
            ip = request.remote_addr or "unknown"
            endpoint = request.path
            window, max_req = RATE_LIMITS.get(endpoint, RATE_LIMITS["_default"])

            now = time.time()
            # 清理过期记录
            timestamps = _rate_limit_store[ip][endpoint]
            _rate_limit_store[ip][endpoint] = [t for t in timestamps if now - t < window]

            if len(_rate_limit_store[ip][endpoint]) >= max_req:
                logger.warning(f"速率限制触发: ip={ip} endpoint={endpoint}")
                return jsonify({"error": "请求过于频繁，请稍后再试"}), 429

            _rate_limit_store[ip][endpoint].append(now)
            return f(*args, **kwargs)
        return decorated

    def sanitize_session_id(sid: str) -> str:
        """清理 session_id，只保留安全字符"""
        return re.sub(r'[^a-zA-Z0-9_\-]', '', sid)[:128]

    # ================================================================
    # 路由：页面
    # ================================================================

    @app.route("/")
    def index():
        """提供前端聊天页面"""
        return render_template("index.html")

    @app.route("/chat/<session_id>")
    def chat_page(session_id):
        """带会话 ID 的聊天页面（前端从 window.location 自行解析 session_id）"""
        return render_template("index.html")

    # ================================================================
    # 路由：API
    # ================================================================

    @app.route("/api/chat/stream", methods=["POST"])
    @rate_limit
    def api_chat_stream():
        """流式聊天接口（SSE）"""
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        display_content = (data.get("display_content") or "").strip() or None
        session_id = sanitize_session_id((data.get("session_id") or "").strip())

        if not content:
            return jsonify({"reply": "滴～信号为空……请再说一次？", "session_id": session_id})

        logger.info(f"chat_stream: session={session_id} len={len(content)}")

        def generate():
            try:
                for token in chat_service.chat_stream(session_id, content, display_content):
                    yield f"data: {json.dumps({'token': token})}\n\n"
                yield "data: [DONE]\n\n"
            except GeneratorExit:
                pass

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @app.route("/api/chat/regenerate", methods=["POST"])
    @rate_limit
    def api_chat_regenerate():
        """流式重新生成（SSE）— 删除最后一条回复并重新生成"""
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        session_id = sanitize_session_id((data.get("session_id") or "").strip())

        if not content:
            return jsonify({"reply": "滴～信号为空……请再说一次？", "session_id": session_id})

        logger.info(f"regenerate: session={session_id}")

        def generate():
            try:
                for token in chat_service.regenerate_stream(session_id, content):
                    yield f"data: {json.dumps({'token': token})}\n\n"
                yield "data: [DONE]\n\n"
            except GeneratorExit:
                pass

        return Response(
            stream_with_context(generate()),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
            },
        )

    @app.route("/api/sessions", methods=["GET"])
    @rate_limit
    def api_list_sessions():
        """列出所有会话"""
        sessions = chat_service.list_sessions()
        for s in sessions:
            for key in ("created_at", "updated_at"):
                if key in s and s[key] is not None:
                    s[key] = str(s[key])
        return jsonify(sessions)

    @app.route("/api/sessions/delete", methods=["POST"])
    @rate_limit
    def api_delete_session():
        """删除一个会话"""
        data = request.get_json(silent=True) or {}
        session_id = sanitize_session_id((data.get("session_id") or "").strip())
        if session_id:
            chat_service.delete_session(session_id)
            logger.info(f"delete_session: session={session_id}")
        return jsonify({"ok": True})

    @app.route("/api/sessions/rename", methods=["POST"])
    @rate_limit
    def api_rename_session():
        """重命名一个会话"""
        data = request.get_json(silent=True) or {}
        session_id = sanitize_session_id((data.get("session_id") or "").strip())
        title = (data.get("title") or "").strip()[:100]
        if session_id and title:
            chat_service.rename_session(session_id, title)
            logger.info(f"rename_session: session={session_id} title={title}")
        return jsonify({"ok": True})

    @app.route("/api/sessions/<session_id>/messages", methods=["GET"])
    @rate_limit
    def api_session_messages(session_id):
        """获取指定会话的消息列表"""
        from services.database import get_messages
        session_id = sanitize_session_id(session_id)
        msgs = get_messages(session_id)
        user_messages = [m for m in msgs if m["role"] != "system"]
        return jsonify({"messages": user_messages})

    @app.route("/api/messages/update", methods=["POST"])
    @rate_limit
    def api_update_message():
        """更新消息内容（用于发布后追加 URL）"""
        from services.database import append_to_message, get_last_assistant_message_id
        data = request.get_json(silent=True) or {}
        session_id = sanitize_session_id((data.get("session_id") or "").strip())
        content = (data.get("content") or "").strip()
        if not session_id or not content:
            return jsonify({"error": "参数不完整"}), 400
        msg_id = get_last_assistant_message_id(session_id)
        if msg_id:
            append_to_message(msg_id, content)
        return jsonify({"ok": True, "message_id": msg_id})

    @app.route("/api/clear", methods=["POST"])
    @rate_limit
    def api_clear():
        """清空对话历史"""
        data = request.get_json(silent=True) or {}
        session_id = sanitize_session_id((data.get("session_id") or "").strip())
        chat_service.clear(session_id)
        logger.info(f"clear: session={session_id}")
        return jsonify({"reply": "滴～记忆体已清空，梦境重启。"})

    # ================================================================
    # 路由：发布到 textdb
    # ================================================================

    TEXTDB_BASE = "https://textdb.hunluan.space"

    def repair_html(html):
        """修复常见 HTML 结构问题（规则修复，非 AI）"""
        html = re.sub(r'charset=["\']?GB2312["\']?', 'charset="UTF-8"', html, flags=re.IGNORECASE)
        html = re.sub(r'charset=["\']?gbk["\']?', 'charset="UTF-8"', html, flags=re.IGNORECASE)

        if not html.strip().lower().startswith('<!doctype'):
            html = '<!DOCTYPE html>\n' + html

        if '<html' not in html:
            html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<html lang="zh-CN">', 1)
            if '</html>' not in html:
                html += '\n</html>'

        if '<head>' not in html.lower():
            head = '<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n</head>'
            html = re.sub(r'(<html[^>]*>)', r'\1\n' + head, html, count=1)

        if 'viewport' not in html:
            html = re.sub(r'(<head>)', r'\1\n<meta name="viewport" content="width=device-width, initial-scale=1.0">', html, count=1)

        if '<body' not in html.lower():
            head_end = html.lower().find('</head>')
            if head_end != -1:
                html = html[:head_end + 7] + '\n<body>' + html[head_end + 7:]

        # 修复未闭合的标签
        unclosed = []
        for tag in ['div', 'p', 'span', 'section', 'article', 'header', 'footer', 'main', 'nav', 'ul', 'li', 'h1', 'h2', 'h3']:
            opens = len(re.findall(f'<{tag}[\\s>]', html, re.IGNORECASE))
            closes = len(re.findall(f'</{tag}>', html, re.IGNORECASE))
            if opens > closes:
                unclosed.extend([f'</{tag}>'] * (opens - closes))

        if unclosed:
            body_close = html.lower().rfind('</body>')
            if body_close != -1:
                html = html[:body_close] + '\n'.join(unclosed) + '\n' + html[body_close:]
            else:
                html += '\n' + '\n'.join(unclosed) + '\n</body>'

        if '</body>' not in html.lower():
            html += '\n</body>'
        if '</html>' not in html.lower():
            html += '\n</html>'

        html = re.sub(r'<script[^>]*>.*?</script>', '', html, flags=re.DOTALL|re.IGNORECASE)
        return html

    @app.route("/api/publish", methods=["POST"])
    @rate_limit
    def api_publish():
        """将内容发布到 textdb，返回可访问链接"""
        data = request.get_json(silent=True) or {}
        content = (data.get("content") or "").strip()
        pub_type = (data.get("type") or "page").strip()

        if not content:
            return jsonify({"error": "内容为空"}), 400

        if pub_type == "page":
            content = repair_html(content)
            content = chat_service.repair_html(content)

        key = f"qx_{pub_type}_{uuid.uuid4().hex[:8]}"

        logger.info(f"publish: type={pub_type} key={key} content_len={len(content)}")

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
            logger.error(f"publish failed: {e}")
            return jsonify({"error": f"发布失败: {str(e)}"}), 502

        if pub_type == "doc":
            url = f"{TEXTDB_BASE}/md/{key}"
        else:
            url = f"{TEXTDB_BASE}/p/{key}"

        logger.info(f"publish ok: url={url}")
        return jsonify({"key": key, "url": url, "type": pub_type})

    return app


# ================================================================
# 入口
# ================================================================

if __name__ == "__main__":
    Config.validate()
    app = create_app()

    logger.info("=" * 56)
    logger.info("  🤖  千禧梦 · 构成主义聊天")
    logger.info("=" * 56)
    logger.info(f"  🌐  访问地址  http://127.0.0.1:{Config.PORT}")
    logger.info(f"  🧠  模型      {Config.MODEL_NAME}")
    logger.info(f"  🎨  风格      构成主义 × 千禧年梦幻")
    logger.info("=" * 56)

    app.run(debug=Config.DEBUG, host='0.0.0.0', port=Config.PORT)
