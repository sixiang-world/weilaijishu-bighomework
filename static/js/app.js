/* ============================================================
   千禧梦 · 构成主义聊天 — 前端逻辑
   ============================================================ */

// 生成会话 ID
const SESSION_ID = 'dream_' + Math.random().toString(36).substring(2, 11);

// DOM 引用
const chatContainer = document.getElementById('chatContainer');
const messageInput = document.getElementById('messageInput');
const btnSend = document.getElementById('btnSend');
const welcomeMessage = document.getElementById('welcomeMessage');

// 状态
let isLoading = false;

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

    const avatar = type === 'robot' ? '🤖' : '你';

    div.innerHTML = `
        <div class="msg-avatar">${avatar}</div>
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
    btnSend.style.opacity = '0.5';

    loadingEl = document.createElement('div');
    loadingEl.className = 'loading-msg';
    loadingEl.id = 'loadingEl';
    loadingEl.innerHTML = `
        <div class="loading-avatar">🤖</div>
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
    toast.textContent = '⚠ ' + text;
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
                <span>🤖</span>
                <span class="welcome-glitch">▮▯▮</span>
            </div>
            <h2>记忆体已清空。</h2>
            <p>梦境重启，像素重新排列。<br>我们可以重新开始对话。</p>
            <div class="welcome-line"></div>
        </div>
    `;
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
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// 初始聚焦
messageInput.focus();
