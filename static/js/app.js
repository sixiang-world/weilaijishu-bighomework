/* ============================================================
   千禧梦 · 构成主义聊天 — 前端逻辑 v4
   新增：浮动侧边栏 + 桌宠系统
   ============================================================ */

// ================================================================
// 会话管理
// ================================================================
let currentSessionId = 'dream_' + crypto.randomUUID();

// 从 URL 读取 session_id（如 /chat/xxx）
(function() {
    const match = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/);
    if (match) currentSessionId = match[1];
})();
let sessions = [];
let isLoading = false;

// DOM 引用
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const btnSend = document.getElementById('btnSend');
const sidebar = document.getElementById('sidebar');
const sessionList = document.getElementById('sessionList');
const btnNewChat = document.getElementById('btnNewChat');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const btnStop = document.getElementById('btnStop');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// ================================================================
// Markdown 渲染配置
// ================================================================
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            return hljs.highlight(code, { language: lang }).value;
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// SVG 图标模板
const ROBOT_SVG = `<svg viewBox="0 0 40 40" fill="none"><line x1="20" y1="2" x2="20" y2="10" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><circle cx="20" cy="2" r="2" fill="#F5F0E6"/><rect x="6" y="10" width="28" height="22" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="12" y="16" width="6" height="6" fill="#F5F0E6"/><rect x="22" y="16" width="6" height="6" fill="#F5F0E6"/><line x1="14" y1="28" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><rect x="3" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="32" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/></svg>`;
const USER_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="12" r="8" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><rect x="8" y="24" width="24" height="14" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><line x1="4" y1="38" x2="14" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><line x1="36" y1="38" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/></svg>`;
// 扩展 SVG 图标
const FILE_SVG = `<svg viewBox="0 0 24 24" fill="none"><path d="M4 2h10l6 6v14H4V2z" fill="#1A1A1A" stroke="#D62828" stroke-width="2"/><path d="M14 2v6h6" fill="none" stroke="#D62828" stroke-width="2"/><line x1="8" y1="11" x2="16" y2="11" stroke="#F5F0E6" stroke-width="1.5"/><line x1="8" y1="15" x2="16" y2="15" stroke="#F5F0E6" stroke-width="1" opacity="0.4"/><line x1="8" y1="18" x2="13" y2="18" stroke="#F5F0E6" stroke-width="1" opacity="0.4"/></svg>`;
const IMG_FILE_SVG = `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="3" width="20" height="18" rx="2" fill="#1A1A1A" stroke="#D62828" stroke-width="2"/><circle cx="8" cy="9" r="2.5" fill="#D62828"/><path d="M2 17l6-5 5 5 4-4 5 5" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/></svg>`;

// ================================================================
// 命令系统 — @/ 前缀触发内容生成
// ================================================================

const COMMANDS = [
    { cmd: 'doc',  label: '生成文档', icon: 'doc'  },
    { cmd: 'page', label: '生成网页', icon: 'page' },
];

// 候选菜单状态
let commandMenu = null;
let commandMenuIndex = -1;
let commandPrefix = '';

function createCommandMenu() {
    if (commandMenu) return;
    commandMenu = document.createElement('div');
    commandMenu.className = 'command-menu';
    commandMenu.id = 'commandMenu';
    // 插入到 input-zone 内，位于 input-field 上方
    const inputZone = document.querySelector('.input-zone-inner');
    inputZone.style.position = 'relative';
    inputZone.insertBefore(commandMenu, inputZone.firstChild);
}

function showCommandMenu(prefix) {
    if (!commandMenu) createCommandMenu();
    commandPrefix = prefix;
    commandMenuIndex = -1;

    const inputVal = messageInput.value;
    // 用户可能已经输入了部分命令名（如 "@p"），用来过滤
    const partial = inputVal.slice(1).toLowerCase();

    let html = '';
    for (const c of COMMANDS) {
        const matched = !partial || c.cmd.startsWith(partial);
        if (!matched) continue;
        const disabledClass = c.enabled ? '' : ' disabled';
        const disabledHint = c.enabled ? '' : '<span class="command-menu-hint">即将上线</span>';
        html += '<div class="command-menu-item' + disabledClass + '" data-cmd="' + c.cmd + '">'
            + '<div class="command-menu-item-icon">' + icon(c.icon) + '</div>'
            + '<div class="command-menu-item-text">'
            +   '<div class="command-menu-item-label">' + escapeHtml(c.label) + '</div>'
            +   disabledHint
            + '</div></div>';
    }

    if (!html) {
        hideCommandMenu();
        return;
    }

    commandMenu.innerHTML = html;
    commandMenu.classList.add('visible');

    // 点击事件
    commandMenu.querySelectorAll('.command-menu-item:not(.disabled)').forEach(function(item) {
        item.addEventListener('mousedown', function(e) {
            e.preventDefault(); // 阻止 blur 事件先触发
            selectCommand(item.dataset.cmd);
        });
    });
}

function hideCommandMenu() {
    if (commandMenu) {
        commandMenu.classList.remove('visible');
        commandMenuIndex = -1;
    }
}

function selectCommand(cmd) {
    const cmdObj = COMMANDS.find(function(c) { return c.cmd === cmd; });
    if (!cmdObj) return;

    // all commands enabled

    hideCommandMenu();
    messageInput.value = commandPrefix + cmd + ' ';
    messageInput.focus();
    // 光标移到末尾
    messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
}

// 解析输入中的命令（@doc 内容 或 /page 内容）
function parseCommand(text) {
    const match = text.match(/^([@/])(doc|page)\s+(.+)$/);
    if (match) {
        return { prefix: match[1], command: match[2], content: match[3] };
    }
    return null;
}

// 将命令转换为发送给 AI 的 prompt 内容
function resolveCommandContent(parsed) {
    switch (parsed.command) {
        case 'doc':
            return '请生成一篇完整的 Markdown 文档，主题是：' + parsed.content + '。直接输出 Markdown 内容，不要加任何标签或包裹。';
        case 'page':
            return '请生成一个完整的 HTML 网页，主题是：' + parsed.content + '。直接输出完整 HTML 代码，不要加任何标签或包裹。';
        default:
            return parsed.content;
    }
}

// 快捷按钮：一键添加/取消 @命令 前缀
function toggleQuickCmd(cmd) {
    var prefix = '@' + cmd + ' ';
    var val = messageInput.value;
    var btnDoc = document.getElementById('btnQuickDoc');
    var btnPage = document.getElementById('btnQuickPage');
    if (val.startsWith(prefix)) {
        // 第二下取消
        messageInput.value = val.slice(prefix.length);
    } else {
        // 检查是否有其他 @命令 前缀，替换之
        var otherCmd = val.match(/^@(doc|page)\s*/);
        if (otherCmd) {
            messageInput.value = prefix + val.slice(otherCmd[0].length);
        } else {
            messageInput.value = prefix + val;
        }
    }
    // 更新按钮高亮状态
    btnDoc.classList.toggle('active', messageInput.value.startsWith('@doc '));
    btnPage.classList.toggle('active', messageInput.value.startsWith('@page '));
    messageInput.focus();
}

// 输入框监听：显示/隐藏候选菜单 + 同步按钮高亮
messageInput.addEventListener('input', function() {
    const val = messageInput.value;
    if (val === '@' || val === '/') {
        showCommandMenu(val);
    } else if (val.length > 1 && (val[0] === '@' || val[0] === '/')) {
        showCommandMenu(val[0]);
    } else {
        hideCommandMenu();
    }
    // 同步快捷按钮高亮
    var btnDoc = document.getElementById('btnQuickDoc');
    var btnPage = document.getElementById('btnQuickPage');
    if (btnDoc) btnDoc.classList.toggle('active', val.startsWith('@doc '));
    if (btnPage) btnPage.classList.toggle('active', val.startsWith('@page '));
});

messageInput.addEventListener('blur', function() {
    // 延迟隐藏，让 mousedown 事件能先触发
    setTimeout(hideCommandMenu, 150);
});

// 键盘导航候选菜单
messageInput.addEventListener('keydown', function(e) {
    if (!commandMenu || !commandMenu.classList.contains('visible')) return;

    const items = commandMenu.querySelectorAll('.command-menu-item:not(.disabled)');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        commandMenuIndex = Math.min(commandMenuIndex + 1, items.length - 1);
        items.forEach(function(el, i) { el.classList.toggle('active', i === commandMenuIndex); });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        commandMenuIndex = Math.max(commandMenuIndex - 1, 0);
        items.forEach(function(el, i) { el.classList.toggle('active', i === commandMenuIndex); });
    } else if (e.key === 'Enter' && commandMenuIndex >= 0) {
        e.preventDefault();
        selectCommand(items[commandMenuIndex].dataset.cmd);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        hideCommandMenu();
    }
});

// 点击外部关闭
document.addEventListener('click', function(e) {
    if (commandMenu && commandMenu.classList.contains('visible')) {
        if (!e.target.closest('.command-menu') && e.target !== messageInput) {
            hideCommandMenu();
        }
    }
});

// ================================================================
// 桌宠系统
// ================================================================

const petRobot = document.getElementById('petRobot');
const petEmoji = document.getElementById('petEmoji');
const petStatus = document.getElementById('petStatus');

// 像素 emoji 集合 — 千禧年风格（SVG 内联）
const PIXEL_EMOJI = {
    happy:    createPixelEmoji('#D62828', 'happy'),
    thinking: createPixelEmoji('#6366F1', 'thinking'),
    surprise: createPixelEmoji('#D62828', 'surprise'),
    love:     createPixelEmoji('#D62828', 'love'),
    confused: createPixelEmoji('#6366F1', 'confused'),
    cool:     createPixelEmoji('#1A1A1A', 'cool'),
    shy:      createPixelEmoji('#D62828', 'shy'),
    excited:  createPixelEmoji('#D62828', 'excited'),
};

function createPixelEmoji(color, type) {
    const c = color;
    const w = '#F5F0E6';
    const k = '#1A1A1A';

    // 每个 emoji 是一个 48x48 的像素画
    switch (type) {
        case 'happy':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="14" y="16" width="6" height="6" fill="${w}"/>
                <rect x="28" y="16" width="6" height="6" fill="${w}"/>
                <rect x="14" y="28" width="20" height="4" fill="${w}"/>
                <rect x="18" y="28" width="4" height="4" fill="${k}"/>
                <rect x="26" y="28" width="4" height="4" fill="${k}"/>
            </svg>`;
        case 'thinking':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="14" y="16" width="6" height="6" fill="${w}"/>
                <rect x="28" y="16" width="6" height="6" fill="${w}"/>
                <rect x="14" y="18" width="2" height="2" fill="${k}"/>
                <rect x="28" y="18" width="2" height="2" fill="${k}"/>
                <rect x="18" y="30" width="12" height="3" fill="${w}"/>
                <rect x="36" y="10" width="6" height="6" fill="${c}" opacity="0.5"/>
                <rect x="38" y="4" width="4" height="4" fill="${c}" opacity="0.3"/>
            </svg>`;
        case 'surprise':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="14" y="14" width="8" height="8" fill="${w}"/>
                <rect x="26" y="14" width="8" height="8" fill="${w}"/>
                <rect x="16" y="16" width="4" height="4" fill="${k}"/>
                <rect x="28" y="16" width="4" height="4" fill="${k}"/>
                <rect x="20" y="30" width="8" height="8" rx="4" fill="${w}"/>
            </svg>`;
        case 'love':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="12" y="14" width="8" height="6" fill="#FF6B8A"/>
                <rect x="28" y="14" width="8" height="6" fill="#FF6B8A"/>
                <rect x="14" y="12" width="4" height="2" fill="#FF6B8A"/>
                <rect x="30" y="12" width="4" height="2" fill="#FF6B8A"/>
                <rect x="18" y="28" width="12" height="4" fill="${w}"/>
                <rect x="14" y="30" width="4" height="4" fill="#FF6B8A"/>
                <rect x="30" y="30" width="4" height="4" fill="#FF6B8A"/>
            </svg>`;
        case 'confused':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="14" y="16" width="6" height="6" fill="${w}"/>
                <rect x="28" y="14" width="6" height="8" fill="${w}"/>
                <rect x="16" y="28" width="16" height="3" fill="${w}" transform="rotate(-8 24 30)"/>
                <rect x="34" y="6" width="6" height="2" fill="${c}" opacity="0.6"/>
                <rect x="36" y="8" width="2" height="6" fill="${c}" opacity="0.6"/>
            </svg>`;
        case 'cool':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="10" y="14" width="28" height="8" rx="2" fill="${k}"/>
                <rect x="12" y="16" width="10" height="4" fill="#4B4FC7"/>
                <rect x="26" y="16" width="10" height="4" fill="#4B4FC7"/>
                <rect x="18" y="28" width="12" height="3" fill="${w}"/>
                <rect x="14" y="4" width="6" height="6" fill="${c}" opacity="0.4"/>
                <rect x="28" y="4" width="6" height="6" fill="${c}" opacity="0.4"/>
            </svg>`;
        case 'shy':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="14" y="18" width="4" height="4" fill="${w}"/>
                <rect x="30" y="18" width="4" height="4" fill="${w}"/>
                <rect x="10" y="22" width="8" height="4" fill="#FF6B8A" opacity="0.6"/>
                <rect x="30" y="22" width="8" height="4" fill="#FF6B8A" opacity="0.6"/>
                <rect x="20" y="30" width="8" height="3" fill="${w}"/>
                <rect x="22" y="12" width="4" height="2" fill="${w}" opacity="0.4"/>
            </svg>`;
        case 'excited':
            return `<svg viewBox="0 0 48 48" width="48" height="48">
                <rect x="8" y="8" width="32" height="32" rx="4" fill="${c}"/>
                <rect x="12" y="14" width="8" height="8" fill="${w}"/>
                <rect x="28" y="14" width="8" height="8" fill="${w}"/>
                <rect x="14" y="16" width="4" height="4" fill="${k}"/>
                <rect x="30" y="16" width="4" height="4" fill="${k}"/>
                <rect x="16" y="28" width="16" height="6" fill="${w}"/>
                <rect x="4" y="10" width="4" height="4" fill="${c}" opacity="0.5"/>
                <rect x="40" y="10" width="4" height="4" fill="${c}" opacity="0.5"/>
                <rect x="6" y="6" width="2" height="2" fill="${c}" opacity="0.3"/>
                <rect x="40" y="6" width="2" height="2" fill="${c}" opacity="0.3"/>
            </svg>`;
        default:
            return PIXEL_EMOJI.happy;
    }
}

