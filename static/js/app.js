/* ============================================================
   千禧梦 · 构成主义聊天 — 前端逻辑 v2
   ============================================================ */

// 会话 ID
const SESSION_ID = 'dream_' + Math.random().toString(36).substring(2, 11);

// DOM 引用
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const btnSend = document.getElementById('btnSend');
const welcomeMessage = document.getElementById('welcomeMessage');

// 状态
let isLoading = false;

// SVG 图标模板
const ROBOT_SVG = `<svg viewBox="0 0 40 40" fill="none"><line x1="20" y1="2" x2="20" y2="10" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><circle cx="20" cy="2" r="2" fill="#F5F0E6"/><rect x="6" y="10" width="28" height="22" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="12" y="16" width="6" height="6" fill="#F5F0E6"/><rect x="22" y="16" width="6" height="6" fill="#F5F0E6"/><line x1="14" y1="28" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><rect x="3" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/><rect x="32" y="14" width="5" height="8" fill="none" stroke="#F5F0E6" stroke-width="2"/></svg>`;

const USER_SVG = `<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="12" r="8" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><rect x="8" y="24" width="24" height="14" fill="none" stroke="#F5F0E6" stroke-width="2.5"/><line x1="4" y1="38" x2="14" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/><line x1="36" y1="38" x2="26" y2="28" stroke="#F5F0E6" stroke-width="2" stroke-linecap="square"/></svg>`;

// ================================================================
// 发送消息
// ================================================================
async function sendMessage() {
    if (isLoading) return;

    const content = messageInput.value.trim();
    if (!content) return;

    // 隐藏欢迎消息
    if (welcomeMessage) welcomeMessage.remove();

    // 添加用户消息
    addMessage(content, 'user');
    messageInput.value = '';
    messageInput.focus();

    // 显示加载
    showLoading();

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: content,
                session_id: SESSION_ID,
            }),
        });

        const data = await res.json();
        removeLoading();

        if (data.reply) {
            addMessage(data.reply, 'robot');
        } else {
            showError('未知信号 …');
        }
    } catch (err) {
        removeLoading();
        showError('连接中断，请检查网络 …');
    }
}

// ================================================================
// 添加消息到对话区
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
            body: JSON.stringify({ session_id: SESSION_ID }),
        });
    } catch (_) {
        // 即使后端清空失败，前端也清理
    }

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

// 初始聚焦
messageInput.focus();
