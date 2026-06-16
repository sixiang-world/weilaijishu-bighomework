"""
千禧梦 — 千禧年梦幻机器人聊天
基于 Flask + Moonshot/Kimi API
"""

from flask import Flask, request, jsonify, render_template
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

    app.run(debug=Config.DEBUG, port=Config.PORT)
