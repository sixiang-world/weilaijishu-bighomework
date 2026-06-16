@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 千禧梦 · 构成主义聊天

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║    🤖  千禧梦 · 构成主义聊天                   ║
echo  ║    MILLENNIUM DREAM · CONSTRUCTIVISM          ║
echo  ╚══════════════════════════════════════════════╝
echo.

echo  📁 当前目录: %CD%
echo.

:: 检查 Python
echo  🔍 检查 Python 环境...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  ❌ 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)
echo  ✅ Python 环境正常
echo.

:: 检查 .env 文件
if not exist .env (
    echo  ⚠  未找到 .env 文件，正在从 .env.example 创建...
    copy .env.example .env >nul 2>&1
    echo  📝 请编辑 .env 文件，填入你的 MOONSHOT_API_KEY
    pause
    exit /b 1
)

:: 安装依赖
echo  🔍 检查依赖...
pip show Flask >nul 2>&1
if %errorlevel% neq 0 (
    echo  📦 正在安装依赖...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo  ❌ 依赖安装失败
        pause
        exit /b 1
    )
)
echo  ✅ 依赖已就绪
echo.

:: 启动应用
echo  🚀 启动服务...
echo.
python app.py

pause
