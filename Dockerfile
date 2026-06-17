# ================================================================
# 千禧梦 · 构成主义聊天 — Dockerfile
# 基于 Python 3.12-slim，多阶段构建
# ================================================================

# ---------- 构建阶段 ----------
FROM python:3.12-slim AS builder

WORKDIR /app

# 安装依赖（利用 Docker 层缓存）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---------- 运行阶段 ----------
FROM python:3.12-slim

WORKDIR /app

# 安装 Node.js（Slidev 构建需要）
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制已安装的包
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制应用代码
COPY app.py config.py ./
COPY services/ ./services/
COPY static/ ./static/
COPY templates/ ./templates/

# 创建非 root 用户运行
RUN groupadd -r app && useradd -r -g app -d /app -s /sbin/nologin app \
    && mkdir -p /home/app/.npm /tmp/slidev_npm_cache \
    && chown -R app:app /app /home/app/.npm /tmp/slidev_npm_cache
USER app

# 容器端口
EXPOSE 5000

# 启动命令
CMD ["python", "app.py"]
