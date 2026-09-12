/**
 * Central API Client for Smart Campus Ecosystem
 * With Domain-Based Session Authentication
 */

const API = {
  baseUrl: window.location.origin,

  getToken() {
    return localStorage.getItem('campus_session_token') || '';
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('campus_session_token', token);
    } else {
      localStorage.removeItem('campus_session_token');
    }
  },

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Authentication & Domain Gateway
  async login(email, password = 'campus123') {
    const res = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (res.session && res.session.sessionToken) {
      this.setToken(res.session.sessionToken);
    }
    return res;
  },

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    this.setToken(null);
  },

  async getSession() {
    return this.request('/api/auth/session');
  },

  async switchUser(userId) {
    const res = await this.request('/api/auth/switch', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    if (res.session && res.session.sessionToken) {
      this.setToken(res.session.sessionToken);
    }
    return res;
  },

  async getCardDynamicToken(studentId) {
    return this.request(`/api/auth/card/token/${studentId}`);
  },

  // Wallet & UPI Recharge
  async getWalletBalance(studentId) {
    return this.request(`/api/wallet/balance/${studentId}`);
  },

  async initiateUpiRecharge(studentId, amount, upiApp = 'Google Pay', payerName = 'Aarav') {
    return this.request('/api/wallet/recharge/initiate', {
      method: 'POST',
      body: JSON.stringify({ studentId, amount, upiApp, payerName })
    });
  },

  async verifyUpiRecharge(studentId, amount, transactionReference, scenario = 'SUCCESS', upiApp = 'Google Pay') {
    return this.request('/api/wallet/recharge/verify', {
      method: 'POST',
      body: JSON.stringify({ studentId, amount, transactionReference, scenario, upiApp })
    });
  },

  async updateDailyLimit(studentId, dailyLimit) {
    return this.request('/api/wallet/daily-limit', {
      method: 'POST',
      body: JSON.stringify({ studentId, dailyLimit })
    });
  },

  // POS Micro-Payment
  async authorizePosPayment(payload) {
    return this.request('/api/pos/authorize', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async syncOfflineQueue(posTerminalId, queuedTransactions) {
    return this.request('/api/pos/offline-sync', {
      method: 'POST',
      body: JSON.stringify({ posTerminalId, queuedTransactions })
    });
  },

  // Orders & Pre-Ordering
  async getVendors() {
    return this.request('/api/orders/vendors');
  },

  async getOrders(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/orders/list${query ? '?' + query : ''}`);
  },

  async createPreOrder(orderData) {
    return this.request('/api/orders/create', {
      method: 'POST',
      body: JSON.stringify(orderData)
    });
  },

  async updateOrderStatus(orderId, status, verifiedOtp = null) {
    return this.request(`/api/orders/${orderId}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, verifiedOtp })
    });
  },

  async getPrintQuote(quoteData) {
    return this.request('/api/orders/print/quote', {
      method: 'POST',
      body: JSON.stringify(quoteData)
    });
  },

  // Admin & Analytics
  async getAdminMetrics() {
    return this.request('/api/admin/metrics');
  },

  async getAdminTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/admin/transactions${query ? '?' + query : ''}`);
  },

  async getAuditLogs() {
    return this.request('/api/admin/audit-logs');
  },

  async getStudentsDirectory() {
    return this.request('/api/admin/students');
  },

  async toggleCardFreeze(cardUid, status, reason = 'Administrative action') {
    return this.request(`/api/admin/cards/${encodeURIComponent(cardUid)}/freeze`, {
      method: 'POST',
      body: JSON.stringify({ status, reason })
    });
  },

  async grantSubsidy(studentId, amount, subsidyReason = 'University Merit Grant') {
    return this.request(`/api/admin/students/${studentId}/subsidy`, {
      method: 'POST',
      body: JSON.stringify({ amount, subsidyReason })
    });
  },

  async resetData() {
    return this.request('/api/admin/reset', { method: 'POST' });
  }
};

window.API = API;