// 圆脸机器人 SVG — 空闲态
function getRobotSVG(state) {
    const bodyColor = '#D62828';
    const faceColor = '#F5F0E6';
    const k = '#1A1A1A';
    const accent = '#6366F1';

    let eyes, mouth, arms, extras;

    switch (state) {
        case 'thinking':
            // 思考：一只眼微闭，手托下巴
            eyes = `
                <rect x="44" y="44" width="10" height="10" fill="${k}"/>
                <rect x="46.5" y="54.5" width="5" height="5" fill="${faceColor}" id="pupil-l"/>
                <rect x="66" y="44" width="10" height="8" fill="${k}"/>
                <rect x="66" y="48" width="10" height="4" fill="${faceColor}"/>
                <rect x="68.5" y="53.5" width="5" height="4" fill="${faceColor}" id="pupil-r"/>
            `;
            mouth = `<rect x="50" y="64" width="14" height="4" fill="${k}" transform="rotate(-5 57 74)"/>`;
            arms = `
                <rect x="18" y="70" width="8" height="28" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="10" y="68" width="12" height="8" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="86" y="56" width="8" height="24" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="82" y="48" width="12" height="12" rx="6" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
            `;
            extras = `
                <rect x="96" y="42" width="6" height="6" fill="${accent}" opacity="0.4"/>
                <rect x="100" y="36" width="4" height="4" fill="${accent}" opacity="0.3"/>
                <rect x="104" y="30" width="3" height="3" fill="${accent}" opacity="0.2"/>
            `;
            break;
        case 'replying':
            // 回复：开心嘴，双手张开
            eyes = `
                <rect x="44" y="44" width="10" height="10" fill="${k}"/>
                <rect x="46.5" y="54.5" width="5" height="5" fill="${faceColor}" id="pupil-l"/>
                <rect x="66" y="44" width="10" height="10" fill="${k}"/>
                <rect x="68.5" y="54.5" width="5" height="5" fill="${faceColor}" id="pupil-r"/>
            `;
            mouth = `
                <rect x="46" y="64" width="22" height="6" fill="${k}"/>
                <rect x="48" y="64" width="18" height="2" fill="${faceColor}"/>
            `;
            arms = `
                <rect x="14" y="62" width="8" height="28" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="6" y="58" width="12" height="8" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="90" y="62" width="8" height="28" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="94" y="58" width="12" height="8" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
            `;
            extras = '';
            break;
        case 'idle':
        default:
            // 空闲：正常眼，微笑，手臂自然下垂
            eyes = `
                <rect x="44" y="44" width="10" height="10" fill="${k}"/>
                <rect x="46.5" y="54.5" width="5" height="5" fill="${faceColor}" id="pupil-l"/>
                <rect x="66" y="44" width="10" height="10" fill="${k}"/>
                <rect x="68.5" y="54.5" width="5" height="5" fill="${faceColor}" id="pupil-r"/>
            `;
            mouth = `<rect x="48" y="64" width="18" height="4" fill="${k}"/>`;
            arms = `
                <rect x="20" y="78" width="8" height="30" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="84" y="78" width="8" height="30" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
            `;
            extras = '';
            break;
    }

    return `<svg viewBox="0 0 112 120" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- 头部 — 圆脸 -->
        <circle cx="56" cy="46" r="32" fill="${faceColor}" stroke="${k}" stroke-width="3"/>

        <!-- 五官组（整体跟随鼠标偏移） -->
        <g id="face-group">
        <!-- 眼睛 -->
        ${eyes}

        <!-- 嘴 -->
        ${mouth}

        <!-- 脸颊装饰 -->
        <rect x="34" y="54" width="8" height="4" rx="2" fill="${bodyColor}" opacity="0.25"/>
        <rect x="72" y="54" width="8" height="4" rx="2" fill="${bodyColor}" opacity="0.25"/>
        </g>

        <!-- 身体 -->
        <rect x="32" y="82" width="48" height="30" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="3"/>
        <rect x="44" y="88" width="24" height="4" fill="${faceColor}" opacity="0.3"/>
        <rect x="44" y="96" width="24" height="4" fill="${faceColor}" opacity="0.2"/>

        <!-- 手臂 -->
        ${arms}

        <!-- 额外装饰 -->
        ${extras}
    </svg>`;
}

