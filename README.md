# 猫猫 AI 聊天界面设计项目

## 项目结构

```
cat-chat/
├── app.py                           # Flask 后端主程序
├── requirements.txt                 # Python 依赖
├── design-spec.md                   # 设计规范文档
├── README.md                        # 项目说明（本文件）
├── templates/                       # HTML 模板
│   └── index.html                  # 主页面（像素游戏风格）
├── original/                        # 原始文件备份
│   └── index-original.html
└── design-demos/                    # 设计演示
    ├── index.html                   # 三版对比页面
    ├── roulette-pixel-game.html     # 版本一：像素游戏风格
    ├── reference-warm-healing.html  # 版本二：Duolingo 风格
    └── designer-karim-rashid.html   # 版本三：Karim Rashid 风格
```

## 快速开始

### 1. 安装依赖

```bash
cd D:\JSY\cat-chat
pip install -r requirements.txt
```

### 2. 启动应用

```bash
python app.py
```

启动后访问：http://127.0.0.1:5000

### 3. 配置说明

在 `app.py` 中修改以下配置：

```python
# API 配置
API_KEY = "你的Kimi API Key"
BASE_URL = "https://api.moonshot.cn/v1"
MODEL_NAME = "moonshot-v1-8k"
```

## 技术栈

**后端**：
- Flask 3.0 - Web 框架
- OpenAI SDK - Kimi API 客户端
- Python 3.8+

**前端**：
- 纯 HTML + CSS + JavaScript
- 像素游戏风格设计
- 响应式布局

## API 接口

### POST /chat
发送消息

**请求**：
```json
{
  "message": "用户消息",
  "session_id": "session_xxx"
}
```

**响应**：
```json
{
  "success": true,
  "reply": "喵喵～猫猫的回复内容"
}
```

### POST /clear
清空对话历史

**请求**：
```json
{
  "session_id": "session_xxx"
}
```

**响应**：
```json
{
  "success": true,
  "message": "喵喵～对话已清空！"
}
```

## 设计流程

本项目遵循 huashu-design 技能的完整流程：

### Phase 1: 澄清需求和设计方向
- 目标受众：年轻人/学生群体
- 情感基调：温暖治愈
- 改进维度：视觉层级、配色方案、交互细节、信息密度

### Phase 2: 顾问式重述和问题诊断
- 诊断原文件的核心问题：
  1. 使用紫色渐变（AI slop 重灾区）
  2. 视觉温度偏冷，与"温暖治愈"定位不符
  3. 视觉层级不够清晰
  4. 缺少品牌辨识度

### Phase 3: 固化设计 spec
详见 `design-spec.md`

### Phase 4: 三套逻辑并行设计

**逻辑一：秒数轮盘（🎲 随机强制）**
- 抽中第 9 号风格：像素游戏横版叙事
- 强制打破模型的确定性偏好
- 风格还原度：70%（像素插画降级为 CSS 几何方块）

**逻辑二：现实参照（🏆 标杆迁移）**
- 参照案例：Duolingo
- 理由：目标用户高度重合、情感调性匹配、设计经过验证
- 配色调整：绿色系 → 暖橙/奶油色系

**逻辑三：最佳设计师（🧠 顶级定制）**
- 选择设计师：Karim Rashid（工业设计大师）
- 设计哲学："Technorganic"（技术有机）——科技与生命的融合
- 核心特征：有机曲线、千禧粉、未来感

### Phase 5: 展示三版真实视觉让用户选择
打开 `design-demos/index.html` 查看三版对比

### Phase 6: 选定版本深化
等待用户选择后进行

## 三个版本对比

| 维度 | 像素游戏版 | Duolingo 版 | Karim Rashid 版 |
|------|-----------|------------|----------------|
| 配色 | 暖橙+金黄+草地绿 | 温暖橙+奶油色 | 千禧粉+奶油白 |
| 温度 | 怀旧温馨 | 友好温暖 | 柔和浪漫 |
| 字体 | VT323（像素字体） | Nunito（圆润无衬线） | Outfit（几何无衬线） |
| 形状 | 方形像素、硬边框 | 大圆角、凸起按钮 | 有机曲线、流动形态 |
| 适用 | 年轻玩家、复古爱好者 | 大众用户、教育场景 | 设计爱好者、高端定位 |

## 最终选择

**已选择版本**：像素游戏风格（轮盘随机）

**最终文件**：`D:\JSY\cat-chat\index.html`

### 优化要点

1. **修正 API 响应字段**：`data.response` → `data.reply`（与后端 API 保持一致）
2. **增强按钮交互反馈**：
   - hover 时微微上移
   - active 时按下效果
   - 保持像素风格的阴影层次
3. **优化像素化视觉效果**：
   - 容器添加像素化边框
   - 添加像素装饰元素
   - 网格背景营造游戏感
4. **添加微妙动画**：
   - 猫猫头像呼吸动画（float）
   - 金币旋转动画（spin）
   - 心跳脉动动画（pulse）
5. **保持所有功能完整**：
   - ✅ 发送消息（Enter 键或按钮）
   - ✅ 清空对话
   - ✅ 显示加载动画
   - ✅ 错误提示
   - ✅ 消息自动滚动到底部
   - ✅ Session ID 生成
   - ✅ 金币计数

### 设计亮点

1. **温暖治愈 × 像素游戏**：完美平衡了"温暖治愈"的情感调性与"像素游戏"的视觉风格
2. **暖色调配色**：避免了冷色调（太空紫），使用暖橙、金黄、草地绿营造温馨感
3. **游戏化元素克制**：保留了游戏 HUD 和金币计数，但不喧宾夺主
4. **功能性优先**：所有 JavaScript 功能完整保留，API 接口正确
5. **反 AI Slop**：避免了紫色渐变、过度装饰等 AI 默认模式

### 如何使用

**打开文件**：
```
D:\JSY\cat-chat\index.html
```

双击打开即可在浏览器中查看。

**后端要求**：
- API 端点：`POST /chat` 和 `POST /clear`
- 响应格式：
  ```json
  {
    "success": true,
    "reply": "猫猫的回复内容"
  }
  ```
