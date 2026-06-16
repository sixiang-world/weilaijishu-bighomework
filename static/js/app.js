/* ============================================================
   千禧梦 · 构成主义聊天 — 前端逻辑 v4
   新增：浮动侧边栏 + 桌宠系统
   ============================================================ */

// ================================================================
// 会话管理
// ================================================================
let currentSessionId = 'dream_' + Math.random().toString(36).substring(2, 11);
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

// SVG 图标模板
const ROBOT_SVG = `<svg viewBox="0 0 40 40" fill="none"><line x1="20" y1="2" x2="20" y2="10" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><circle cx="20" cy="2" r="2" fill="#F5F0E6"/><rect x="6" y="10" width="28" height="22" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="12" y="16" width="6" height="6" fill="#F5F0E6"/><rect x="22" y="16" width="6" height="6" fill="#F5F0E6"/><line x1="14" y1="28" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><rect x="3" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="32" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/></svg>`;
const USER_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="12" r="8" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><rect x="8" y="24" width="24" height="14" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><line x1="4" y1="38" x2="14" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><line x1="36" y1="38" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/></svg>`;

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
                <rect x="20" y="64" width="8" height="30" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
                <rect x="84" y="64" width="8" height="30" rx="4" fill="${bodyColor}" stroke="${k}" stroke-width="2"/>
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
    }
}

// 移动端 toggle
function toggleSidebarMobile() {
    if (window.innerWidth <= 520) {
        sidebar.classList.toggle('mobile-open');
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
    closeSidebar();
    await loadChatHistory();
    renderSessionList();
}

async function newSession() {
    currentSessionId = 'dream_' + Math.random().toString(36).substring(2, 11);
    closeSidebar();
    showWelcome();
    messageInput.focus();
    await loadSessions();
}

async function deleteSession(sessionId) {
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
                    addMessage(m.content, 'robot');
                }
            }
            if (!hasUserMessages) {
                showWelcome();
            }
        } else {
            showWelcome();
        }
        scrollToBottom();
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
// 打字机引擎
// ================================================================
let typewriterQueue = '';
let typewriterResolve = null;
let typewriterElement = null;
let typewriterRunning = false;

function startTypewriter(element) {
    typewriterQueue = '';
    typewriterRunning = true;
    typewriterElement = element;
    element.textContent = '';
    if (!window._typewriterLoop) {
        window._typewriterLoop = typewriterLoop();
    }
}

function feedTypewriter(text) {
    typewriterQueue += text;
}

function waitTypewriterDone() {
    return new Promise((resolve) => {
        if (typewriterQueue.length === 0) {
            typewriterRunning = false;
            resolve();
        } else {
            typewriterResolve = resolve;
        }
    });
}

async function typewriterLoop() {
    const PUNCTUATION = new Set(['。', '！', '？', '…', '～', '.', '!', '?', '\n']);
    const PAUSE_PUNCTUATION = 120;
    const PAUSE_COMMA = 60;
    const CHAR_DELAY = 28;

    while (true) {
        if (typewriterQueue.length > 0 && typewriterElement) {
            const char = typewriterQueue.charAt(0);
            typewriterQueue = typewriterQueue.slice(1);
            typewriterElement.textContent += char;
            scrollToBottom();

            if (char === '\n') {
                await sleep(PAUSE_PUNCTUATION);
            } else if (PUNCTUATION.has(char)) {
                await sleep(PAUSE_PUNCTUATION + Math.random() * 60);
            } else if (char === '，' || char === ',' || char === '；') {
                await sleep(PAUSE_COMMA + Math.random() * 30);
            } else {
                await sleep(CHAR_DELAY + Math.random() * 20);
            }
        } else {
            if (!typewriterRunning && typewriterQueue.length === 0) {
                if (typewriterResolve) {
                    typewriterResolve();
                    typewriterResolve = null;
                }
                await sleep(100);
            } else {
                await sleep(30);
            }
        }
    }
}

function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

// ================================================================
// 发送消息（流式）
// ================================================================
async function sendMessage() {
    if (isLoading) return;

    const content = messageInput.value.trim();
    if (!content) return;

    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) welcomeEl.remove();

    addMessage(content, 'user');
    messageInput.value = '';
    messageInput.focus();

    // 桌宠进入思考态
    setPetState('thinking');
    showPetEmoji('thinking');

    showLoading();

    try {
        const res = await fetch('/api/chat/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: content,
                session_id: currentSessionId,
            }),
        });

        if (!res.ok) {
            removeLoading();
            setPetState('idle');
            showError('连接中断，请检查网络 …');
            return;
        }

        removeLoading();

        // 桌宠进入回复态
        setPetState('replying');

        const msgDiv = document.createElement('div');
        msgDiv.className = 'message robot';
        msgDiv.innerHTML = `
            <div class="msg-avatar">${ROBOT_SVG}</div>
            <div class="msg-content streaming" id="streamingMsg"></div>
        `;
        chatContainer.appendChild(msgDiv);
        const contentDiv = msgDiv.querySelector('.msg-content');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullReply = '';

        startTypewriter(contentDiv);

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
                        feedTypewriter(parsed.token);
                    }
                } catch (_) {}
            }
        }

        typewriterRunning = false;
        await waitTypewriterDone();
        contentDiv.classList.remove('streaming');

        // 回复完成 — 桌宠弹出一个随机 emoji，然后回到空闲
        const emojiKeys = ['happy', 'surprise', 'excited', 'cool'];
        showPetEmoji(emojiKeys[Math.floor(Math.random() * emojiKeys.length)]);
        setTimeout(() => setPetState('idle'), 800);

        await loadSessions();

    } catch (err) {
        removeLoading();
        setPetState('idle');
        typewriterRunning = false;
        typewriterQueue = '';
        const streaming = document.getElementById('streamingMsg');
        if (streaming) streaming.closest('.message').remove();
        showError('连接中断，请检查网络 …');
    }
}

// ================================================================
// 添加消息
// ================================================================
function addMessage(text, type) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    const svg = type === 'robot' ? ROBOT_SVG : USER_SVG;
    div.innerHTML = `
        <div class="msg-avatar">${svg}</div>
        <div class="msg-content">${escapeHtml(text)}</div>
    `;
    chatContainer.appendChild(div);
    scrollToBottom();
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
// 鼠标跟随光束
// ================================================================
document.addEventListener('mousemove', function (e) {
    document.documentElement.style.setProperty('--mx', e.clientX + 'px');
    document.documentElement.style.setProperty('--my', e.clientY + 'px');
});

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

// ================================================================
// 启动
// ================================================================
loadSessions();
messageInput.focus();
