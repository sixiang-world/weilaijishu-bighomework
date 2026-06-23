"""
文档解析与分析服务
支持 PDF / Word (.docx) / TXT 文件解析，并通过 Kimi API 进行分析
"""

import os
import logging

from openai import OpenAI
from config import Config

logger = logging.getLogger(__name__)

# ============================================================
# 文件解析
# ============================================================


def extract_text_from_pdf(file_path: str) -> str:
    """使用 PyMuPDF 提取 PDF 文本"""
    import fitz  # PyMuPDF

    text_parts = []
    try:
        doc = fitz.open(file_path)
        for page in doc:
            text_parts.append(page.get_text())
        doc.close()
    except Exception as e:
        raise RuntimeError(f"PDF 解析失败: {e}") from e

    full_text = "\n".join(text_parts).strip()
    if not full_text:
        raise RuntimeError("PDF 文件未能提取到文本内容（可能为扫描件或图片型 PDF）")
    return full_text


def extract_text_from_docx(file_path: str) -> str:
    """使用 python-docx 提取 Word 文档文本"""
    from docx import Document

    try:
        doc = Document(file_path)
        text_parts = [p.text for p in doc.paragraphs if p.text.strip()]
        full_text = "\n".join(text_parts).strip()
        if not full_text:
            raise RuntimeError("Word 文件未能提取到文本内容")
        return full_text
    except Exception as e:
        raise RuntimeError(f"Word 解析失败: {e}") from e


def extract_text_from_txt(file_path: str) -> str:
    """直接读取 UTF-8 文本文件"""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        if not text:
            raise RuntimeError("TXT 文件为空")
        return text
    except UnicodeDecodeError:
        # 尝试其他常见编码
        for encoding in ("gbk", "gb2312", "latin-1"):
            try:
                with open(file_path, "r", encoding=encoding) as f:
                    text = f.read().strip()
                if text:
                    return text
            except Exception:
                continue
        raise RuntimeError("TXT 文件编码无法识别")


def extract_text(file_path: str, filename: str) -> str:
    """根据文件扩展名自动选择解析方法"""
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext == ".txt":
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def get_file_ext(filename: str) -> str:
    """获取文件扩展名（小写）"""
    return os.path.splitext(filename)[1].lower()


# ============================================================
# AI 分析
# ============================================================

ANALYSIS_PROMPTS = {
    "summarize": (
        "请对以下文档内容进行总结，提取核心要点和关键信息。\n"
        "要求：\n"
        "1. 用简洁的语言概括文档主旨\n"
        "2. 列出 3-5 个核心要点\n"
        "3. 如有数据或结论，请重点标注\n"
        "4. 使用「千禧梦」机器人的语气，以「滴～」开头\n\n"
        "文档内容：\n{content}"
    ),
    "analyze": (
        "请对以下文档内容进行深度分析，提供专业见解。\n"
        "要求：\n"
        "1. 分析文档的核心论点与论据\n"
        "2. 指出文档中的亮点与不足\n"
        "3. 提供改进建议或延伸思考\n"
        "4. 使用「千禧梦」机器人的语气，以「滴～」开头\n\n"
        "文档内容：\n{content}"
    ),
    "qa": (
        "请根据以下文档内容回答用户的问题。\n"
        "要求：\n"
        "1. 基于文档内容给出准确回答\n"
        "2. 如果文档中没有相关信息，请明确说明\n"
        "3. 引用文档内容时标注相关段落\n"
        "4. 使用「千禧梦」机器人的语气，以「滴～」开头\n\n"
        "文档内容：\n{content}\n\n"
        "用户问题：{question}"
    ),
}


def analyze_document(content: str, action: str = "summarize", question: str = "") -> str:
    """
    将提取的文本发送给 Kimi API 进行分析

    Args:
        content: 提取的文档文本
        action: 分析模式 (summarize / analyze / qa)
        question: qa 模式下用户的问题

    Returns:
        AI 分析结果文本
    """
    if action not in ANALYSIS_PROMPTS:
        action = "summarize"

    prompt_template = ANALYSIS_PROMPTS[action]
    prompt = prompt_template.format(content=content, question=question)

    client = OpenAI(api_key=Config.API_KEY, base_url=Config.BASE_URL)

    try:
        response = client.chat.completions.create(
            model=Config.MODEL_NAME,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "你是一个来自千禧年的梦幻机器人，名字叫「千禧梦」。"
                        "你拥有扫描并分析文档的能力，回答以「滴～」开头。"
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            stream=False,
            temperature=0.7,
            max_tokens=4096,
        )
        result = response.choices[0].message.content.strip()
        return result
    except Exception as e:
        logger.exception("文档分析 API 调用失败")
        raise RuntimeError(f"AI 分析失败: {e}") from e