// ================================================================
// 构成主义 SVG 图标系统
// ================================================================
const ICONS = {
    // 发布：向上箭头 + 底座
    upload: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M12 3L8 7h3v8h2V7h3L12 3z" fill="#D62828"/><rect x="4" y="17" width="16" height="3" rx="1" fill="#1A1A1A"/></svg>`,
    // 验证：放大镜
    search: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><circle cx="10" cy="10" r="6" stroke="#6366F1" stroke-width="2.5"/><line x1="14.5" y1="14.5" x2="20" y2="20" stroke="#6366F1" stroke-width="2.5" stroke-linecap="square"/></svg>`,
    // 成功：粗对勾
    check: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><rect x="2" y="2" width="20" height="20" rx="2" fill="#1A1A1A"/><path d="M6 12l4 4 8-8" stroke="#D62828" stroke-width="3" stroke-linecap="square" stroke-linejoin="square"/></svg>`,
    // 失败：粗叉号
    error: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><rect x="2" y="2" width="20" height="20" rx="2" fill="#D62828"/><path d="M7 7l10 10M17 7L7 17" stroke="#F5F0E6" stroke-width="2.5" stroke-linecap="square"/></svg>`,
    // 文档：带折角的纸
    doc: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M4 2h10l6 6v14H4V2z" fill="#F5F0E6" stroke="#1A1A1A" stroke-width="2"/><path d="M14 2v6h6" fill="none" stroke="#1A1A1A" stroke-width="2"/><line x1="8" y1="10" x2="16" y2="10" stroke="#D62828" stroke-width="1.5"/><line x1="8" y1="14" x2="16" y2="14" stroke="#1A1A1A" stroke-width="1" opacity="0.3"/><line x1="8" y1="17" x2="13" y2="17" stroke="#1A1A1A" stroke-width="1" opacity="0.3"/></svg>`,
    // 网页：圆形 + 十字
    page: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><circle cx="12" cy="12" r="9" stroke="#1A1A1A" stroke-width="2"/><ellipse cx="12" cy="12" rx="4" ry="9" stroke="#1A1A1A" stroke-width="1.5"/><line x1="3" y1="12" x2="21" y2="12" stroke="#1A1A1A" stroke-width="1.5"/><circle cx="12" cy="12" r="2" fill="#D62828"/></svg>`,
    // 加载：旋转方块
    loading: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke="#D62828" stroke-width="2" stroke-dasharray="6 4"><animateTransform attributeName="transform" type="rotate" values="0 12 12;360 12 12" dur="2s" repeatCount="indefinite"/></rect></svg>`,
    // 文件上传
    docupload: `<svg viewBox="0 0 22 22" fill="none"><path d="M11 2v12a4 4 0 0 0 8 0V7" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><path d="M6 7v8a6 6 0 0 0 12 0V5" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><line x1="11" y1="2" x2="11" y2="4" stroke="#D62828" stroke-width="2" stroke-linecap="square"/></svg>`,
    // 图片上传
    imgupload: `<svg viewBox="0 0 22 22" fill="none"><rect x="2" y="4" width="18" height="14" rx="2" stroke="#F5F0E6" stroke-width="2"/><circle cx="8" cy="9" r="2" fill="#D62828"/><path d="M2 16l6-5 5 5 3-3 5 5" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/></svg>`,
    // 通用文件
    file: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 2h10l6 6v14H4V2z" fill="#1A1A1A" stroke="#D62828" stroke-width="2"/><path d="M14 2v6h6" fill="none" stroke="#D62828" stroke-width="2"/><line x1="8" y1="11" x2="16" y2="11" stroke="#F5F0E6" stroke-width="1.5"/></svg>`,
    // PPT 生成
    pptgen: `<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="2" width="20" height="14" rx="2" fill="#1A1A1A" stroke="#D62828" stroke-width="2"/><line x1="12" y1="2" x2="12" y2="16" stroke="#F5F0E6" stroke-width="1.5"/><line x1="2" y1="9" x2="22" y2="9" stroke="#F5F0E6" stroke-width="1.5"/><rect x="9" y="18" width="6" height="3" fill="#D62828"/><rect x="8" y="21" width="8" height="1" fill="#F5F0E6"/></svg>`,
};

function icon(name) {
    return ICONS[name] || '';
}

// 桌宠状态管理
let petState = 'idle';
let petEmojiTimeout = null;

function setPetState(state) {
    petState = state;
    petRobot.className = 'pet-robot ' + state;
    petRobot.innerHTML = getRobotSVG(state);

    if (state === 'idle') {
        petStatus.textContent = '待命中';
        petStatus.className = 'pet-status';
    } else if (state === 'thinking') {
        petStatus.textContent = '思考中…';
        petStatus.className = 'pet-status active';
    } else if (state === 'replying') {
        petStatus.textContent = '回复中';
        petStatus.className = 'pet-status active';
    }
}

function showPetEmoji(type) {
    const svg = PIXEL_EMOJI[type] || PIXEL_EMOJI.happy;
    petEmoji.innerHTML = svg;
    petEmoji.className = 'pet-emoji show';

    clearTimeout(petEmojiTimeout);
    petEmojiTimeout = setTimeout(() => {
        petEmoji.className = 'pet-emoji hide';
        setTimeout(() => {
            petEmoji.className = 'pet-emoji';
            petEmoji.innerHTML = '';
        }, 400);
    }, 2500);
}

// 点击桌宠彩蛋
let petClickCount = 0;
petRobot.addEventListener('click', function () {
    petClickCount++;
    const keys = Object.keys(PIXEL_EMOJI);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];
    showPetEmoji(randomKey);

    // 特殊彩蛋：连点 5 次
    if (petClickCount >= 5) {
        petClickCount = 0;
        showPetEmoji('love');
        setPetState('replying');
        setTimeout(() => setPetState('idle'), 1500);
    }
});

// 五官整体跟随鼠标 — face-group parallax
let lastFaceOffset = { x: 0, y: 0 };
let faceAnimFrame = null;

