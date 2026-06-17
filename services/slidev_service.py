"""
Slidev 构建服务
将 AI 生成的 Slidev Markdown 转换为单个自包含 HTML 文件
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile

logger = logging.getLogger(__name__)

# Slidev 项目模板文件
PACKAGE_JSON = json.dumps({
    "name": "slidev-build",
    "private": True,
    "type": "module",
    "scripts": {
        "build": "slidev build --base / --out dist"
    },
    "dependencies": {
        "@slidev/cli": "latest",
        "@slidev/theme-default": "latest",
        "vite": "^5.0.0",
        "vite-plugin-singlefile": "^2.0.0"
    }
}, indent=2)

VITE_CONFIG = '''\
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: "esnext",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
'''

# Slidev 配置：禁用 Google Fonts CDN，使用系统字体
SLIDEV_CONFIG = '''\
theme: default
fonts:
  sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  mono: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
download: false
exportFilename: index
'''


def build_slidev(markdown_content: str, timeout: int = 120) -> str:
    """将 Slidev Markdown 构建为单个自包含 HTML 文件"""
    # 共享 npm 缓存目录，避免每次都重新下载依赖（首次约 50-200MB）
    npm_cache_dir = os.path.join(tempfile.gettempdir(), "slidev_npm_cache")
    os.makedirs(npm_cache_dir, exist_ok=True)

    tmp_dir = tempfile.mkdtemp(prefix="slidev_")

    try:
        # 1. 写入 slides.md
        slides_path = os.path.join(tmp_dir, "slides.md")
        with open(slides_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)

        # 2. 写入 package.json
        pkg_path = os.path.join(tmp_dir, "package.json")
        with open(pkg_path, "w", encoding="utf-8") as f:
            f.write(PACKAGE_JSON)

        # 3. 写入 vite.config.ts
        vite_path = os.path.join(tmp_dir, "vite.config.ts")
        with open(vite_path, "w", encoding="utf-8") as f:
            f.write(VITE_CONFIG)

        # 4. 写入 slidev.config.ts（禁用 CDN 字体）
        slidev_config_path = os.path.join(tmp_dir, "slidev.config.ts")
        with open(slidev_config_path, "w", encoding="utf-8") as f:
            f.write(f"import {{ defineConfig }} from '@slidev/cli'\n"
                    f"export default defineConfig({{ \n"
                    f"  theme: 'default',\n"
                    f"  fonts: {{\n"
                    f"    sans: 'system-ui, -apple-system, sans-serif',\n"
                    f"    mono: 'ui-monospace, monospace',\n"
                    f"  }},\n"
                    f"}})\n")

        # 5. npm install（使用共享缓存加速后续构建）
        logger.info("Slidev: npm install ...")
        npm_install = subprocess.run(
            ["npm", "install", "--no-audit", "--no-fund", "--cache", npm_cache_dir],
            cwd=tmp_dir,
            capture_output=True,
            text=True,
            timeout=120,
        )
        if npm_install.returncode != 0:
            raise RuntimeError(f"npm install 失败:\n{npm_install.stderr[-500:]}")

        # 6. slidev build
        logger.info("Slidev: building ...")
        build_result = subprocess.run(
            ["npx", "slidev", "build", "--base", "/", "--out", "dist"],
            cwd=tmp_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if build_result.returncode != 0:
            raise RuntimeError(f"slidev build 失败:\n{build_result.stderr[-800:]}")

        # 7. 读取构建产物
        dist_dir = os.path.join(tmp_dir, "dist")
        index_html = os.path.join(dist_dir, "index.html")

        if not os.path.exists(index_html):
            # 列出 dist 目录内容帮助调试
            dist_files = os.listdir(dist_dir) if os.path.exists(dist_dir) else []
            raise RuntimeError(
                f"构建产物 index.html 不存在。dist 目录内容: {dist_files}"
            )

        with open(index_html, "r", encoding="utf-8") as f:
            html = f.read()

        # 8. 如果 vite-plugin-singlefile 没有完全内联，尝试手动内联关键资源
        html = _inline_remaining_assets(html, dist_dir)

        logger.info(f"Slidev: 构建成功，HTML 大小 {len(html)} bytes")
        return html

    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Slidev 构建超时（{timeout}s）")
    finally:
        # 清理临时目录
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _inline_remaining_assets(html: str, dist_dir: str) -> str:
    """
    尝试内联 dist 目录中未被 vite-plugin-singlefile 内联的资源
    主要处理 CSS 文件和小型 JS 文件
    """
    import re

    # 内联 CSS 文件引用
    css_pattern = re.compile(
        r'<link\s+[^>]*href="([^"]*\.css)"[^>]*/?>',
        re.IGNORECASE,
    )

    def replace_css(match):
        css_path = match.group(1)
        if css_path.startswith(("http://", "https://", "data:")):
            return match.group(0)
        # 路径遍历防护：规范化路径并验证在 dist_dir 内
        full_path = os.path.normpath(os.path.join(dist_dir, css_path.lstrip("/")))
        if not full_path.startswith(os.path.normpath(dist_dir)):
            return match.group(0)
        try:
            if os.path.exists(full_path):
                with open(full_path, "r", encoding="utf-8") as f:
                    css_content = f.read()
                return f"<style>{css_content}</style>"
        except (OSError, UnicodeDecodeError):
            pass
        return match.group(0)

    html = css_pattern.sub(replace_css, html)

    # 内联 JS 文件引用（仅小型文件）
    js_pattern = re.compile(
        r'<script\s+[^>]*src="([^"]*\.js)"[^>]*></script>',
        re.IGNORECASE,
    )

    def replace_js(match):
        js_path = match.group(1)
        if js_path.startswith(("http://", "https://", "data:")):
            return match.group(0)
        # 路径遍历防护
        full_path = os.path.normpath(os.path.join(dist_dir, js_path.lstrip("/")))
        if not full_path.startswith(os.path.normpath(dist_dir)):
            return match.group(0)
        try:
            if os.path.exists(full_path):
                file_size = os.path.getsize(full_path)
                if file_size < 500_000:  # 只内联 <500KB 的 JS
                    with open(full_path, "r", encoding="utf-8") as f:
                        js_content = f.read()
                    return f"<script>{js_content}</script>"
        except (OSError, UnicodeDecodeError):
            pass
        return match.group(0)

    html = js_pattern.sub(replace_js, html)

    return html
