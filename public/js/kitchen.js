/**
 * Vendor Kitchen Display System (KDS) Logic
 */

const KitchenDisplay = {
  activeVendorId: 'ALL',
  orders: [],
  timerInterval: null,

  async init() {
    await this.loadOrders();
    this.startTimers();
    this.initEventListeners();

    // Listen for new pre-orders via WebSocket
    window.wsManager.on('KITCHEN_ORDER_NEW', (payload) => {
      window.soundSystem.playKitchenChime();
      window.showToast(
        '🔔 New Kitchen Ticket!',
        `Order ${payload.order.orderNumber} placed for ${payload.order.vendorName}`,
        'kitchen'
      );
      this.loadOrders();
    });

    // Listen for order status updates
    window.wsManager.on('ORDER_STATUS_CHANGED', () => {
      this.loadOrders();
    });
  },

  async loadOrders() {
    try {
      const params = {};
      if (this.activeVendorId !== 'ALL') {
        params.vendorId = this.activeVendorId;
      }
      const res = await window.API.getOrders(params);
      this.orders = res.orders || [];
      this.renderKanban();
    } catch (err) {
      console.error('Failed to load kitchen orders:', err);
    }
  },

  renderKanban() {
    const colPlaced = document.getElementById('kds-col-placed');
    const colPrep = document.getElementById('kds-col-prep');
    const colReady = document.getElementById('kds-col-ready');

    const countPlaced = document.getElementById('kds-count-placed');
    const countPrep = document.getElementById('kds-count-prep');
    const countReady = document.getElementById('kds-count-ready');

    // Filter by active column status
    const placedOrders = this.orders.filter((o) => o.status === 'PLACED');
    const prepOrders = this.orders.filter((o) => o.status === 'PREPARING');
    const readyOrders = this.orders.filter((o) => o.status === 'READY');

    if (countPlaced) countPlaced.textContent = placedOrders.length;
    if (countPrep) countPrep.textContent = prepOrders.length;
    if (countReady) countReady.textContent = readyOrders.length;

    if (colPlaced) colPlaced.innerHTML = placedOrders.map((o) => this.renderTicket(o)).join('') || this.renderEmptyCol('No incoming orders');
    if (colPrep) colPrep.innerHTML = prepOrders.map((o) => this.renderTicket(o)).join('') || this.renderEmptyCol('Kitchen is clear');
    if (colReady) colReady.innerHTML = readyOrders.map((o) => this.renderTicket(o)).join('') || this.renderEmptyCol('No orders awaiting pickup');
  },

  renderEmptyCol(text) {
    return `<div style="text-align: center; color: var(--text-muted); font-size: 0.82rem; padding: 40px 10px;">${text}</div>`;
  },

  renderTicket(ord) {
    const elapsedSeconds = Math.floor((Date.now() - new Date(ord.createdAt).getTime()) / 1000);
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;
    const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    let timerClass = '';
    if (mins >= 10) timerClass = 'timer-urgent';
    else if (mins >= 5) timerClass = 'timer-warn';

    return `
      <div class="kitchen-ticket ${timerClass}" id="ticket-${ord.id}">
        <div class="ticket-top-row">
          <span class="ticket-order-id">${ord.orderNumber}</span>
          <span class="ticket-timer-pill ${timerClass}" data-created="${ord.createdAt}">⏱️ ${timeFormatted}</span>
        </div>

        <div class="ticket-student-meta">
          <span><strong>${ord.studentName}</strong> (${ord.studentRoll || 'Student'})</span>
          <span class="pickup-otp-pill" style="font-size: 0.75rem;">OTP: ${ord.pickupOtp}</span>
        </div>

        <div class="ticket-items-list">
          ${ord.items.map((item, idx) => `
            <label class="ticket-item-row" onclick="this.classList.toggle('checked')">
              <input type="checkbox" />
              <span class="ticket-qty-badge">${item.qty}×</span>
              <span>${item.name}</span>
            </label>
          `).join('')}
        </div>

        ${ord.notes ? `<div class="ticket-notes">📝 <strong>Notes:</strong> ${ord.notes}</div>` : ''}

        <div class="ticket-actions-bar">
          ${ord.status === 'PLACED' ? `
            <button class="btn btn-primary ticket-btn" onclick="KitchenDisplay.updateStatus('${ord.id}', 'PREPARING')">🍳 Start Cooking</button>
          ` : ''}

          ${ord.status === 'PREPARING' ? `
            <button class="btn btn-success ticket-btn" onclick="KitchenDisplay.updateStatus('${ord.id}', 'READY')">🔔 Mark as Ready</button>
          ` : ''}

          ${ord.status === 'READY' ? `
            <button class="btn btn-outline ticket-btn" onclick="KitchenDisplay.verifyAndComplete('${ord.id}', '${ord.pickupOtp}')">✅ Handover Order</button>
          ` : ''}
        </div>
      </div>
    `;
  },

  startTimers() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      // Update all timer pills on active tickets
      document.querySelectorAll('.ticket-timer-pill').forEach((pill) => {
        const created = pill.dataset.created;
        if (!created) return;

        const elapsedSeconds = Math.floor((Date.now() - new Date(created).getTime()) / 1000);
        const mins = Math.floor(elapsedSeconds / 60);
        const secs = elapsedSeconds % 60;
        pill.textContent = `⏱️ ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        if (mins >= 10) {
          pill.className = 'ticket-timer-pill timer-urgent';
          pill.closest('.kitchen-ticket')?.classList.add('timer-urgent');
        } else if (mins >= 5) {
          pill.className = 'ticket-timer-pill timer-warn';
          pill.closest('.kitchen-ticket')?.classList.add('timer-warn');
        }
      });
    }, 1000);
  },

  async updateStatus(orderId, status) {
    try {
      window.soundSystem.playTap();
      await window.API.updateOrderStatus(orderId, status);
      await this.loadOrders();
      if (status === 'READY') {
        window.showToast('🔔 Notification Dispatched', 'Student notified via app that food is ready for pickup!', 'kitchen');
      }
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  },

  async verifyAndComplete(orderId, expectedOtp) {
    const inputOtp = prompt(`Enter student 4-digit Pickup OTP (Hint: ${expectedOtp}):`, expectedOtp);
    if (!inputOtp) return;

    try {
      await window.API.updateOrderStatus(orderId, 'COMPLETED', inputOtp);
      window.soundSystem.playSuccess();
      window.showToast('✅ Order Handed Over', `Order handed over to student successfully!`, 'success');
      await this.loadOrders();
    } catch (err) {
      window.soundSystem.playError();
      alert(err.message);
    }
  },

  initEventListeners() {
    const filterSelect = document.getElementById('kds-vendor-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.activeVendorId = e.target.value;
        this.loadOrders();
      });
    }

    const testBellBtn = document.getElementById('btn-test-kitchen-bell');
    if (testBellBtn) {
      testBellBtn.addEventListener('click', () => {
        window.soundSystem.playKitchenChime();
        window.showToast('🔔 Kitchen Bell', 'Web Audio test bell rang!', 'kitchen');
      });
    }
  }
};

window.KitchenDisplay = KitchenDisplay;
