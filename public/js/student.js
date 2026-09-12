/**
 * Student / Parent Portal Logic
 */

const StudentApp = {
  activeStudent: null,
  activeVendorId: 'ven_canteen',
  allVendors: [],
  cart: [],
  tokenRefreshInterval: null,
  tokenRemainingSeconds: 30,
  currentDynamicToken: null,
  spendChart: null,

  async init(userData) {
    this.activeStudent = userData;
    this.renderCard();
    this.renderWallet();
    await this.loadVendors();
    await this.loadOrders();
    this.initTokenGenerator();
    this.initEventListeners();
    this.initSpendingChart();

    // Listen for real-time wallet balance changes
    window.wsManager.on('WALLET_BALANCE_UPDATED', (payload) => {
      if (payload.studentId === this.activeStudent.id) {
        this.activeStudent.wallet.balance = payload.newBalance;
        if (payload.dailySpendLimit) this.activeStudent.wallet.dailySpendLimit = payload.dailySpendLimit;
        if (payload.deductionAmount) {
          this.activeStudent.wallet.todaySpent = (this.activeStudent.wallet.todaySpent || 0) + payload.deductionAmount;
        }
        this.renderWallet();
      }
    });

    // Listen for order status changes
    window.wsManager.on('ORDER_STATUS_CHANGED', (payload) => {
      if (payload.studentId === this.activeStudent.id) {
        if (payload.status === 'READY') {
          window.soundSystem.playKitchenChime();
          window.showToast(
            '🔔 Order Ready for Pickup!',
            `Your order ${payload.order.orderNumber} is ready at ${payload.order.vendorName}. Pickup OTP: ${payload.order.pickupOtp}`,
            'kitchen'
          );
        }
        this.loadOrders();
      }
    });
  },

  renderCard() {
    const s = this.activeStudent;
    if (!s) return;

    // Front
    const nameEl = document.getElementById('card-student-name');
    const rollEl = document.getElementById('card-student-roll');
    const deptEl = document.getElementById('card-student-dept');
    const photoEl = document.getElementById('card-student-photo');
    const uidEl = document.getElementById('card-student-uid');
    const statusEl = document.getElementById('card-status-badge');

    if (nameEl) nameEl.textContent = s.name;
    if (rollEl) rollEl.textContent = s.rollNo;
    if (deptEl) deptEl.textContent = s.department || 'Undergraduate';
    if (photoEl) photoEl.src = s.avatar;
    if (uidEl) uidEl.textContent = s.card ? s.card.cardUid : 'N/A';

    if (statusEl && s.card) {
      statusEl.className = `badge ${s.card.status === 'ACTIVE' ? 'badge-emerald' : 'badge-rose'}`;
      statusEl.textContent = s.card.status;
    }

    // Back barcode
    const barcodeNumEl = document.getElementById('card-barcode-text');
    if (barcodeNumEl && s.card) {
      barcodeNumEl.textContent = s.card.barcodeNumber || s.rollNo;
    }
  },

  renderWallet() {
    const w = this.activeStudent.wallet;
    if (!w) return;

    const balEl = document.getElementById('student-wallet-bal');
    if (balEl) balEl.textContent = w.balance.toFixed(2);

    const todaySpentEl = document.getElementById('budget-today-spent');
    const dailyLimitEl = document.getElementById('budget-daily-limit');
    const progressFill = document.getElementById('budget-progress-fill');

    const spent = w.todaySpent || 0;
    const limit = w.dailySpendLimit || 300;
    const percent = Math.min(100, Math.round((spent / limit) * 100));

    if (todaySpentEl) todaySpentEl.textContent = `₹${spent.toFixed(2)}`;
    if (dailyLimitEl) dailyLimitEl.textContent = `₹${limit.toFixed(2)}`;
    if (progressFill) {
      progressFill.style.width = `${percent}%`;
      progressFill.className = percent > 85 ? 'progress-fill warning' : 'progress-fill';
    }

    // Update daily limit input slider
    const limitSlider = document.getElementById('daily-limit-input');
    const limitVal = document.getElementById('daily-limit-display-val');
    if (limitSlider) limitSlider.value = limit;
    if (limitVal) limitVal.textContent = `₹${limit}`;
  },

  async initTokenGenerator() {
    const fetchFreshToken = async () => {
      try {
        if (!this.activeStudent || !this.activeStudent.card || this.activeStudent.card.status === 'FROZEN') return;
        const res = await window.API.getCardDynamicToken(this.activeStudent.id);
        this.currentDynamicToken = res.rawToken;
        this.tokenRemainingSeconds = 30;

        // Render QR Code (Using dynamic SVG or clean QR API)
        const qrContainer = document.getElementById('card-crypto-qr');
        if (qrContainer) {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(res.rawToken)}&format=svg`;
          qrContainer.innerHTML = `<img src="${qrUrl}" alt="Cryptographic Dynamic Barcode" class="crypto-qr-img" />`;
        }

        const tokenHashEl = document.getElementById('card-token-hash');
        if (tokenHashEl && res.tokenObj) {
          tokenHashEl.textContent = `HMAC: ${res.tokenObj.sig.substring(0, 12)}...`;
        }
      } catch (err) {
        console.warn('Could not generate dynamic token (card may be frozen):', err.message);
      }
    };

    await fetchFreshToken();

    if (this.tokenRefreshInterval) clearInterval(this.tokenRefreshInterval);
    this.tokenRefreshInterval = setInterval(() => {
      this.tokenRemainingSeconds--;
      const timerEl = document.getElementById('token-timer-sec');
      if (timerEl) timerEl.textContent = `${this.tokenRemainingSeconds}s`;

      if (this.tokenRemainingSeconds <= 0) {
        fetchFreshToken();
      }
    }, 1000);
  },

  async loadVendors() {
    try {
      const res = await window.API.getVendors();
      this.allVendors = res.vendors || [];
      this.renderVendorTabs();
      this.renderMenu();
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  },

  renderVendorTabs() {
    const container = document.getElementById('vendor-tabs-list');
    if (!container) return;

    container.innerHTML = this.allVendors.map((v) => `
      <button class="vendor-tab-btn ${v.id === this.activeVendorId ? 'active' : ''}" data-vendor-id="${v.id}">
        <span class="vendor-tab-name">${v.shortName}</span>
        <span class="vendor-tab-meta">⏱️ ${v.prepTimeEstimate} • ⭐ ${v.rating}</span>
      </button>
    `).join('');

    container.querySelectorAll('.vendor-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeVendorId = btn.dataset.vendorId;
        this.renderVendorTabs();
        this.renderMenu();
      });
    });
  },

  renderMenu() {
    const vendor = this.allVendors.find((v) => v.id === this.activeVendorId);
    if (!vendor) return;

    const bannerImg = document.getElementById('vendor-banner-img');
    const vendorTitle = document.getElementById('vendor-banner-title');
    const vendorTagline = document.getElementById('vendor-banner-tagline');
    const vendorLocation = document.getElementById('vendor-banner-location');

    if (bannerImg) bannerImg.src = vendor.bannerImage;
    if (vendorTitle) vendorTitle.textContent = vendor.name;
    if (vendorTagline) vendorTagline.textContent = vendor.tagline;
    if (vendorLocation) vendorLocation.textContent = `📍 ${vendor.counterLocation}`;

    // Switch between food menu and stationery studio
    const isPrintHub = vendor.id === 'ven_printshop';
    const printStudioWrap = document.getElementById('print-studio-container');
    const foodGridWrap = document.getElementById('food-menu-container');

    if (printStudioWrap) printStudioWrap.style.display = isPrintHub ? 'block' : 'none';
    if (foodGridWrap) foodGridWrap.style.display = isPrintHub ? 'none' : 'grid';

    if (!isPrintHub && foodGridWrap) {
      const searchQuery = (document.getElementById('menu-search-input')?.value || '').toLowerCase();
      const vegOnly = document.getElementById('veg-only-toggle')?.checked || false;

      let items = vendor.menu || [];
      if (searchQuery) {
        items = items.filter((i) => i.name.toLowerCase().includes(searchQuery) || i.description.toLowerCase().includes(searchQuery));
      }
      if (vegOnly) {
        items = items.filter((i) => i.isVeg);
      }

      foodGridWrap.innerHTML = items.map((item) => {
        const inCart = this.cart.find((c) => c.id === item.id);
        const qty = inCart ? inCart.qty : 0;

        return `
          <div class="food-card" data-item-id="${item.id}">
            <div class="food-card-img-wrapper">
              <img src="${item.image}" alt="${item.name}" class="food-card-img" loading="lazy" />
              <div class="prep-badge">⚡ ${item.prepTime}</div>
            </div>
            <div class="food-card-body">
              <div>
                <div class="food-card-header">
                  <span class="${item.isVeg ? 'veg-indicator' : 'non-veg-indicator'}" title="${item.isVeg ? 'Vegetarian' : 'Non-Veg'}"></span>
                  <h4 class="food-card-title">${item.name}</h4>
                </div>
                <p class="food-card-desc">${item.description}</p>
              </div>
              <div class="food-card-footer">
                <div class="food-price">₹${item.price.toFixed(2)}</div>
                ${qty === 0 ? `
                  <button class="add-btn" onclick="StudentApp.addToCart('${item.id}')">+ ADD</button>
                ` : `
                  <div class="qty-control">
                    <button class="qty-btn" onclick="StudentApp.changeQty('${item.id}', -1)">-</button>
                    <span class="qty-val">${qty}</span>
                    <button class="qty-btn" onclick="StudentApp.changeQty('${item.id}', 1)">+</button>
                  </div>
                `}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  },

  addToCart(itemId) {
    const vendor = this.allVendors.find((v) => v.id === this.activeVendorId);
    if (!vendor) return;

    const item = vendor.menu.find((i) => i.id === itemId);
    if (!item) return;

    // Check if cart has items from different vendor
    if (this.cart.length > 0 && this.cart[0].vendorId !== vendor.id) {
      if (!confirm(`Your cart already contains items from another vendor. Reset cart to order from ${vendor.shortName}?`)) {
        return;
      }
      this.cart = [];
    }

    const existing = this.cart.find((c) => c.id === item.id);
    if (existing) {
      existing.qty++;
    } else {
      this.cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: 1,
        vendorId: vendor.id,
        vendorName: vendor.name
      });
    }

    window.soundSystem.playTap();
    this.renderMenu();
    this.renderFloatingCart();
  },

  changeQty(itemId, delta) {
    const idx = this.cart.findIndex((c) => c.id === itemId);
    if (idx === -1) return;

    this.cart[idx].qty += delta;
    if (this.cart[idx].qty <= 0) {
      this.cart.splice(idx, 1);
    }

    window.soundSystem.playTap();
    this.renderMenu();
    this.renderFloatingCart();
  },

  renderFloatingCart() {
    const bar = document.getElementById('floating-cart-bar');
    if (!bar) return;

    if (this.cart.length === 0) {
      bar.classList.remove('active');
      return;
    }

    bar.classList.add('active');
    const count = this.cart.reduce((s, i) => s + i.qty, 0);
    const total = this.cart.reduce((s, i) => s + i.price * i.qty, 0);

    const countEl = document.getElementById('cart-floating-count');
    const totalEl = document.getElementById('cart-floating-total');

    if (countEl) countEl.textContent = `${count} ITEM${count > 1 ? 'S' : ''}`;
    if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
  },

  async calculatePrintQuote() {
    const pageCount = parseInt(document.getElementById('print-pages-input')?.value, 10) || 10;
    const copies = parseInt(document.getElementById('print-copies-input')?.value, 10) || 1;
    const colorMode = document.getElementById('print-color-select')?.value || 'BW';
    const doubleSided = document.getElementById('print-duplex-checkbox')?.checked || false;
    const binding = document.getElementById('print-binding-select')?.value || 'NONE';

    try {
      const quote = await window.API.getPrintQuote({
        pageCount,
        copies,
        colorMode,
        doubleSided,
        binding
      });

      const costEl = document.getElementById('print-calc-total');
      const breakdownEl = document.getElementById('print-calc-breakdown');
      if (costEl) costEl.textContent = `₹${quote.totalCost.toFixed(2)}`;
      if (breakdownEl) {
        breakdownEl.textContent = `${pageCount} pages × ${copies} copies (${colorMode === 'COLOR' ? 'Color' : 'B&W'}) + Binding: ₹${quote.bindingCost} • Prep: ${quote.estimatedPrepMinutes}`;
      }

      return quote;
    } catch (err) {
      console.error('Error calculating print quote:', err);
    }
  },

  async addPrintJobToCart() {
    const quote = await this.calculatePrintQuote();
    if (!quote) return;

    // Reset cart if from another vendor
    if (this.cart.length > 0 && this.cart[0].vendorId !== 'ven_printshop') {
      if (!confirm('Cart has items from another shop. Clear and add printout job?')) return;
      this.cart = [];
    }

    const printJobId = `print_job_${Date.now()}`;
    this.cart.push({
      id: printJobId,
      name: `Laser Printout (${quote.pageCount} pgs, ${quote.colorMode}, ${quote.binding} binding)`,
      price: quote.totalCost,
      qty: 1,
      vendorId: 'ven_printshop',
      vendorName: 'Campus Print & Stationery Hub',
      options: quote
    });

    window.soundSystem.playTap();
    window.showToast('📄 Print Job Added', `Added to cart: ₹${quote.totalCost.toFixed(2)}`, 'success');
    this.renderFloatingCart();
  },

  openCheckoutModal() {
    if (this.cart.length === 0) return;

    const modal = document.getElementById('checkout-modal');
    const itemsList = document.getElementById('checkout-items-list');
    const totalEl = document.getElementById('checkout-grand-total');
    const balEl = document.getElementById('checkout-wallet-bal');

    const total = this.cart.reduce((s, i) => s + i.price * i.qty, 0);

    if (itemsList) {
      itemsList.innerHTML = this.cart.map((i) => `
        <div class="bill-line-item">
          <span>${i.name} × ${i.qty}</span>
          <span style="font-family: var(--font-mono); font-weight: 700;">₹${(i.price * i.qty).toFixed(2)}</span>
        </div>
      `).join('');
    }

    if (totalEl) totalEl.textContent = `₹${total.toFixed(2)}`;
    if (balEl) balEl.textContent = `₹${this.activeStudent.wallet.balance.toFixed(2)}`;

    const payBtn = document.getElementById('btn-confirm-checkout');
    if (payBtn) {
      const hasEnough = this.activeStudent.wallet.balance >= total;
      payBtn.disabled = !hasEnough;
      payBtn.textContent = hasEnough ? `Pay ₹${total.toFixed(2)} from Wallet` : 'Insufficient Wallet Balance (Top up)';
    }

    if (modal) modal.classList.add('active');
  },

  async executeCheckout() {
    const total = this.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const vendorId = this.cart[0].vendorId;
    const slot = document.getElementById('checkout-slot-select')?.value || 'ASAP';
    const notes = document.getElementById('checkout-notes-input')?.value || '';

    try {
      const res = await window.API.createPreOrder({
        studentId: this.activeStudent.id,
        vendorId,
        items: this.cart,
        scheduledTime: slot,
        notes,
        orderType: vendorId === 'ven_printshop' ? 'PRE_ORDER_PRINT' : 'PRE_ORDER_FOOD'
      });

      this.cart = [];
      this.renderFloatingCart();
      this.renderMenu();
      document.getElementById('checkout-modal')?.classList.remove('active');

      window.soundSystem.playSuccess();
      window.showToast(
        '🎉 Pre-Order Confirmed!',
        `Order ${res.order.orderNumber} placed at ${res.order.vendorName}. Pickup OTP: ${res.order.pickupOtp}`,
        'success'
      );

      await this.loadOrders();
    } catch (err) {
      window.soundSystem.playError();
      alert(`Pre-order failed: ${err.message}`);
    }
  },

  async loadOrders() {
    try {
      const res = await window.API.getOrders({ studentId: this.activeStudent.id });
      this.renderOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  },

  renderOrders(orders) {
    const container = document.getElementById('active-orders-container');
    if (!container) return;

    if (orders.length === 0) {
      container.innerHTML = `<p style="font-size: 0.82rem; color: var(--text-muted); text-align: center; padding: 20px;">No recent pre-orders. Browse the menu to place an advance order!</p>`;
      return;
    }

    container.innerHTML = orders.slice(0, 5).map((ord) => {
      const isReady = ord.status === 'READY';
      const isPrep = ord.status === 'PREPARING';
      const isDone = ord.status === 'COMPLETED';

      return `
        <div class="order-tracker-card ${isReady ? 'ready' : ''}">
          <div class="tracker-header">
            <div>
              <span class="order-num-tag">${ord.orderNumber}</span>
              <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">• ${ord.vendorName}</span>
            </div>
            <div class="pickup-otp-pill">OTP: ${ord.pickupOtp}</div>
          </div>

          <div class="order-status-steps">
            <div class="order-step-item">
              <div class="step-dot active">✓</div>
              <span class="step-label active">Placed</span>
            </div>
            <div class="order-step-item">
              <div class="step-dot ${isPrep || isReady || isDone ? 'active' : ''}">🍳</div>
              <span class="step-label ${isPrep || isReady || isDone ? 'active' : ''}">Kitchen Prep</span>
            </div>
            <div class="order-step-item">
              <div class="step-dot ${isReady ? 'ready' : isDone ? 'active' : ''}">🔔</div>
              <span class="step-label ${isReady || isDone ? 'active' : ''}">Ready for Pickup</span>
            </div>
            <div class="order-step-item">
              <div class="step-dot ${isDone ? 'active' : ''}">✓</div>
              <span class="step-label ${isDone ? 'active' : ''}">Collected</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-secondary); border-top: 1px solid var(--border-subtle); padding-top: 8px;">
            <span>${ord.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: #ffffff;">₹${ord.totalAmount.toFixed(2)}</span>
          </div>
          ${isReady ? `
            <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid var(--accent-emerald); border-radius: 6px; padding: 6px 10px; font-size: 0.75rem; color: var(--accent-emerald); margin-top: 8px; font-weight: 600;">
              ✨ Ready at Counter: Show 4-digit OTP <strong>${ord.pickupOtp}</strong> or tap your ID card to collect!
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  },

  // UPI Recharge Module
  openUpiModal() {
    const modal = document.getElementById('upi-recharge-modal');
    if (modal) modal.classList.add('active');
    this.updateUpiAmount(500);
  },

  updateUpiAmount(amount) {
    const input = document.getElementById('upi-amount-input');
    if (input) input.value = amount;
    this.generateUpiQr(amount);
  },

  async generateUpiQr(amount) {
    const num = parseFloat(amount) || 100;
    try {
      const res = await window.API.initiateUpiRecharge(this.activeStudent.id, num);
      this.currentUpiInit = res;

      const qrContainer = document.getElementById('upi-dynamic-qr');
      if (qrContainer) {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(res.upiUri)}&format=svg`;
        qrContainer.innerHTML = `<img src="${qrUrl}" alt="UPI Dynamic QR" style="width:100%; height:100%;" />`;
      }

      const refEl = document.getElementById('upi-ref-text');
      if (refEl) refEl.textContent = `Ref: ${res.transactionReference}`;
    } catch (err) {
      console.error('Error initiating UPI recharge:', err);
    }
  },

  async executeUpiPayment(scenario = 'SUCCESS') {
    if (!this.currentUpiInit) return;
    const { studentId, amount, transactionReference } = this.currentUpiInit;
    const upiApp = document.querySelector('input[name="upi-app-radio"]:checked')?.value || 'Google Pay';

    try {
      const res = await window.API.verifyUpiRecharge(studentId, amount, transactionReference, scenario, upiApp);
      document.getElementById('upi-recharge-modal')?.classList.remove('active');

      window.soundSystem.playSuccess();
      window.showToast(
        '💳 UPI Wallet Recharged!',
        `Successfully credited ₹${amount.toFixed(2)} via ${upiApp}. New Balance: ₹${res.newBalance.toFixed(2)}`,
        'success'
      );

      this.activeStudent.wallet.balance = res.newBalance;
      this.renderWallet();
    } catch (err) {
      window.soundSystem.playError();
      window.showToast('❌ UPI Payment Failed', err.message, 'error');
    }
  },

  // Spending Chart
  initSpendingChart() {
    const canvas = document.getElementById('student-spend-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (this.spendChart) this.spendChart.destroy();

    this.spendChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Cafeteria Food', 'Print & Stationery', 'Juices & Healthy'],
        datasets: [{
          data: [145, 75, 70],
          backgroundColor: ['#0ea5e9', '#f97316', '#10b981'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        cutout: '70%'
      }
    });
  },

  initEventListeners() {
    // 3D Card Flip
    const cardWrap = document.getElementById('interactive-id-card');
    const flipBtn = document.getElementById('btn-flip-card');
    if (flipBtn && cardWrap) {
      flipBtn.addEventListener('click', () => {
        cardWrap.classList.toggle('flipped');
        const isFlipped = cardWrap.classList.contains('flipped');
        flipBtn.innerHTML = isFlipped ? '🔄 Flip to Front' : '🔄 Flip to Dynamic Barcode';
      });
    }

    // Direct Test Tap from Student Card
    const testTapBtn = document.getElementById('btn-student-test-tap');
    if (testTapBtn) {
      testTapBtn.addEventListener('click', () => {
        window.soundSystem.playTap();
        // Switch to POS and trigger tap
        const token = this.currentDynamicToken || this.activeStudent.card.cardUid;
        window.MerchantPOS.triggerCardTap(token, this.activeStudent);
        window.showToast('📱 NFC Card Tapped', `Tapped ${this.activeStudent.name}'s card on POS Counter`, 'info');
      });
    }

    // Daily Limit Slider
    const limitSlider = document.getElementById('daily-limit-input');
    const limitVal = document.getElementById('daily-limit-display-val');
    const saveLimitBtn = document.getElementById('btn-save-daily-limit');

    if (limitSlider && limitVal) {
      limitSlider.addEventListener('input', () => {
        limitVal.textContent = `₹${limitSlider.value}`;
      });
    }

    if (saveLimitBtn && limitSlider) {
      saveLimitBtn.addEventListener('click', async () => {
        try {
          const res = await window.API.updateDailyLimit(this.activeStudent.id, limitSlider.value);
          this.activeStudent.wallet.dailySpendLimit = res.wallet.dailySpendLimit;
          this.renderWallet();
          window.showToast('Budget Updated', `Daily spending limit set to ₹${limitSlider.value}`, 'success');
        } catch (err) {
          alert(`Failed to update daily limit: ${err.message}`);
        }
      });
    }

    // Search & Veg filter
    const searchInput = document.getElementById('menu-search-input');
    const vegToggle = document.getElementById('veg-only-toggle');
    if (searchInput) searchInput.addEventListener('input', () => this.renderMenu());
    if (vegToggle) vegToggle.addEventListener('change', () => this.renderMenu());

    // Print studio recalculate on change
    ['print-pages-input', 'print-copies-input', 'print-color-select', 'print-duplex-checkbox', 'print-binding-select'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.calculatePrintQuote());
    });
  }
};

window.StudentApp = StudentApp;
