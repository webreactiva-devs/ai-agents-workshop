/**
 * Chat Frontend
 * SSE client + markdown rendering
 */

// DOM elements
const messagesEl = document.getElementById('chat-messages');
const form = document.getElementById('chat-form');
const input = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const abortBtn = document.getElementById('abort-btn');
const levelSelect = document.getElementById('level-select');

// State
let isStreaming = false;

// Configure marked
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,
});

// ============================================================================
// INIT
// ============================================================================

async function loadLevels() {
  try {
    const res = await fetch('/api/levels');
    const { levels } = await res.json();
    levelSelect.innerHTML = levels
      .map((l) => `<option value="${l.id}">${l.id} — ${l.description}</option>`)
      .join('');
  } catch (err) {
    levelSelect.innerHTML = '<option value="">Error cargando niveles</option>';
  }
}

loadLevels();

// ============================================================================
// MESSAGE RENDERING
// ============================================================================

function addUserMessage(text) {
  // Clear welcome message on first use
  if (messagesEl.querySelector('.text-center')) {
    messagesEl.innerHTML = '';
  }
  const div = document.createElement('div');
  div.className = 'msg-user text-sm';
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function createAssistantMessage() {
  if (messagesEl.querySelector('.text-center')) {
    messagesEl.innerHTML = '';
  }
  const wrapper = document.createElement('div');
  wrapper.className = 'space-y-2';

  const div = document.createElement('div');
  div.className = 'msg-assistant text-sm';
  div.innerHTML = '<span class="streaming-dot"></span>';
  wrapper.appendChild(div);

  messagesEl.appendChild(wrapper);
  scrollToBottom();
  return { wrapper, contentEl: div, text: '' };
}

function updateAssistantMessage(msgState, newText) {
  msgState.text += newText;
  msgState.contentEl.innerHTML = marked.parse(msgState.text);
  // Re-highlight code blocks
  msgState.contentEl.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block);
  });
  scrollToBottom();
}

function addToolIndicator(msgState, toolName) {
  const indicator = document.createElement('div');
  indicator.className = 'tool-indicator';
  indicator.innerHTML = `<span class="dot"></span> ${toolName}`;
  msgState.wrapper.insertBefore(indicator, msgState.contentEl);
  scrollToBottom();
}

function addResultStats(msgState, result) {
  // Remove streaming dot if still present
  const dot = msgState.contentEl.querySelector('.streaming-dot');
  if (dot) dot.remove();

  // If the assistant message is still empty (text came via result.result), show it
  if (!msgState.text && result.result) {
    msgState.text = result.result;
    msgState.contentEl.innerHTML = marked.parse(msgState.text);
    msgState.contentEl.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightElement(block);
    });
  }

  const stats = document.createElement('div');
  stats.className = 'result-stats';

  const duration = (result.duration_ms / 1000).toFixed(1);
  const cost = result.total_cost_usd.toFixed(4);
  const tokensIn = result.usage?.input_tokens?.toLocaleString() || '?';
  const tokensOut = result.usage?.output_tokens?.toLocaleString() || '?';

  stats.innerHTML = `
    <span>${result.subtype === 'success' ? '&#x2705;' : '&#x274c;'} <span class="stat-value">${result.subtype}</span></span>
    <span>Duration: <span class="stat-value">${duration}s</span></span>
    <span>Cost: <span class="stat-value">$${cost}</span></span>
    <span>Tokens: <span class="stat-value">${tokensIn} in / ${tokensOut} out</span></span>
  `;
  msgState.wrapper.appendChild(stats);
  scrollToBottom();
}

function addErrorMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg-assistant text-sm border-red-800 bg-red-950';
  div.textContent = `Error: ${text}`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ============================================================================
// SSE STREAMING
// ============================================================================

async function sendMessage(message, level) {
  isStreaming = true;
  sendBtn.disabled = true;
  abortBtn.classList.remove('hidden');

  addUserMessage(message);
  const msgState = createAssistantMessage();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, level }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      let currentEvent = null;

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent) {
          const data = line.slice(6);
          handleSSEEvent(currentEvent, data, msgState);
          currentEvent = null;
        } else if (line === '') {
          currentEvent = null;
        }
      }
    }
  } catch (err) {
    addErrorMessage(err.message);
  } finally {
    // Remove streaming dot
    const dot = msgState.contentEl.querySelector('.streaming-dot');
    if (dot) dot.remove();

    isStreaming = false;
    sendBtn.disabled = false;
    abortBtn.classList.add('hidden');
  }
}

function handleSSEEvent(event, data, msgState) {
  switch (event) {
    case 'text':
      updateAssistantMessage(msgState, data);
      break;
    case 'tool_use':
      addToolIndicator(msgState, data);
      break;
    case 'result':
      try {
        const result = JSON.parse(data);
        addResultStats(msgState, result);
      } catch {}
      break;
    case 'error':
      addErrorMessage(data);
      break;
    case 'heartbeat':
      break;
  }
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const message = input.value.trim();
  const level = levelSelect.value;

  if (!message || !level || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
  sendMessage(message, level);
});

// Ctrl+Enter to send
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});

// Auto-grow textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
});

// Abort button
abortBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/abort', { method: 'POST' });
  } catch {}
});
