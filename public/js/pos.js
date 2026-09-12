/**
 * Merchant POS Terminal Logic
 * Handles Zero-Student-Device-Data micro-payments via NFC & Barcode
 */

const MerchantPOS = {
  currentBill: [],
  activeVendorId: 'ven_canteen',
  posTerminalId: 'POS-TERM-CANTEEN-01',
  isOfflineMode: false,
  offlineQueue: [],

  quickMenu: [
    { name: 'Crispy Samosa (2 pcs)', price: 30.00, icon: '🥟' },
    { name: 'Masala Dosa', price: 55.00, icon: '🥞' },
    { name: 'Deluxe Mini Thali', price: 90.00, icon: '🍱' },
    { name: 'Filter Coffee', price: 20.00, icon: '☕' },
    { name: 'Grilled Sandwich', price: 65.00, icon: '🥪' },
    { name: 'Veg Dum Biryani', price: 110.00, icon: '🍛' },
    { name: 'A4 Printout (B&W)', price: 2.00, icon: '📄' },
    { name: 'Spiral Binding', price: 35.00, icon: '📑' }
  ],

  init() {
    this.renderQuickMenu();
    this.renderBill();
    this.initKeypad();
    this.initEventListeners();
    this.loadOfflineQueue();
  },

  renderQuickMenu() {
    const container = document.getElementById('pos-quick-items-grid');
    if (!container) return;

    container.innerHTML = this.quickMenu.map((item, idx) => `
      <div class="pos-item-btn" onclick="MerchantPOS.addItemToBill(${idx})">
        <span class="pos-item-icon">${item.icon}</span>
        <span class="pos-item-title">${item.name}</span>
        <span class="pos-item-price">₹${item.price.toFixed(2)}</span>
      </div>
    `).join('');
  },

  addItemToBill(idx) {
    const item = this.quickMenu[idx];
    const existing = this.currentBill.find((b) => b.name === item.name);
    if (existing) {
      existing.qty++;
    } else {
      this.currentBill.push({ name: item.name, price: item.price, qty: 1 });
    }
    window.soundSystem.playTap();
    this.renderBill();
  },

  addCustomAmountToBill(amount) {
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) return;

    this.currentBill.push({
      name: `Counter Sale (${num >= 50 ? 'Meal' : 'Snack/Service'})`,
      price: num,
      qty: 1
    });
    window.soundSystem.playTap();
    this.renderBill();
  },

  clearBill() {
    this.currentBill = [];
    window.soundSystem.playTap();
    this.renderBill();
  },

  renderBill() {
    const listEl = document.getElementById('pos-bill-items');
    const subtotalEl = document.getElementById('pos-bill-subtotal');
    const grandTotalEl = document.getElementById('pos-bill-grand-total');

    const total = this.currentBill.reduce((sum, item) => sum + item.price * item.qty, 0);

    if (listEl) {
      if (this.currentBill.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 40px 0;">Tap quick items or enter custom amount on keypad to build bill</div>`;
      } else {
        listEl.innerHTML = this.currentBill.map((item, i) => `
          <div class="bill-line-item">
            <span>${item.name} × ${item.qty}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-family: var(--font-mono); font-weight: 700;">₹${(item.price * item.qty).toFixed(2)}</span>
              <button style="background: none; border: none; color: var(--accent-rose); cursor: pointer; font-size: 14px;" onclick="MerchantPOS.removeBillItem(${i})">×</button>
            </div>
          </div>
        `).join('');
      }
    }

    if (subtotalEl) subtotalEl.textContent = `₹${total.toFixed(2)}`;
    if (grandTotalEl) grandTotalEl.textContent = `₹${total.toFixed(2)}`;
  },

  removeBillItem(idx) {
    this.currentBill.splice(idx, 1);
    this.renderBill();
  },

  initKeypad() {
    let keypadBuffer = '';
    const displayEl = document.getElementById('keypad-display');

    window.posKeyInput = (val) => {
      window.soundSystem.playTap();
      if (val === 'C') {
        keypadBuffer = '';
      } else if (val === 'ENTER') {
        if (keypadBuffer) {
          this.addCustomAmountToBill(keypadBuffer);
          keypadBuffer = '';
        }
      } else if (val === '.') {
        if (!keypadBuffer.includes('.')) keypadBuffer += '.';
      } else {
        if (keypadBuffer.length < 6) keypadBuffer += val;
      }

      if (displayEl) {
        displayEl.textContent = keypadBuffer ? `₹${keypadBuffer}` : '₹0.00';
      }
    };
  },

  // Authorize Payment via Student NFC Tap or Barcode scan
  async triggerCardTap(tokenString, studentHint = null) {
    let billTotal = this.currentBill.reduce((sum, item) => sum + item.price * item.qty, 0);

    // If bill is empty, default to a quick test snack (₹55)
    if (billTotal <= 0) {
      billTotal = 55.00;
      this.currentBill = [{ name: 'Masala Dosa (Quick Tap)', price: 55.00, qty: 1 }];
      this.renderBill();
    }

    const itemsSummary = this.currentBill.map((i) => `${i.name} × ${i.qty}`).join(', ');

    // 1. Play contactless tap sound
    window.soundSystem.playTap();

    // 2. Check if POS is in simulated Offline Store Mode (Wi-Fi dropped)
    if (this.isOfflineMode) {
      this.queueOfflineTransaction(tokenString, billTotal, itemsSummary, studentHint);
      return;
    }

    // 3. Online Authorization against central server
    try {
      const res = await window.API.authorizePosPayment({
        token: tokenString,
        amount: billTotal,
        vendorId: this.activeVendorId,
        posTerminalId: this.posTerminalId,
        itemsSummary
      });

      // Positive authorization chime!
      window.soundSystem.playSuccess();
      window.showToast(
        '✅ Payment Authorized!',
        `Charged ₹${billTotal.toFixed(2)} to ${res.authorization.student.name}. Auth: ${res.authorization.authCryptogram}`,
        'success'
      );

      this.showReceiptSlip(res.authorization);
      this.currentBill = [];
      this.renderBill();
    } catch (err) {
      window.soundSystem.playError();
      window.showToast('❌ Payment Declined', err.message, 'error');
      alert(`POS TRANSACTION REJECTED:\n\n${err.message}`);
    }
  },

  // Edge Offline Mode Queueing
  queueOfflineTransaction(token, amount, itemsSummary, studentHint) {
    const offlineTxnId = `OFFLINE-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const studentName = studentHint ? studentHint.name : 'Student ID';

    const queuedItem = {
      offlineTxnId,
      token,
      amount,
      itemsSummary,
      vendorId: this.activeVendorId,
      timestamp: new Date().toISOString(),
      studentName
    };

    this.offlineQueue.push(queuedItem);
    this.saveOfflineQueue();
    this.renderOfflineQueueBadge();

    window.soundSystem.playSuccess();
    window.showToast(
      '💾 Queued Offline (No Wi-Fi)',
      `Transaction buffered locally for ₹${amount.toFixed(2)}. Will sync once Wi-Fi reconnects.`,
      'warning'
    );

    this.currentBill = [];
    this.renderBill();
  },

  async syncOfflineTransactions() {
    if (this.offlineQueue.length === 0) {
      alert('No offline transactions to sync.');
      return;
    }

    try {
      const res = await window.API.syncOfflineQueue(this.posTerminalId, this.offlineQueue);
      window.soundSystem.playSuccess();
      window.showToast(
        '🔄 Edge Sync Complete',
        `Successfully synced ${res.syncedCount} offline transactions to Central Server!`,
        'success'
      );

      this.offlineQueue = [];
      this.saveOfflineQueue();
      this.renderOfflineQueueBadge();
    } catch (err) {
      window.soundSystem.playError();
      alert(`Sync failed: ${err.message}`);
    }
  },

  loadOfflineQueue() {
    try {
      const raw = localStorage.getItem('pos_offline_queue');
      this.offlineQueue = raw ? JSON.parse(raw) : [];
      this.renderOfflineQueueBadge();
    } catch (e) {
      this.offlineQueue = [];
    }
  },

  saveOfflineQueue() {
    try {
      localStorage.setItem('pos_offline_queue', JSON.stringify(this.offlineQueue));
    } catch (e) {}
  },

  renderOfflineQueueBadge() {
    const badge = document.getElementById('pos-offline-queue-badge');
    const syncBtn = document.getElementById('btn-sync-offline-queue');

    if (badge) {
      badge.textContent = `${this.offlineQueue.length} queued offline`;
      badge.style.display = this.offlineQueue.length > 0 ? 'inline-flex' : 'none';
    }
    if (syncBtn) {
      syncBtn.style.display = this.offlineQueue.length > 0 ? 'inline-flex' : 'none';
    }
  },

  showReceiptSlip(auth) {
    const modal = document.getElementById('pos-receipt-modal');
    if (!modal) return;

    const cryptogramEl = document.getElementById('receipt-cryptogram-code');
    const amountEl = document.getElementById('receipt-total-amount');
    const studentNameEl = document.getElementById('receipt-student-name');
    const rollNoEl = document.getElementById('receipt-student-roll');
    const balEl = document.getElementById('receipt-student-rem-bal');
    const itemsEl = document.getElementById('receipt-items-summary');
    const timeEl = document.getElementById('receipt-timestamp');
    const methodEl = document.getElementById('receipt-verify-method');

    if (cryptogramEl) cryptogramEl.textContent = auth.authCryptogram;
    if (amountEl) amountEl.textContent = `₹${auth.amount.toFixed(2)}`;
    if (studentNameEl) studentNameEl.textContent = auth.student.name;
    if (rollNoEl) rollNoEl.textContent = auth.student.rollNo;
    if (balEl) balEl.textContent = `₹${auth.remainingBalance.toFixed(2)}`;
    if (itemsEl) itemsEl.textContent = auth.itemsSummary;
    if (timeEl) timeEl.textContent = new Date(auth.timestamp).toLocaleTimeString();
    if (methodEl) methodEl.textContent = auth.verificationMethod;

    modal.classList.add('active');
  },

  initEventListeners() {
    // NFC Pad Click
    const nfcPad = document.getElementById('pos-nfc-pad');
    if (nfcPad) {
      nfcPad.addEventListener('click', () => {
        // Taps active student from StudentApp or defaults to Aarav's card UID
        const student = window.StudentApp?.activeStudent;
        const token = window.StudentApp?.currentDynamicToken || (student?.card?.cardUid) || 'NFC-8A7F-B21C';
        this.triggerCardTap(token, student);
      });
    }

    // Barcode scanner input enter
    const scannerInput = document.getElementById('pos-scanner-input');
    if (scannerInput) {
      scannerInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && scannerInput.value.trim()) {
          this.triggerCardTap(scannerInput.value.trim());
          scannerInput.value = '';
        }
      });
    }

    // Offline mode toggle
    const offlineSwitch = document.getElementById('pos-offline-toggle');
    if (offlineSwitch) {
      offlineSwitch.addEventListener('change', (e) => {
        this.isOfflineMode = e.target.checked;
        const statusText = document.getElementById('pos-network-status-text');
        if (statusText) {
          statusText.textContent = this.isOfflineMode ? '🔴 Offline Mode (Local Edge Queue)' : '🟢 Online (Central Ledger Connected)';
          statusText.style.color = this.isOfflineMode ? 'var(--accent-amber)' : 'var(--accent-emerald)';
        }
        window.showToast(
          'POS Network Status',
          this.isOfflineMode ? 'Switched to Offline Resilience Buffer (Zero Central Wi-Fi)' : 'Restored Wi-Fi connection to Central Cloud',
          this.isOfflineMode ? 'warning' : 'success'
        );
      });
    }

    // Batch sync button
    const syncBtn = document.getElementById('btn-sync-offline-queue');
    if (syncBtn) {
      syncBtn.addEventListener('click', () => this.syncOfflineTransactions());
    }
  }
};

window.MerchantPOS = MerchantPOS;
