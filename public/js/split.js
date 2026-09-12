/**
 * Simulation Studio Split-Screen Controller
 */

const SimulationStudio = {
  rightPaneMode: 'pos', // 'pos' | 'kitchen'

  init() {
    this.initEventListeners();
    this.renderRightPane();
  },

  setRightPane(mode) {
    this.rightPaneMode = mode;
    document.querySelectorAll('.right-tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.target === mode);
    });
    this.renderRightPane();
  },

  renderRightPane() {
    const posView = document.getElementById('split-right-pos');
    const kitchenView = document.getElementById('split-right-kitchen');

    if (posView) posView.style.display = this.rightPaneMode === 'pos' ? 'block' : 'none';
    if (kitchenView) kitchenView.style.display = this.rightPaneMode === 'kitchen' ? 'block' : 'none';
  },

  // Interactive 1-click end-to-end demonstrations
  async simTapPayment() {
    window.soundSystem.playTap();
    const student = window.StudentApp?.activeStudent || { name: 'Aarav Sharma', id: 'stu_101', card: { cardUid: 'NFC-8A7F-B21C' } };
    const token = window.StudentApp?.currentDynamicToken || student.card?.cardUid || 'NFC-8A7F-B21C';

    this.setRightPane('pos');

    window.MerchantPOS.currentBill = [
      { name: 'Crispy Samosa (Set of 2)', price: 30.00, qty: 1 },
      { name: 'Filter Coffee', price: 20.00, qty: 1 }
    ];
    window.MerchantPOS.renderBill();

    window.showToast('🚀 Simulation: Offline NFC Tap', 'Simulating student contactless card tap on POS terminal...', 'info');

    setTimeout(async () => {
      await window.MerchantPOS.triggerCardTap(token, student);
    }, 400);
  },

  async simPreOrder() {
    window.soundSystem.playTap();
    const student = window.StudentApp?.activeStudent || { id: 'stu_101', name: 'Aarav Sharma' };

    this.setRightPane('kitchen');

    window.showToast('🚀 Simulation: Food Pre-Order', 'Placing advance canteen order from student phone...', 'info');

    try {
      const res = await window.API.createPreOrder({
        studentId: student.id,
        vendorId: 'ven_canteen',
        items: [
          { id: 'item_c2', name: 'Deluxe Student Mini Thali', qty: 1, price: 90.00 }
        ],
        scheduledTime: 'Pickup in 10 mins',
        notes: 'Simulated fast pre-order'
      });

      window.soundSystem.playSuccess();
      window.showToast('Pre-order Arrived in Kitchen!', `Order ${res.order.orderNumber} sent to KDS with chime!`, 'kitchen');
      await window.KitchenDisplay.loadOrders();
    } catch (err) {
      alert(`Pre-order failed: ${err.message}`);
    }
  },

  async simReadyNotification() {
    this.setRightPane('kitchen');
    const orders = window.KitchenDisplay?.orders || [];
    const activeOrder = orders.find((o) => o.status === 'PLACED' || o.status === 'PREPARING');

    if (!activeOrder) {
      // Create an order first, then mark ready
      await this.simPreOrder();
      setTimeout(async () => {
        const freshOrders = window.KitchenDisplay?.orders || [];
        const newest = freshOrders[0];
        if (newest) {
          await window.KitchenDisplay.updateStatus(newest.id, 'READY');
        }
      }, 800);
      return;
    }

    await window.KitchenDisplay.updateStatus(activeOrder.id, 'READY');
  },

  async simFreezeTest() {
    const student = window.StudentApp?.activeStudent;
    if (!student || !student.card) return;

    const currentStatus = student.card.status;
    const newStatus = currentStatus === 'ACTIVE' ? 'FROZEN' : 'ACTIVE';

    await window.AdminDashboard.toggleFreeze(student.card.cardUid, newStatus);
    student.card.status = newStatus;
    window.StudentApp.renderCard();

    if (newStatus === 'FROZEN') {
      window.showToast('🔒 Security Test', 'Card is now FROZEN! Try tapping on POS to see real-time security rejection.', 'warning');
    } else {
      window.showToast('🔓 Card Unlocked', 'Card is ACTIVE and ready for zero-data tap transactions.', 'success');
    }
  },

  initEventListeners() {
    document.querySelectorAll('.right-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.setRightPane(btn.dataset.target);
      });
    });

    document.getElementById('sim-btn-tap')?.addEventListener('click', () => this.simTapPayment());
    document.getElementById('sim-btn-preorder')?.addEventListener('click', () => this.simPreOrder());
    document.getElementById('sim-btn-ready')?.addEventListener('click', () => this.simReadyNotification());
    document.getElementById('sim-btn-freeze')?.addEventListener('click', () => this.simFreezeTest());
  }
};

window.SimulationStudio = SimulationStudio;