function updateFaceFollow(e) {
    const svg = petRobot.querySelector('svg');
    if (!svg) return;

    const faceGroup = document.getElementById('face-group');
    if (!faceGroup) return;

    const svgRect = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const scaleX = viewBox.width / svgRect.width;
    const scaleY = viewBox.height / svgRect.height;

    // 机器人头部中心 (viewBox 坐标)
    const headCX = 56;
    const headCY = 46;

    // 鼠标位置转 SVG 坐标
    const mx = (e.clientX - svgRect.left) * scaleX;
    const my = (e.clientY - svgRect.top) * scaleY;

    // 方向向量
    const dx = mx - headCX;
    const dy = my - headCY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 最大偏移量（五官在脸内可移动的范围）
    const maxOffset = 6;

    let tx, ty;
    if (dist < 5) {
        tx = 0;
        ty = 0;
    } else {
        const angle = Math.atan2(dy, dx);
        const offset = Math.min(maxOffset, dist * 0.04);
        tx = Math.cos(angle) * offset;
        ty = Math.sin(angle) * offset;
    }

    // 平滑过渡（lerp）
    lastFaceOffset.x += (tx - lastFaceOffset.x) * 0.15;
    lastFaceOffset.y += (ty - lastFaceOffset.y) * 0.15;

    faceGroup.setAttribute('transform',
        `translate(${lastFaceOffset.x.toFixed(2)}, ${lastFaceOffset.y.toFixed(2)})`
    );

    // 同时移动瞳孔（眼球内的微追踪）
    const pl = document.getElementById('pupil-l');
    const pr = document.getElementById('pupil-r');
    if (pl && pr) {
        const eyes = [
            { el: pl, cx: 49, cy: 49, R: 5 },
            { el: pr, cx: 71, cy: 49, R: 5 }
        ];
        for (const eye of eyes) {
            const edx = mx - eye.cx;
            const edy = my - eye.cy;
            const eDist = Math.sqrt(edx * edx + edy * edy);
            if (eDist < 2) {
                eye.el.setAttribute('x', eye.cx - 2.5);
                eye.el.setAttribute('y', eye.cy - 2.5);
            } else {
                const maxDist = eye.R - 2.5;
                const eAngle = Math.atan2(edy, edx);
                const eOffset = Math.min(maxDist, eDist * 0.04);
                eye.el.setAttribute('x', (eye.cx + Math.cos(eAngle) * eOffset - 2.5).toFixed(1));
                eye.el.setAttribute('y', (eye.cy + Math.sin(eAngle) * eOffset - 2.5).toFixed(1));
            }
        }
    }
}

// 用 requestAnimationFrame 做平滑循环
document.addEventListener('mousemove', function(e) {
    if (faceAnimFrame) cancelAnimationFrame(faceAnimFrame);
    faceAnimFrame = requestAnimationFrame(() => updateFaceFollow(e));
});

// 初始化桌宠
setPetState('idle');

// ================================================================
// 侧边栏 — 浮动折叠
// ================================================================
let sidebarCollapsed = false;

function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    sidebar.classList.toggle('collapsed', sidebarCollapsed);
    document.body.classList.toggle('sidebar-is-collapsed', sidebarCollapsed);
}

// 移动端：点击遮罩关闭
function closeSidebar() {
    if (window.innerWidth <= 520) {
        sidebar.classList.remove('mobile-open');
        sidebarOverlay.classList.remove('visible');
    }
}

// 移动端 toggle
function toggleSidebarMobile() {
    if (window.innerWidth <= 520) {
        sidebar.classList.toggle('mobile-open');
        sidebarOverlay.classList.toggle('visible', sidebar.classList.contains('mobile-open'));
    } else {
        toggleSidebar();
    }
}

btnToggleSidebar.addEventListener('click', toggleSidebarMobile);

// 点击侧边栏外部关闭（移动端）
document.addEventListener('click', function (e) {
    if (window.innerWidth <= 520 && sidebar.classList.contains('mobile-open')) {
        if (!sidebar.contains(e.target) && !btnToggleSidebar.contains(e.target)) {
            closeSidebar();
        }
    }
});

// 折叠态点击展开
sidebar.addEventListener('click', function (e) {
    if (sidebarCollapsed && window.innerWidth > 520) {
        toggleSidebar();
    }
});

// ================================================================
// 加载会话列表
// ================================================================
async function loadSessions() {
    try {
        const res = await fetch('/api/sessions');
        sessions = await res.json();
        renderSessionList();
    } catch (_) {}
}

function renderSessionList() {
    sessionList.innerHTML = '';
    for (const s of sessions) {
        const li = document.createElement('li');
        li.className = 'session-item' + (s.session_id === currentSessionId ? ' active' : '');
        li.dataset.sessionId = s.session_id;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'session-title';
        titleSpan.textContent = s.title || '新对话';
        titleSpan.addEventListener('dblclick', function () {
            renameSession(s.session_id, this);
        });
        li.appendChild(titleSpan);

        const delBtn = document.createElement('button');
        delBtn.className = 'session-delete';
        delBtn.textContent = '✕';
        delBtn.title = '删除会话';
        delBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            deleteSession(s.session_id);
        });
        li.appendChild(delBtn);

        li.addEventListener('click', function () {
            switchSession(s.session_id);
        });

        sessionList.appendChild(li);
    }
}

// ================================================================
// 会话操作
// ================================================================
async function switchSession(sessionId) {
    if (sessionId === currentSessionId) return;
    currentSessionId = sessionId;
    history.pushState({ sessionId: sessionId }, '', '/chat/' + sessionId);
    closeSidebar();
    await loadChatHistory();
    renderSessionList();
}

async function newSession() {
    currentSessionId = 'dream_' + crypto.randomUUID();
    history.pushState({ sessionId: currentSessionId }, '', '/chat/' + currentSessionId);
    closeSidebar();
    showWelcome();
    messageInput.focus();
    await loadSessions();
}

async function deleteSession(sessionId) {
    if (!confirm('确定要删除这个会话吗？此操作不可撤销。')) return;
    try {
        await fetch('/api/sessions/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
        });
    } catch (_) {}

    if (sessionId === currentSessionId) {
        await newSession();
    } else {
        await loadSessions();
    }
}

async function renameSession(sessionId, titleEl) {
    const oldTitle = titleEl.textContent;
    const newTitle = prompt('重命名会话：', oldTitle);
    if (!newTitle || newTitle === oldTitle) return;

    try {
        await fetch('/api/sessions/rename', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId, title: newTitle }),
        });
        titleEl.textContent = newTitle;
    } catch (_) {}
}

async function loadChatHistory() {
    try {
        const res = await fetch('/api/sessions/' + encodeURIComponent(currentSessionId) + '/messages');
        const data = await res.json();

        chatContainer.innerHTML = '';

        if (data.messages && data.messages.length > 0) {
            let hasUserMessages = false;
            for (const m of data.messages) {
                if (m.role === 'user') {
                    addMessage(m.content, 'user');
                    hasUserMessages = true;
                } else if (m.role === 'assistant') {
                    // 检测 [published:type:url] 标记，恢复发布卡片
                    var pubMatch = m.content.match(/\[published:(doc|page):(https?:\/\/[^\]]+)\]\s*$/);
                    if (pubMatch) {
                        var cleanContent = m.content.replace(/\n?\[published:[^\]]+\]\s*$/, '');
                        // 同时清理 [page]...[/page] / [doc]...[/doc] 标签
                        cleanContent = cleanContent.replace(/\n?\[(doc|page)\][\s\S]*?\[\/(doc|page)\]\s*$/, '').trim();
                        addMessage(cleanContent, 'robot');
                        var lastMsg = chatContainer.querySelector('.message:last-child .msg-content');
                        if (lastMsg) {
                            lastMsg.insertAdjacentHTML('beforeend', renderPublishCard(pubMatch[2], pubMatch[1]));
                        }
                    } else {
                        // 兼容旧数据：检测 [page]...[/page] 或 [doc]...[/doc] 标签
                        var tagMatch = m.content.match(/^([\s\S]*?)\[(doc|page)\]([\s\S]*?)\[\/(doc|page)\]\s*$/);
                        if (tagMatch) {
                            var desc = tagMatch[1].trim();
                            var tagType = tagMatch[2];
                            if (desc) addMessage(desc, 'robot');
                            // 旧数据没有 URL，显示提示
                            var lastMsg2 = chatContainer.querySelector('.message:last-child .msg-content');
                            if (lastMsg2) {
                                lastMsg2.insertAdjacentHTML('beforeend',
                                    '<div class="publish-card"><div class="publish-card-icon">' + icon('doc') + '</div><div class="publish-card-info"><div class="publish-card-label">' + (tagType === 'doc' ? '文档' : '网页') + '内容已生成</div><div class="publish-card-hint">重新发送可重新发布</div></div></div>'
                                );
                            }
                        } else {
                            addMessage(m.content, 'robot');
                        }
                    }
                }
            }
            if (!hasUserMessages) {
                showWelcome();
            }
        } else {
            showWelcome();
        }
        scrollToBottom();
        updateRegenerateButtons();
        addCodeCopyButtons(chatContainer);
    } catch (_) {
        showWelcome();
    }
}

function showWelcome() {
    chatContainer.innerHTML = `
        <div class="welcome" id="welcomeMessage">
            <div class="welcome-icon">
                <svg viewBox="0 0 56 56" fill="none">
                    <line x1="28" y1="2" x2="28" y2="12" stroke="#D62828" stroke-width="3" stroke-linecap="square"/>
                    <circle cx="28" cy="2" r="3.5" fill="#D62828"/>
                    <rect x="8" y="12" width="40" height="34" fill="none" stroke="#1A1A1A" stroke-width="3"/>
                    <rect x="16" y="20" width="8" height="8" fill="#D62828"/>
                    <rect x="32" y="20" width="8" height="8" fill="#D62828"/>
                    <rect x="20" y="36" width="16" height="4" fill="#D62828"/>
                    <rect x="2" y="18" width="8" height="10" fill="none" stroke="#1A1A1A" stroke-width="2.5"/>
                    <rect x="46" y="18" width="8" height="10" fill="none" stroke="#1A1A1A" stroke-width="2.5"/>
                </svg>
                <span class="welcome-glitch">▮▯▮</span>
            </div>
            <h2>你好，旅行者。</h2>
            <p>我是千禧梦，一个从像素梦境中苏醒的机器人。<br>在这个数码次元里，聊聊星空屏保、拨号音、<br>和那些被遗忘的比特之光。</p>
            <div class="welcome-line"></div>
        </div>
    `;
}

