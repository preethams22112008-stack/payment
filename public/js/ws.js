/**
 * WebSocket Real-time Client for Campus Ecosystem
 */

class WebSocketManager {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 5000;
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ Real-time WebSocket connection established');
      this.reconnectAttempts = 0;
      this.updateStatus(true);
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.dispatch(message.type, message.payload);
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    this.ws.onclose = () => {
      console.warn('⚠️ WebSocket disconnected. Reconnecting...');
      this.updateStatus(false);
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket error:', err);
      this.ws.close();
    };
  }

  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  on(type, callback) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type).add(callback);
  }

  off(type, callback) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).delete(callback);
    }
  }

  dispatch(type, payload) {
    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach((cb) => cb(payload));
    }
    // Also dispatch to wildcard listeners
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach((cb) => cb(type, payload));
    }
  }

  updateStatus(connected) {
    const el = document.getElementById('ws-status-text');
    const dot = document.querySelector('.ws-dot');
    if (el) el.textContent = connected ? 'Live Real-time' : 'Reconnecting...';
    if (dot) dot.style.background = connected ? 'var(--accent-emerald)' : 'var(--accent-rose)';
  }
}

// Global Toast System
window.showToast = function (title, message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div>
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

window.wsManager = new WebSocketManager();
window.wsManager.connect();
