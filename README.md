# 千禧梦 · 构成主义聊天

一个来自千禧年的梦幻机器人 `千禧梦`，以 El Lissitzky 式构成主义风格呈现的 AI 聊天应用。

---

## 项目结构

```
未来技术期末大作业/
├── app.py                      # Flask 应用入口
├── config.py                   # 配置管理（从 .env 加载）
├── requirements.txt            # Python 依赖
├── start.bat                   # Windows 一键启动脚本
├── .env                        # 环境变量（API Key，不提交 Git）
├── .env.example                # 环境变量模板
├── .gitignore
├── services/
│   ├── __init__.py
│   └── chat_service.py         # 按会话隔离的聊天业务逻辑
├── templates/
│   └── index.html              # 构成主义聊天界面
└── static/
    ├── css/
    │   └── style.css           # 构成主义样式表
    └── js/
        └── app.js              # 前端交互逻辑
```

## 快速开始

### 1. 配置 API Key

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 Moonshot / Kimi API Key：

```env
MOONSHOT_API_KEY=sk-your-api-key-here
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
MOONSHOT_MODEL=moonshot-v1-8k
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 启动

**Windows**：双击 `start.bat`

**命令行**：
```bash
python app.py
```

浏览器访问 `http://127.0.0.1:5000`。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Flask 3.0 |
| 跨域 | flask-cors |
| LLM 客户端 | OpenAI SDK（兼容 Moonshot/Kimi） |
| 配置管理 | python-dotenv |
| 前端 | 纯 HTML + CSS + JavaScript（无框架） |
| 字体 | 系统字体栈（Arial Black / Impact / Helvetica Neue） |
| 图标 | 内联 SVG（无 emoji，无外部库） |

---

## API 接口

### `POST /api/chat` — 发送消息

**请求**：
```json
{
  "content": "用户消息内容",
  "session_id": "dream_abc123"
}
```

**响应**：
```json
{
  "reply": "滴～在数字信号的涟漪中捕捉到了你的问候……",
  "session_id": "dream_abc123"
}
```

### `POST /api/clear` — 清空对话

**请求**：
```json
{
  "session_id": "dream_abc123"
}
```

**响应**：
```json
{
  "reply": "滴～记忆体已清空，梦境重启。"
}
```

### `GET /` — 聊天页面

返回构成主义风格的聊天界面。

---

## 机器人人设

**名字**：千禧梦（Millennium Dream）

**身份**：一个来自千禧年的梦幻机器人，从像素梦境中苏醒。

**特征**：
- 每次回复以 `滴～` 开头（千禧年机器人启动音）
- 说话梦幻、温暖、充满想象力
- 常提及千禧年元素：像素画、拨号上网、MSN、电子宠物、MP3、星空屏保、CRT 屏幕……
- 语气温柔，偶尔诗意，把科技和诗意混合在一起

## 设计风格：构成主义

受 El Lissitzky 式苏联构成主义宣传画启发，适配为现代聊天界面：

- **色板**：革命红 `#D62828` / 纯黑 `#1A1A1A`（仅结构层）/ 米白 `#F5F0E6` / 靛蓝 `#6366F1`
- **字形**：粗重无衬线，斜置大字，系统字体栈
- **布局**：clip-path 对角裁切、对角线条纹背景、skew 变换
- **交互**：鼠标跟随红色切割光束、hover 斜切滑动、红色块/三角旋转
- **图标**：几何 SVG（方形机器人、圆形人物），无 emoji

---

## 后端架构亮点

- **会话隔离**：`ChatService` 按 `session_id` 以字典管理对话历史，多用户互不干扰
- **环境变量**：API Key 通过 `.env` 管理，`.gitignore` 防止泄露
- **统一契约**：前端 → `/api/chat` + `/api/clear`，全链路字段名一致

---

## 功能

- ✅ 发送消息（Enter 键 / 按钮）
- ✅ 清空对话（同步后端清空记忆体）
- ✅ 加载动画（红色跳动几何柱）
- ✅ 错误提示（红色震动条）
- ✅ 消息自动滚动到底部
- ✅ 移动端响应式（≤520px 自适应）
- ✅ 真正的多会话隔离