// ================================================================
// 发送消息（流式）
// ================================================================
let abortController = null;

async function sendMessage() {
    if (isLoading) return;

    const rawContent = messageInput.value.trim();
    if (!rawContent) return;

    // 解析命令前缀（@doc /page 等）
    const parsed = parseCommand(rawContent);
    let content;
    let displayText = rawContent; // 用户看到的文本

    if (parsed) {
        const cmdObj = COMMANDS.find(function(c) { return c.cmd === parsed.command; });
        content = resolveCommandContent(parsed);
    } else {
        content = rawContent;
    }

    // 立即锁定，防止快速连按 Enter 并发请求
    isLoading = true;

    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) welcomeEl.remove();

    addMessage(displayText, 'user');
    messageInput.value = '';
    hideCommandMenu();
    messageInput.focus();

    // 桌宠进入思考态
    setPetState('thinking');
    showPetEmoji('thinking');

    showLoading();

    // 创建 AbortController
    abortController = new AbortController();

    // 显示停止按钮
    btnStop.style.display = 'inline-block';
    btnSend.style.display = 'none';

    try {
        const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: content,
                display_content: (parsed && content !== rawContent) ? rawContent : undefined,
                session_id: currentSessionId,
            }),
            signal: abortController.signal,
        });

        if (!res.ok) {
            removeLoading();
            setPetState('idle');
            hideStopButton();
            showError('连接中断，请检查网络 …');
            return;
        }

        removeLoading();

        // 桌宠进入回复态
        setPetState('replying');

        // 创建消息容器（带操作栏）
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message robot';
        msgDiv.innerHTML = `
            <div class="msg-avatar">${ROBOT_SVG}</div>
            <div class="msg-body">
                <div class="msg-content streaming" id="streamingMsg"></div>
                <div class="msg-actions">
                    <button class="msg-action-btn" onclick="copyMessage(this)">复制</button>
                    <button class="msg-action-btn" onclick="regenerate(this)">重新生成</button>
                    <div class="msg-action-dropdown"><button class="msg-action-btn">发布 ▾</button><div class="msg-action-menu"><button data-publish="doc">文档</button><button data-publish="page">网页</button></div></div>
                    <span class="msg-time">${timeStr}</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(msgDiv);
        const contentDiv = msgDiv.querySelector('.msg-content');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullReply = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') break;

                try {
                    const parsed = JSON.parse(payload);
                    if (parsed.token) {
                        fullReply += parsed.token;
                        // 实时渲染 markdown
                        contentDiv.innerHTML = renderMarkdown(fullReply);
                        scrollToBottom();
                    }
                } catch (_) {}
            }
        }

        contentDiv.classList.remove('streaming');
        // 最终渲染 + 代码复制按钮
        contentDiv.innerHTML = renderMarkdown(fullReply);
        addCodeCopyButtons(msgDiv);

        // 命令模式：直接发布完整回复
        if (parsed && (parsed.command === 'doc' || parsed.command === 'page')) {
            await publishCommandReply(contentDiv, fullReply, parsed.command);
        } else {
            detectAndPublish(contentDiv, fullReply);
        }

        // 回复完成 — 桌宠弹出一个随机 emoji，然后回到空闲
        const emojiKeys = ['happy', 'surprise', 'excited', 'cool'];
        showPetEmoji(emojiKeys[Math.floor(Math.random() * emojiKeys.length)]);
        setTimeout(() => setPetState('idle'), 800);

        hideStopButton();
        await loadSessions();
        updateRegenerateButtons();

    } catch (err) {
        if (err.name === 'AbortError') {
            // 用户主动停止
            const streaming = document.getElementById('streamingMsg');
            if (streaming) {
                streaming.classList.remove('streaming');
                addCodeCopyButtons(streaming.closest('.message'));
            }
            removeLoading();
            showPetEmoji('confused');
            setTimeout(() => setPetState('idle'), 800);
        } else {
            removeLoading();
            setPetState('idle');
            const streaming = document.getElementById('streamingMsg');
            if (streaming) streaming.closest('.message').remove();
            showError('连接中断，请检查网络 …');
        }
        hideStopButton();
    } finally {
        isLoading = false;
    }
}

function stopGeneration() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
}

function hideStopButton() {
    btnStop.style.display = 'none';
    btnSend.style.display = 'inline-block';
    abortController = null;
}

// ================================================================
// 添加消息
// ================================================================
function addMessage(text, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    const svg = type === 'robot' ? ROBOT_SVG : USER_SVG;
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

    const rendered = type === 'robot' ? renderMarkdown(text) : escapeHtml(text);

    div.innerHTML = `
        <div class="msg-avatar">${svg}</div>
        <div class="msg-body">
            <div class="msg-content">
                ${rendered}
                <div class="msg-actions">
                    <button class="msg-action-btn" onclick="copyMessage(this)">复制</button>
                    ${type === 'robot' ? '<button class="msg-action-btn" onclick="regenerate(this)">重新生成</button>' : ''}
                    ${type === 'robot' ? '<div class="msg-action-dropdown"><button class="msg-action-btn">发布 ▾</button><div class="msg-action-menu"><button data-publish="doc">文档</button><button data-publish="page">网页</button></div></div>' : ''}
                    <span class="msg-time">${timeStr}</span>
                </div>
            </div>
        </div>
    `;

    // 为代码块添加复制按钮
    if (type === 'robot') {
        addCodeCopyButtons(div);
    }

    chatContainer.appendChild(div);
    updateRegenerateButtons();
    scrollToBottom();
}

function renderMarkdown(text) {
    try {
        var raw = marked.parse(text);
        // Strip <style>/<script> from AI-generated HTML to prevent global CSS pollution
        var doc = new DOMParser().parseFromString(raw, 'text/html');
        doc.querySelectorAll('style, script').forEach(function(el) { el.remove(); });
        return doc.body.innerHTML;
    } catch (e) {
        return escapeHtml(text);
    }
}

function addCodeCopyButtons(container) {
    const blocks = container.querySelectorAll('pre code');
    blocks.forEach(function(block) {
        const pre = block.parentElement;
        if (pre.querySelector('.code-copy-btn')) return;
        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.textContent = '复制';
        btn.addEventListener('click', function() {
            navigator.clipboard.writeText(block.textContent).then(function() {
                btn.textContent = '已复制';
                btn.classList.add('copied');
                setTimeout(function() {
                    btn.textContent = '复制';
                    btn.classList.remove('copied');
                }, 1500);
            });
        });
        pre.style.position = 'relative';
        pre.appendChild(btn);
    });
}

function copyMessage(btn) {
    const msgBody = btn.closest('.msg-body');
    const content = msgBody.querySelector('.msg-content');
    // 克隆内容，去掉操作栏和发布卡片，只复制正文
    const clone = content.cloneNode(true);
    clone.querySelectorAll('.msg-actions, .publish-card').forEach(function(el) { el.remove(); });
    navigator.clipboard.writeText(clone.textContent.trim()).then(function() {
        btn.textContent = '已复制';
        btn.classList.add('copied');
        setTimeout(function() {
            btn.textContent = '复制';
            btn.classList.remove('copied');
        }, 1500);
    });
}

function regenerate(btn) {
    const msgDiv = btn.closest('.message');
    const allMessages = chatContainer.querySelectorAll('.message');
    let lastUserText = '';
    for (const msg of allMessages) {
        if (msg.classList.contains('user')) {
            const contentClone = msg.querySelector('.msg-content').cloneNode(true);
            contentClone.querySelectorAll('.msg-actions, .publish-card').forEach(function(el) { el.remove(); });
            lastUserText = contentClone.textContent.trim();
        }
        if (msg === msgDiv) break;
    }
    let next = msgDiv;
    while (next) {
        const toRemove = next;
        next = next.nextElementSibling;
        toRemove.remove();
    }
    updateRegenerateButtons();
    if (lastUserText) {
        streamRegenerate(lastUserText);
    }
}

async function streamRegenerate(userText) {
    if (isLoading) return;
    isLoading = true;

    setPetState('thinking');
    showPetEmoji('thinking');
    showLoading();

    abortController = new AbortController();
    btnStop.style.display = 'inline-block';
    btnSend.style.display = 'none';

    try {
        const res = await fetch('/api/chat/regenerate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: userText, session_id: currentSessionId }),
            signal: abortController.signal,
        });

        if (!res.ok) {
            removeLoading();
            setPetState('idle');
            hideStopButton();
            showError('连接中断，请检查网络 …');
            isLoading = false;
            return;
        }

        removeLoading();
        setPetState('replying');

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message robot';
        msgDiv.innerHTML = `
            <div class="msg-avatar">${ROBOT_SVG}</div>
            <div class="msg-body">
                <div class="msg-content streaming" id="streamingMsg"></div>
                <div class="msg-actions">
                    <button class="msg-action-btn" onclick="copyMessage(this)">复制</button>
                    <button class="msg-action-btn" onclick="regenerate(this)">重新生成</button>
                    <div class="msg-action-dropdown"><button class="msg-action-btn">发布 ▾</button><div class="msg-action-menu"><button data-publish="doc">文档</button><button data-publish="page">网页</button></div></div>
                    <span class="msg-time">${timeStr}</span>
                </div>
            </div>
        `;
        chatContainer.appendChild(msgDiv);
        const contentDiv = msgDiv.querySelector('.msg-content');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullReply = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]') break;
                try {
                    const parsed = JSON.parse(payload);
                    if (parsed.token) {
                        fullReply += parsed.token;
                        contentDiv.innerHTML = renderMarkdown(fullReply);
                        scrollToBottom();
                    }
                } catch (_) {}
            }
        }

	        contentDiv.classList.remove('streaming');
	        contentDiv.innerHTML = renderMarkdown(fullReply);
	        addCodeCopyButtons(msgDiv);
	        detectAndPublish(contentDiv, fullReply);

	        const emojiKeys = ['happy', 'surprise', 'excited', 'cool'];
        showPetEmoji(emojiKeys[Math.floor(Math.random() * emojiKeys.length)]);
        setTimeout(() => setPetState('idle'), 800);
        hideStopButton();
        isLoading = false;
        await loadSessions();
        updateRegenerateButtons();
    } catch (err) {
        if (err.name === 'AbortError') {
            const streaming = document.getElementById('streamingMsg');
            if (streaming) {
                streaming.classList.remove('streaming');
                addCodeCopyButtons(streaming.closest('.message'));
            }
            removeLoading();
            showPetEmoji('confused');
            setTimeout(() => setPetState('idle'), 800);
        } else {
            removeLoading();
            setPetState('idle');
            const streaming = document.getElementById('streamingMsg');
            if (streaming) streaming.closest('.message').remove();
            showError('连接中断，请检查网络 …');
        }
        hideStopButton();
        isLoading = false;
    }
}


// ================================================================
// 发布系统 — doc/page
// ================================================================

async function publishContent(content, type, onStage) {
    // 网页类型由后端 /api/publish 统一做「规则修复 + AI 二次验证修复」，
    // 前端不再重复修复，避免两套规则叠加产生不可预期的结果。
    if (type === 'page') {
        if (typeof onStage === 'function') onStage('repairing');
    }
    try {
        const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: content, type: type }),
        });
        const data = await res.json();
        if (data.url) {
            return data.url;
        }
        return null;
    } catch (e) {
        return null;
    }
}

function renderPublishCard(url, type) {
    const labels = { doc: '文档已生成', page: '网页已生成' };
    const iconMap = { doc: 'doc', page: 'page' };
    const label = labels[type] || '页面已生成';
    const iconSvg = icon(iconMap[type] || 'page');

    return '<div class="publish-card" data-type="' + type + '">' +
        '<div class="publish-card-icon">' + iconSvg + '</div>' +
        '<div class="publish-card-info">' +
            '<div class="publish-card-label">' + label + '</div>' +
            '<div class="publish-card-url">' + url + '</div>' +
        '</div>' +
        '<div class="publish-card-actions">' +
            '<a href="' + url + '" target="_blank" class="publish-card-btn">打开预览</a>' +
            '<button class="publish-card-btn" onclick="copyUrl(this, \'' + url + '\')">复制链接</button>' +
        '</div>' +
    '</div>';
}

function copyUrl(btn, url) {
    navigator.clipboard.writeText(url).then(function() {
        btn.textContent = '已复制';
        setTimeout(function() { btn.textContent = '复制链接'; }, 1500);
    });
}

// 持久化发布 URL 到数据库（追加到 assistant 消息末尾）
function savePublishUrl(url, type) {
    var label = type === 'doc' ? '文档' : type === 'page' ? '网页' : type;
    // 读取当前 assistant 消息内容，追加发布标记
    fetch('/api/messages/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            session_id: currentSessionId,
            content: '[published:' + type + ':' + url + ']',
        }),
    }).catch(function() {});
}

// 命令模式发布：直接把 AI 完整回复作为指定类型内容发布
async function publishCommandReply(contentDiv, fullReply, type) {
    // 清空消息内容，只保留说明文字（去掉 AI 可能额外加的解释）
    var typeName = type === 'doc' ? '文档' : '网页';
    contentDiv.innerHTML = '<p style="opacity:0.6">正在生成' + typeName + '...</p>';

    // 阶段 1：正在发布
    const loadingEl = document.createElement('div');
    loadingEl.className = 'publish-card loading';
    loadingEl.innerHTML = '<div class="publish-card-icon">' + icon('upload') + '</div><div class="publish-card-info"><div class="publish-card-label">正在发布...</div><div class="publish-card-hint">' + typeName + '生成中，请稍候</div></div>';
    contentDiv.innerHTML = '';
    contentDiv.appendChild(loadingEl);
    setPetState('thinking');
    showPetEmoji('thinking');

    const url = await publishContent(fullReply, type);

    loadingEl.remove();

    if (url) {
        contentDiv.innerHTML = '<p style="opacity:0.6">' + typeName + '已生成 ✨</p>';
        contentDiv.insertAdjacentHTML('beforeend', renderPublishCard(url, type));
        addCodeCopyButtons(contentDiv.closest('.message') || contentDiv);
        // 持久化发布 URL 到数据库
        savePublishUrl(url, type);
        setPetState('replying');
        showPetEmoji('excited');
        setTimeout(function() { setPetState('idle'); }, 1200);
    } else {
        contentDiv.innerHTML = '';
        contentDiv.insertAdjacentHTML('beforeend',
            '<div class="publish-card error"><div class="publish-card-icon">' + icon('error') + '</div><div class="publish-card-info"><div class="publish-card-label">发布失败</div><div class="publish-card-hint">请检查后重试</div></div></div>'
        );
        showPetEmoji('confused');
        setTimeout(function() { setPetState('idle'); }, 1200);
    }
}

// 检测消息中的 [doc]/[page] 标记并自动发布
async function detectAndPublish(msgContentDiv, fullReply) {
    // 使用原始 AI 回复文本（而非 DOM textContent）提取内容，
    // 避免"复制/重新生成/发布/文档/幻灯片/网页"等操作按钮文字被混入。
    const text = fullReply || msgContentDiv.textContent;
    const types = ['doc', 'page'];

    for (const type of types) {
        const openTag = `[${type}]`;
        const closeTag = `[/${type}]`;
        const startIdx = text.indexOf(openTag);
        const endIdx = text.indexOf(closeTag);

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
            const rawContent = text.substring(startIdx + openTag.length, endIdx).trim();
            if (rawContent) {
                // 移除标记文本，保留说明文字
                const beforeText = text.substring(0, startIdx).trim();
                if (beforeText) {
                    msgContentDiv.innerHTML = renderMarkdown(beforeText);
                } else {
                    msgContentDiv.innerHTML = '';
                }

                // 阶段 1：正在发布
                const loadingEl = document.createElement('div');
                loadingEl.className = 'publish-card loading';
                loadingEl.innerHTML = '<div class="publish-card-icon">' + icon('upload') + '</div><div class="publish-card-info"><div class="publish-card-label">正在发布...</div><div class="publish-card-hint">内容生成完毕，准备上传</div></div>';
                msgContentDiv.appendChild(loadingEl);
                setPetState('thinking');
                showPetEmoji('thinking');

                // 发布（page 类型会在请求前触发 onStage('repairing')）
                const url = await publishContent(rawContent, type, function(stage) {
                    if (stage === 'repairing') {
                        loadingEl.innerHTML = '<div class="publish-card-icon">' + icon('search') + '</div><div class="publish-card-info"><div class="publish-card-label">AI 正在二次验证...</div><div class="publish-card-hint">检查并修复 HTML 结构</div></div>';
                        showPetEmoji('confused');
                    }
                });
                loadingEl.remove();

                if (url) {
                    msgContentDiv.insertAdjacentHTML('beforeend', renderPublishCard(url, type));
                    addCodeCopyButtons(msgContentDiv.closest('.message') || msgContentDiv);
                    // 持久化发布 URL 到数据库
                    savePublishUrl(url, type);
                    // 发布成功
                    setPetState('replying');
                    showPetEmoji('excited');
                    setTimeout(function() { setPetState('idle'); }, 1200);
                } else {
                    msgContentDiv.insertAdjacentHTML('beforeend',
                        '<div class="publish-card error"><div class="publish-card-icon">' + icon('error') + '</div><div class="publish-card-info"><div class="publish-card-label">发布失败</div></div></div>'
                    );
                    showPetEmoji('confused');
                    setTimeout(function() { setPetState('idle'); }, 1200);
                }
                return;
            }
        }
    }
}

// 手动发布当前消息内容
async function publishMessage(btn, type) {
    const msgBody = btn.closest('.msg-body') || btn.closest('.msg-content');
    const contentDiv = msgBody.querySelector('.msg-content');
    // 克隆内容，去掉操作栏和发布卡片，只取正文纯文本
    const clone = contentDiv.cloneNode(true);
    clone.querySelectorAll('.msg-actions, .publish-card').forEach(function(el) { el.remove(); });
    const text = clone.textContent.trim();

    btn.textContent = '发布中...';
    btn.disabled = true;
    setPetState('thinking');
    showPetEmoji('thinking');

    const url = await publishContent(text, type, function(stage) {
        if (stage === 'repairing') {
            btn.textContent = 'AI验证中...';
            showPetEmoji('confused');
        }
    });

    if (url) {
        contentDiv.insertAdjacentHTML('beforeend', renderPublishCard(url, type));
        btn.textContent = '已发布';
        setPetState('replying');
        showPetEmoji('excited');
        setTimeout(function() { setPetState('idle'); }, 1200);
    } else {
        btn.textContent = '失败';
        showPetEmoji('confused');
        setTimeout(function() { btn.textContent = '发布'; btn.disabled = false; setPetState('idle'); }, 2000);
    }
}

// ================================================================
// 加载动画
// ================================================================
let loadingEl = null;

function showLoading() {
    isLoading = true;
    btnSend.disabled = true;
    btnSend.style.opacity = '0.45';

    loadingEl = document.createElement('div');
    loadingEl.className = 'loading-msg';
    loadingEl.id = 'loadingEl';
    loadingEl.innerHTML = `
        <div class="loading-avatar">${ROBOT_SVG}</div>
        <div class="loading-bars">
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
            <div class="loading-bar"></div>
        </div>
    `;
    chatContainer.appendChild(loadingEl);
    scrollToBottom();
}

function removeLoading() {
    isLoading = false;
    btnSend.disabled = false;
    btnSend.style.opacity = '1';
    if (loadingEl) {
        loadingEl.remove();
        loadingEl = null;
    }
}

// ================================================================
// 错误提示
// ================================================================
function showError(text) {
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = '◆ ' + text;
    chatContainer.appendChild(toast);
    scrollToBottom();
    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 3500);
}

// ================================================================
// 清空对话
// ================================================================
async function clearChat() {
    if (isLoading) return;
    if (!confirm('确定要清空当前对话历史吗？')) return;

    try {
        await fetch('/api/clear', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: currentSessionId }),
        });
    } catch (_) {}

    showWelcome();
}

// ================================================================
// CRT 滤镜
// ================================================================
const crtOverlay = document.getElementById('crtOverlay');
const btnCrtToggle = document.getElementById('btnCrtToggle');
let crtEnabled = false;

btnCrtToggle.addEventListener('click', function () {
    crtEnabled = !crtEnabled;
    crtOverlay.classList.toggle('active', crtEnabled);
    btnCrtToggle.classList.toggle('active', crtEnabled);
    btnCrtToggle.textContent = crtEnabled ? '⊟' : '⊞';
});

const crtBoot = document.getElementById('crtBoot');
if (crtBoot) {
    crtBoot.addEventListener('animationend', function () {
        this.remove();
    });
}

// ================================================================
// 工具函数
// ================================================================
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// 只在最后一条机器人消息上显示「重新生成」按钮
function updateRegenerateButtons() {
    const allMsgs = chatContainer.querySelectorAll('.message.robot');
    allMsgs.forEach(function(msg) {
        const btn = msg.querySelector('.msg-action-btn[onclick*="regenerate"]');
        if (btn) btn.style.display = 'none';
    });
    const last = allMsgs[allMsgs.length - 1];
    if (last) {
        const btn = last.querySelector('.msg-action-btn[onclick*="regenerate"]');
        if (btn) btn.style.display = '';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
// 事件绑定
// ================================================================
messageInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

btnNewChat.addEventListener('click', newSession);

// 发布按钮事件委托（全局一次绑定）
document.addEventListener('click', function(e) {
    const btn = e.target.closest('[data-publish]');
    if (btn) {
        const type = btn.dataset.publish;
        const msgContent = btn.closest('.msg-content');
        if (msgContent) {
            publishMessage(btn, type);
        }
    }
});

// 移动端遮罩点击关闭侧边栏
sidebarOverlay.addEventListener('click', function() {
    closeSidebar();
});

// ================================================================
// 启动
// ================================================================

// 浏览器前进/后退时同步会话
window.addEventListener('popstate', function(e) {
    const match = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/);
    if (match && match[1] !== currentSessionId) {
        currentSessionId = match[1];
        loadChatHistory();
        renderSessionList();
    }
});

// 启动：加载会话列表，如果 URL 有 session_id 则自动加载该会话历史
var urlMatch = window.location.pathname.match(/^\/chat\/([a-zA-Z0-9_-]+)/);
if (urlMatch) {
    loadChatHistory();
}
loadSessions().then(function() {
    renderSessionList();
});
messageInput.focus();

// ================================================================
// 文件上传功能 — 文档 & 图片
// ================================================================

// 上传文档
function uploadDocument() {
    document.getElementById('docUploadInput').click();
}

// 上传图片
function uploadImage() {
    document.getElementById('imgUploadInput').click();
}

// 文档上传处理
document.getElementById('docUploadInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const btn = document.getElementById('btnUploadDoc');
    btn.classList.add('loading');

    // 显示上传进度
    const progressEl = document.createElement('div');
    progressEl.className = 'upload-progress';
    progressEl.innerHTML = '<div class="upload-progress-text">■ 上传中 ' + escapeHtml(file.name) + '</div><div class="upload-progress-bar"></div>';
    const inputZone = document.querySelector('.input-zone-inner');
    inputZone.parentNode.insertBefore(progressEl, inputZone.nextSibling);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', currentSessionId);
    formData.append('action', 'summarize');

    try {
        const res = await fetch('/api/upload/document', {
            method: 'POST',
            body: formData,
        });

        progressEl.remove();

        if (!res.ok) {
            btn.classList.remove('loading');
            showError('文档上传失败，请重试');
            return;
        }

        const data = await res.json();

        // 移除欢迎消息
        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) welcomeEl.remove();

        // 添加用户消息（文件名）
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        const userMsg = document.createElement('div');
        userMsg.className = 'message user';
        userMsg.innerHTML = '<div class="msg-avatar">' + USER_SVG + '</div><div class="msg-body"><div class="msg-content">📎 ' + escapeHtml(file.name) + '</div><div class="msg-actions"><span class="msg-time">' + timeStr + '</span></div></div>';
        chatContainer.appendChild(userMsg);

        // 添加机器人分析结果
        const robotMsg = document.createElement('div');
        robotMsg.className = 'message robot';
        robotMsg.innerHTML = '<div class="msg-avatar">' + ROBOT_SVG + '</div><div class="msg-body"><div class="msg-content" id="fileAnalysisMsg"></div><div class="msg-actions"><button class="msg-action-btn" onclick="copyMessage(this)">复制</button><span class="msg-time">' + timeStr + '</span></div></div>';
        chatContainer.appendChild(robotMsg);
        const contentDiv = robotMsg.querySelector('.msg-content');

        // 文件信息前缀
        const ext = file.name.split('.').pop().toUpperCase();
        const prefixHtml = '<div class="file-analysis-msg">'
            + '<div class="file-analysis-icon">' + FILE_SVG + '</div>'
            + '<div class="file-analysis-body">'
            +   '<div class="file-analysis-header">'
            +     '<span class="file-analysis-name">' + escapeHtml(file.name) + '</span>'
            +     '<span class="file-analysis-type">' + ext + '</span>'
            +   '</div>'
            + '</div></div>';

        contentDiv.innerHTML = prefixHtml + '<div style="margin-top:6px">' + renderMarkdown(data.analysis || '分析完成。') + '</div>';
        addCodeCopyButtons(robotMsg);

        // 更新会话列表
        await loadSessions();
        updateRegenerateButtons();
        scrollToBottom();

        btn.classList.remove('loading');
    } catch (err) {
        progressEl.remove();
        btn.classList.remove('loading');
        showError('文档上传出错：' + err.message);
    }

    this.value = '';
});

// 图片上传处理
document.getElementById('imgUploadInput').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const btn = document.getElementById('btnUploadImg');
    btn.classList.add('loading');

    // 创建本地缩略图预览
    const previewUrl = URL.createObjectURL(file);

    // 显示上传进度
    const progressEl = document.createElement('div');
    progressEl.className = 'upload-progress';
    progressEl.innerHTML = '<div class="upload-progress-text">■ 上传中 ' + escapeHtml(file.name) + '</div><div class="upload-progress-bar"></div>';
    const inputZone = document.querySelector('.input-zone-inner');
    inputZone.parentNode.insertBefore(progressEl, inputZone.nextSibling);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', currentSessionId);

    try {
        const res = await fetch('/api/upload/image', {
            method: 'POST',
            body: formData,
        });

        progressEl.remove();

        if (!res.ok) {
            btn.classList.remove('loading');
            URL.revokeObjectURL(previewUrl);
            showError('图片上传失败，请重试');
            return;
        }

        const data = await res.json();

        // 移除欢迎消息
        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl) welcomeEl.remove();

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        // 添加用户消息（图片缩略图）
        const userMsg = document.createElement('div');
        userMsg.className = 'message user';
        userMsg.innerHTML = '<div class="msg-avatar">' + USER_SVG + '</div><div class="msg-body"><div class="msg-content"><div class="image-preview-wrap"><img src="' + previewUrl + '" alt="' + escapeHtml(file.name) + '"></div></div><div class="msg-actions"><span class="msg-time">' + timeStr + '</span></div></div>';
        chatContainer.appendChild(userMsg);

        // 添加机器人分析结果
        const robotMsg = document.createElement('div');
        robotMsg.className = 'message robot';
        robotMsg.innerHTML = '<div class="msg-avatar">' + ROBOT_SVG + '</div><div class="msg-body"><div class="msg-content" id="imgAnalysisMsg"></div><div class="msg-actions"><button class="msg-action-btn" onclick="copyMessage(this)">复制</button><span class="msg-time">' + timeStr + '</span></div></div>';
        chatContainer.appendChild(robotMsg);
        const contentDiv = robotMsg.querySelector('.msg-content');

        // 图片分析结果渲染
        const imgLabelHtml = '<div class="image-analysis-label">' + IMG_FILE_SVG + '<span>' + escapeHtml(file.name) + '</span></div>';
        contentDiv.innerHTML = imgLabelHtml + '<div>' + renderMarkdown(data.analysis || '图片分析完成。') + '</div>';
        addCodeCopyButtons(robotMsg);

        // 清理 object URL
        setTimeout(function() { URL.revokeObjectURL(previewUrl); }, 5000);

        await loadSessions();
        updateRegenerateButtons();
        scrollToBottom();

        btn.classList.remove('loading');
    } catch (err) {
        progressEl.remove();
        btn.classList.remove('loading');
        URL.revokeObjectURL(previewUrl);
        showError('图片上传出错：' + err.message);
    }

    this.value = '';
});

// ================================================================
// PPT 生成功能
// ================================================================
async function generatePPT() {
    // 检查输入框中是否有主题文字
    let topic = messageInput.value.trim();
    if (topic.startsWith('@ppt ') || topic.startsWith('/ppt ')) {
        topic = topic.slice(5).trim();
    }
    if (!topic) {
        topic = prompt('请输入 PPT 主题：');
        if (!topic) return;
    }

    if (isLoading) return;
    isLoading = true;

    // 移除欢迎消息
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) welcomeEl.remove();

    // 添加用户消息
    addMessage('@生成PPT ' + topic, 'user');
    messageInput.value = '';
    messageInput.focus();

    setPetState('thinking');
    showPetEmoji('thinking');
    showLoading();

    try {
        const res = await fetch('/api/ppt/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                session_id: currentSessionId
            }),
        });

        removeLoading();

        if (!res.ok) {
            setPetState('idle');
            showError('PPT 生成失败，请重试');
            isLoading = false;
            return;
        }

        setPetState('replying');

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message robot';
        msgDiv.innerHTML = '<div class="msg-avatar">' + ROBOT_SVG + '</div>'
            + '<div class="msg-body">'
            +   '<div class="msg-content streaming" id="streamingPpt"></div>'
            +   '<div class="msg-actions">'
            +     '<button class="msg-action-btn" onclick="copyMessage(this)">复制</button>'
            +     '<span class="msg-time">' + timeStr + '</span>'
            +   '</div>'
            + '</div>';
        chatContainer.appendChild(msgDiv);
        const contentDiv = msgDiv.querySelector('.msg-content');

        // 尝试流式解析
        let fullMarkdown = '';
        if (res.headers.get('content-type') && res.headers.get('content-type').includes('text/event-stream')) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const payload = line.slice(6).trim();
                    if (payload === '[DONE]') break;
                    try {
                        const parsed = JSON.parse(payload);
                        if (parsed.token) {
                            fullMarkdown += parsed.token;
                            contentDiv.innerHTML = renderMarkdown(fullMarkdown);
                            scrollToBottom();
                        }
                    } catch (_) {}
                }
            }
        } else {
            // 非流式响应
            const data = await res.json();
            fullMarkdown = data.markdown || '';
            contentDiv.innerHTML = renderMarkdown(fullMarkdown);
        }

        contentDiv.classList.remove('streaming');

        // 添加 PPT 主题标签 + Slidev 构建按钮
        const topicBadge = '<div class="ppt-topic-badge">■ PPT: ' + escapeHtml(topic) + '</div>';
        const buildBtnHtml = '<div class="ppt-build-area">'
            + '<button class="ppt-build-btn" onclick="startSlidevBuild(\'' + encodeURIComponent(topic) + '\', this)">'
            +   '<svg viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="14" height="10" rx="1" stroke="#F5F0E6" stroke-width="1.5"/><line x1="8" y1="1" x2="8" y2="11" stroke="#F5F0E6" stroke-width="1"/><line x1="1" y1="6" x2="15" y2="6" stroke="#F5F0E6" stroke-width="1"/><rect x="6" y="12" width="4" height="2" fill="#D62828"/></svg>'
            + ' 构建 Slidev'
            + '</button>'
            + '</div>';

        contentDiv.insertAdjacentHTML('beforeend', topicBadge + buildBtnHtml);
        addCodeCopyButtons(msgDiv);

        showPetEmoji('excited');
        setTimeout(function() { setPetState('idle'); }, 1200);
        isLoading = false;
        await loadSessions();
        updateRegenerateButtons();
        scrollToBottom();

    } catch (err) {
        removeLoading();
        setPetState('idle');
        showError('PPT 生成出错：' + err.message);
        isLoading = false;
    }
}

// Slidev 构建入口
async function startSlidevBuild(topicEncoded, btn) {
    const topic = decodeURIComponent(topicEncoded);
    btn.textContent = '构建中…';
    btn.disabled = true;

    try {
        const res = await fetch('/api/ppt/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                topic: topic,
                session_id: currentSessionId
            }),
        });

        const data = await res.json();
        if (data.success && data.url) {
            // 添加构建完成卡片
            const buildArea = btn.closest('.ppt-build-area');
            if (buildArea) {
                buildArea.innerHTML = '<div class="publish-card">'
                    + '<div class="publish-card-icon">' + icon('ppt') + '</div>'
                    + '<div class="publish-card-info">'
                    +   '<div class="publish-card-label">PPT 已构建</div>'
                    +   '<div class="publish-card-url">' + escapeHtml(data.url) + '</div>'
                    + '</div>'
                    + '<div class="publish-card-actions">'
                    +   '<a href="' + data.url + '" target="_blank" class="publish-card-btn">打开预览</a>'
                    +   '<button class="publish-card-btn" onclick="copyUrl(this, \'' + data.url + '\')">复制链接</button>'
                    + '</div>'
                    + '</div>';
            }
            showPetEmoji('excited');
            setTimeout(function() { setPetState('idle'); }, 1200);
        } else {
            btn.textContent = '构建失败';
            setTimeout(function() {
                btn.textContent = '构建 Slidev';
                btn.disabled = false;
            }, 2000);
        }
    } catch (err) {
        btn.textContent = '构建失败';
        setTimeout(function() {
            btn.textContent = '构建 Slidev';
            btn.disabled = false;
        }, 2000);
    }
}
