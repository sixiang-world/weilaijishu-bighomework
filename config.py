"""
应用配置管理
从环境变量 / .env 文件加载配置
"""

import os
from dotenv import load_dotenv

# 加载 .env 文件
load_dotenv()


class Config:
    """应用配置"""

    # Moonshot / Kimi API
    API_KEY = os.getenv("MOONSHOT_API_KEY", "")
    BASE_URL = os.getenv("MOONSHOT_BASE_URL", "https://api.moonshot.cn/v1")
    MODEL_NAME = os.getenv("MOONSHOT_MODEL", "moonshot-v1-8k")

    # Flask
    DEBUG = os.getenv("FLASK_DEBUG", "true").lower() == "true"
    PORT = int(os.getenv("FLASK_PORT", "5000"))

    @classmethod
    def validate(cls):
        """验证必要配置是否存在"""
        if not cls.API_KEY:
            raise ValueError(
                "❌ 未配置 MOONSHOT_API_KEY！\n"
                "请复制 .env.example 为 .env 并填入你的 API Key"
            )
