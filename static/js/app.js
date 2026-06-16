/* ============================================================
   千禧梦 · 构成主义聊天 — 前端逻辑 v3
   新增：SSE 流式输出 + 打字机效果 + 多会话管理
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
const welcomeMessage = document.getElementById('welcomeMessage');
const sidebar = document.getElementById('sidebar');
const sessionList = document.getElementById('sessionList');
const btnNewChat = document.getElementById('btnNewChat');
const btnToggleSidebar = document.getElementById('btnToggleSidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

// SVG 图标模板
const ROBOT_SVG = `<svg viewBox="0 0 40 40" fill="none"><line x1="20" y1="2" x2="20" y2="10" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><circle cx="20" cy="2" r="2" fill="#F5F0E6"/><rect x="6" y="10" width="28" height="22" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="12" y="16" width="6" height="6" fill="#F5F0E6"/><rect x="22" y="16" width="6" height="6" fill="#F5F0E6"/><line x1="14" y1="28" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><rect x="3" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="32" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/></svg>`;
const USER_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="12" r="8" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><rect x="8" y="24" width="24" height="14" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><line x1="4" y1="38" x2="14" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><line x1="36" y1="38" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/></svg>`;

// ================================================================
// 加载会话列表
// ================================================================
async function loadSessions() {
    try {
        const res = await fetch('/api/sessions');
        sessions = await res.json();
        renderSessionList();
    } catch (_) {
        // 静默失败
    }
}

function renderSessionList() {
    sessionList.innerHTML = '';
    for (const s of sessions) {
        const li = document.createElement('li');
        li.className = 'session-item' + (s.session_id === currentSessionId ? ' active' : '');
        li.dataset.sessionId = s.session_id;

        // 标题
        const titleSpan = document.createElement('span');
        titleSpan.className = 'session-title';
        titleSpan.textContent = s.title || '新对话';
        titleSpan.addEventListener('dblclick', function () {
            renameSession(s.session_id, this);
        });
        li.appendChild(titleSpan);

        // 删除按钮
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
    // 重置聊天区域为欢迎页面
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
        // 如果删除的是当前会话，切换到新会话
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
            // 找到第一条非 system 消息的位置
            let hasUserMessages = false;
            for (const m of data.messages) {
                if (m.role === 'user') {
                    addMessage(m.content, 'user');
                    hasUserMessages = true;
                } else if (m.role === 'assistant') {
                    addMessage(m.content, 'robot');
                }
            }
            // 如果没有用户消息，显示欢迎
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
// 侧边栏
// ================================================================
function toggleSidebar() {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('visible');
}

function closeSidebar() {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('visible');
}

// ================================================================
// 打字机引擎 — 逐字输出效果
// ================================================================
let typewriterQueue = '';
let typewriterResolve = null;
let typewriterElement = null;
let typewriterRunning = false;

/**
 * 启动打字机，绑定到指定 DOM 元素
 */
function startTypewriter(element) {
    typewriterQueue = '';
    typewriterRunning = true;
    typewriterElement = element;
    element.textContent = '';
    if (!window._typewriterLoop) {
        window._typewriterLoop = typewriterLoop();
    }
}

/**
 * 向打字机队列追加文本
 */
function feedTypewriter(text) {
    typewriterQueue += text;
}

/**
 * 等待打字机队列消费完毕
 */
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

/**
 * 打字机后台循环
 */
async function typewriterLoop() {
    const PUNCTUATION = new Set(['。', '！', '？', '…', '～', '.', '!', '?', '\n']);
    const PAUSE_PUNCTUATION = 120;    // 句末停顿 (ms)
    const PAUSE_COMMA = 60;           // 逗号停顿
    const CHAR_DELAY = 28;            // 普通字符延迟

    while (true) {
        if (typewriterQueue.length > 0 && typewriterElement) {
            const char = typewriterQueue.charAt(0);
            typewriterQueue = typewriterQueue.slice(1);

            typewriterElement.textContent += char;
            scrollToBottom();

            // 根据字符类型决定延迟
            if (char === '\n') {
                await sleep(PAUSE_PUNCTUATION);
            } else if (PUNCTUATION.has(char)) {
                await sleep(PAUSE_PUNCTUATION + Math.random() * 60);
            } else if (char === '，' || char === ',' || char === '；' || char === '；') {
                await sleep(PAUSE_COMMA + Math.random() * 30);
            } else {
                await sleep(CHAR_DELAY + Math.random() * 20);
            }
        } else {
            // 队列为空，检查是否结束
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

    // 移除欢迎消息
    const welcomeEl = document.getElementById('welcomeMessage');
    if (welcomeEl) welcomeEl.remove();

    // 添加用户消息
    addMessage(content, 'user');
    messageInput.value = '';
    messageInput.focus();

    // 显示加载动画（先占位）
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
            showError('连接中断，请检查网络 …');
            return;
        }

        // 创建机器人消息占位
        removeLoading();
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message robot';
        msgDiv.innerHTML = `
            <div class="msg-avatar">${ROBOT_SVG}</div>
            <div class="msg-content streaming" id="streamingMsg"></div>
        `;
        chatContainer.appendChild(msgDiv);
        const contentDiv = msgDiv.querySelector('.msg-content');

        // 读取 SSE 流 — 打字机模式
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullReply = '';

        // 启动打字机协程
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
                        // 喂给打字机
                        feedTypewriter(parsed.token);
                    }
                } catch (_) {}
            }
        }

        // SSE 流已结束，通知打字机排空队列
        typewriterRunning = false;
        await waitTypewriterDone();

        // 移除 streaming 标记
        contentDiv.classList.remove('streaming');

        // 刷新会话列表（可能出现了新会话）
        await loadSessions();

    } catch (err) {
        removeLoading();
        typewriterRunning = false;
        typewriterQueue = '';
        // 移除可能存在的半成品消息
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
                <span class="welcome-glitch">▮▮▮</span>
            </div>
            <h2>记忆体已清空。</h2>
            <p>梦境重启，像素重新排列。<br>我们可以重新开始对话。</p>
            <div class="welcome-line"></div>
        </div>
    `;
}

// ================================================================
// 鼠标跟随 · 红色切割光束
// ================================================================
document.addEventListener('mousemove', function (e) {
    document.documentElement.style.setProperty('--mx', e.clientX + 'px');
    document.documentElement.style.setProperty('--my', e.clientY + 'px');
});

// ================================================================
// CRT 滤镜切换
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

// 开机动画播放完成后移除 DOM 节点
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

btnToggleSidebar.addEventListener('click', toggleSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);
btnNewChat.addEventListener('click', newSession);

// ================================================================
// 启动
// ================================================================
loadSessions();
messageInput.focus();
