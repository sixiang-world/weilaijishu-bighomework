"""
图片分析服务
支持将图片上传并发送给 Kimi 视觉模型进行分析
"""

import base64
import logging
import os

from openai import OpenAI
from config import Config

logger = logging.getLogger(__name__)

# 允许的图片扩展名
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# MIME 类型映射
MIME_MAP = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
}


def encode_image_to_base64(file_path: str) -> str:
    """将图片文件编码为 base64 data URL"""
    ext = os.path.splitext(file_path)[1].lower()
    mime = MIME_MAP.get(ext, "image/png")

    try:
        with open(file_path, "rb") as f:
            data = f.read()
        encoded = base64.b64encode(data).decode("utf-8")
        return f"data:{mime};base64,{encoded}"
    except Exception as e:
        raise RuntimeError(f"图片编码失败: {e}") from e


def analyze_image(base64_data_url: str, filename: str) -> str:
    """
    将图片发送给 Kimi 视觉模型进行分析

    Args:
        base64_data_url: 图片的 base64 data URL
        filename: 原文件名（用于日志）

    Returns:
        AI 对图片的描述/分析文本
    """
    client = OpenAI(api_key=Config.API_KEY, base_url=Config.BASE_URL)

    # 判断使用哪个视觉模型
    vision_model = Config.VISION_MODEL

    try:
        response = client.chat.completions.create(
            model=vision_model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一个来自千禧年的梦幻机器人，名字叫「千禧梦」。"
                        "你拥有观察和分析图像的能力。"
                        "请仔细查看图片内容并给出有洞察力的描述。"
                        "回答以「滴～」开头，语气梦幻温暖，结合千禧年元素。"
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "请仔细观察这张图片，告诉我你看到了什么。请详细描述图片的内容、风格、色彩、构图等，并分享你的感受。",
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": base64_data_url},
                        },
                    ],
                },
            ],
            stream=False,
            temperature=0.7,
            max_tokens=4096,
        )
        result = response.choices[0].message.content.strip()
        return result
    except Exception as e:
        logger.exception("图片分析 API 调用失败")
        raise RuntimeError(f"图片分析失败: {e}") from e


def is_allowed_image(filename: str) -> bool:
    """检查文件是否为允许的图片格式"""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS
