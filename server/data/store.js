const fs = require('fs');
const path = require('path');
const initialData = require('./initialData');

const STORE_FILE = path.join(__dirname, 'store.json');

class Store {
  constructor() {
    this.data = null;
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(STORE_FILE)) {
        const raw = fs.readFileSync(STORE_FILE, 'utf8');
        this.data = JSON.parse(raw);
      } else {
        this.reset();
      }
    } catch (err) {
      console.error('Error reading store file, resetting to initial data:', err);
      this.reset();
    }
  }

  persist() {
    try {
      fs.writeFileSync(STORE_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to persist store:', err);
    }
  }

  reset() {
    // Deep clone initial data
    this.data = JSON.parse(JSON.stringify(initialData));
    this.persist();
    console.log('Store initialized with fresh seed data.');
  }

  // User queries
  getUsers() {
    return this.data.users;
  }

  getUser(id) {
    return this.data.users.find(u => u.id === id) || null;
  }

  getStudentByCardUid(cardUid) {
    if (!cardUid) return null;
    const cleanUid = cardUid.trim().toUpperCase();
    return this.data.users.find(u => u.card && u.card.cardUid.toUpperCase() === cleanUid) || null;
  }

  getStudentByBarcode(barcode) {
    if (!barcode) return null;
    const cleanBarcode = barcode.trim();
    return this.data.users.find(u => u.card && (u.card.barcodeNumber === cleanBarcode || u.id === cleanBarcode || (u.rollNo && u.rollNo.toUpperCase() === cleanBarcode.toUpperCase()))) || null;
  }

  getStudentByRollNo(rollNo) {
    if (!rollNo) return null;
    return this.data.users.find(u => u.rollNo && u.rollNo.toUpperCase() === rollNo.trim().toUpperCase()) || null;
  }

  updateUser(id, updates) {
    const user = this.getUser(id);
    if (!user) return null;
    Object.assign(user, updates);
    this.persist();
    return user;
  }

  updateWallet(studentId, amountChange, isSpend = false) {
    const user = this.getUser(studentId);
    if (!user || !user.wallet) return null;
    
    user.wallet.balance = parseFloat((user.wallet.balance + amountChange).toFixed(2));
    if (isSpend && amountChange < 0) {
      user.wallet.todaySpent = parseFloat((user.wallet.todaySpent + Math.abs(amountChange)).toFixed(2));
    }
    if (amountChange > 0) {
      user.wallet.lastRechargeAt = new Date().toISOString();
    }
    this.persist();
    return user.wallet;
  }

  updateDailySpendLimit(studentId, newLimit) {
    const user = this.getUser(studentId);
    if (!user || !user.wallet) return null;
    user.wallet.dailySpendLimit = parseFloat(newLimit);
    this.persist();
    return user.wallet;
  }

  setCardStatus(cardUid, status) {
    const student = this.getStudentByCardUid(cardUid);
    if (!student || !student.card) return null;
    student.card.status = status; // ACTIVE | FROZEN
    this.persist();
    return student;
  }

  // Vendors
  getVendors() {
    return this.data.vendors;
  }

  getVendor(id) {
    return this.data.vendors.find(v => v.id === id) || null;
  }

  // Transactions
  getTransactions(filters = {}) {
    let txns = [...this.data.transactions];
    if (filters.studentId) {
      txns = txns.filter(t => t.studentId === filters.studentId);
    }
    if (filters.vendorId) {
      txns = txns.filter(t => t.vendorId === filters.vendorId);
    }
    if (filters.type) {
      txns = txns.filter(t => t.type === filters.type);
    }
    // Sort descending by timestamp
    return txns.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  addTransaction(txnData) {
    const newTxn = {
      id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      status: "SUCCESS",
      ...txnData
    };
    this.data.transactions.unshift(newTxn);
    this.persist();
    return newTxn;
  }

  // Orders
  getOrders(filters = {}) {
    let orders = [...this.data.orders];
    if (filters.studentId) {
      orders = orders.filter(o => o.studentId === filters.studentId);
    }
    if (filters.vendorId) {
      orders = orders.filter(o => o.vendorId === filters.vendorId);
    }
    if (filters.status) {
      orders = orders.filter(o => o.status === filters.status);
    }
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  getOrder(id) {
    return this.data.orders.find(o => o.id === id) || null;
  }

  createOrder(orderData) {
    const orderNumber = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const pickupOtp = Math.floor(1000 + Math.random() * 9000).toString();
    const newOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      orderNumber,
      pickupOtp,
      status: "PLACED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...orderData
    };
    this.data.orders.unshift(newOrder);
    this.persist();
    return newOrder;
  }

  updateOrderStatus(orderId, status) {
    const order = this.getOrder(orderId);
    if (!order) return null;
    order.status = status;
    order.updatedAt = new Date().toISOString();
    this.persist();
    return order;
  }

  // Audit Logs
  getAuditLogs(limit = 100) {
    return this.data.auditLogs.slice(0, limit);
  }

  logAudit(action, actor, details, severity = "INFO", ipAddress = "127.0.0.1") {
    const entry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      action,
      actor,
      details,
      severity,
      ipAddress
    };
    this.data.auditLogs.unshift(entry);
    this.persist();
    return entry;
  }

  // Analytics
  getAdminMetrics() {
    const txns = this.data.transactions;
    const orders = this.data.orders;
    const students = this.data.users.filter(u => u.role === 'STUDENT');

    // Total GMV (all successful purchases: offline micro + online pre-order)
    const purchases = txns.filter(t => t.status === 'SUCCESS' && (t.type === 'OFFLINE_MICROPAYMENT' || t.type === 'ONLINE_PREORDER'));
    const totalGmv = purchases.reduce((sum, t) => sum + (t.amount || 0), 0);
    const offlineTotal = txns.filter(t => t.status === 'SUCCESS' && t.type === 'OFFLINE_MICROPAYMENT')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const preOrderTotal = txns.filter(t => t.status === 'SUCCESS' && t.type === 'ONLINE_PREORDER')
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    const upiRechargeTotal = txns.filter(t => t.status === 'SUCCESS' && t.type === 'ONLINE_UPI_RECHARGE')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    // Vendor breakdown
    const vendorRevenue = {};
    purchases.forEach(p => {
      const vName = p.vendorName || 'Other';
      vendorRevenue[vName] = (vendorRevenue[vName] || 0) + p.amount;
    });

    const activeCards = students.filter(s => s.card && s.card.status === 'ACTIVE').length;
    const frozenCards = students.filter(s => s.card && s.card.status === 'FROZEN').length;
    const totalWalletBalance = students.reduce((sum, s) => sum + (s.wallet ? s.wallet.balance : 0), 0);

    return {
      totalGmv: parseFloat(totalGmv.toFixed(2)),
      offlineTotal: parseFloat(offlineTotal.toFixed(2)),
      preOrderTotal: parseFloat(preOrderTotal.toFixed(2)),
      upiRechargeTotal: parseFloat(upiRechargeTotal.toFixed(2)),
      totalTransactions: txns.length,
      microPaymentCount: txns.filter(t => t.type === 'OFFLINE_MICROPAYMENT').length,
      preOrderCount: orders.length,
      activeCards,
      frozenCards,
      totalStudents: students.length,
      totalWalletBalance: parseFloat(totalWalletBalance.toFixed(2)),
      vendorRevenue,
      recentActivity: txns.slice(0, 10)
    };
  }
}

// Export singleton instance
const storeInstance = new Store();
module.exports = storeInstance;
