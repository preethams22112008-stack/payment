/**
 * Admin & Management Dashboard Logic
 */

const AdminDashboard = {
  vendorChart: null,
  splitChart: null,

  async init() {
    await this.loadMetrics();
    await this.loadTransactions();
    await this.loadAuditLogs();
    await this.loadStudentsDirectory();
    this.initEventListeners();

    // Listen for real-time events to update admin live feed
    window.wsManager.on('TRANSACTION_NEW', () => {
      this.loadMetrics();
      this.loadTransactions();
    });
    window.wsManager.on('WALLET_BALANCE_UPDATED', () => {
      this.loadMetrics();
      this.loadStudentsDirectory();
    });
    window.wsManager.on('CARD_STATUS_CHANGED', () => {
      this.loadStudentsDirectory();
    });
  },

  async loadMetrics() {
    try {
      const res = await window.API.getAdminMetrics();
      const m = res.metrics;

      document.getElementById('kpi-campus-gmv').textContent = `₹${m.totalGmv.toFixed(2)}`;
      document.getElementById('kpi-offline-micropay').textContent = `₹${m.offlineTotal.toFixed(2)}`;
      document.getElementById('kpi-offline-count').textContent = `${m.microPaymentCount} offline taps`;
      document.getElementById('kpi-preorders-vol').textContent = `₹${m.preOrderTotal.toFixed(2)}`;
      document.getElementById('kpi-preorders-count').textContent = `${m.preOrderCount} orders`;
      document.getElementById('kpi-upi-recharge').textContent = `₹${m.upiRechargeTotal.toFixed(2)}`;
      document.getElementById('kpi-active-cards').textContent = `${m.activeCards} Active / ${m.frozenCards} Frozen`;

      this.renderCharts(m);
    } catch (err) {
      console.error('Failed to load admin metrics:', err);
    }
  },

  renderCharts(metrics) {
    if (typeof Chart === 'undefined') return;

    // 1. Vendor Revenue Bar Chart
    const vendorCanvas = document.getElementById('chart-vendor-revenue');
    if (vendorCanvas) {
      if (this.vendorChart) this.vendorChart.destroy();

      const labels = Object.keys(metrics.vendorRevenue || {});
      const data = Object.values(metrics.vendorRevenue || {});

      this.vendorChart = new Chart(vendorCanvas, {
        type: 'bar',
        data: {
          labels: labels.length ? labels : ['Cafeteria', 'Juice Bar', 'Print Hub'],
          datasets: [{
            label: 'Revenue (₹)',
            data: data.length ? data : [145, 70, 75],
            backgroundColor: ['#0ea5e9', '#10b981', '#f97316'],
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } },
            y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
          }
        }
      });
    }

    // 2. Offline vs Online Donut Chart
    const splitCanvas = document.getElementById('chart-payment-split');
    if (splitCanvas) {
      if (this.splitChart) this.splitChart.destroy();

      this.splitChart = new Chart(splitCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Offline ID Micro-Payments', 'Online Pre-Orders', 'UPI Top-ups'],
          datasets: [{
            data: [metrics.offlineTotal || 100, metrics.preOrderTotal || 50, metrics.upiRechargeTotal || 150],
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
          cutout: '68%'
        }
      });
    }
  },

  async loadTransactions() {
    try {
      const type = document.getElementById('admin-txn-filter-type')?.value || '';
      const search = document.getElementById('admin-txn-search')?.value || '';
      const res = await window.API.getAdminTransactions({ type, search });

      const tbody = document.getElementById('admin-transactions-tbody');
      if (!tbody) return;

      if (!res.transactions || res.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;">No transactions matching filters</td></tr>`;
        return;
      }

      tbody.innerHTML = res.transactions.map((t) => {
        let badgeClass = 'badge-cyan';
        if (t.type === 'ONLINE_UPI_RECHARGE') badgeClass = 'badge-emerald';
        if (t.type === 'ONLINE_PREORDER') badgeClass = 'badge-orange';
        if (t.type === 'CAMPUS_SUBSIDY_GRANT') badgeClass = 'badge-purple';

        return `
          <tr>
            <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(t.timestamp).toLocaleTimeString()}</td>
            <td><strong>${t.studentName || 'Campus User'}</strong> <span style="font-size:0.72rem; color:var(--text-muted);">(${t.rollNo || 'N/A'})</span></td>
            <td>${t.vendorName || 'Central Bank UPI'}</td>
            <td><span class="badge ${badgeClass}">${t.type.replace(/_/g, ' ')}</span></td>
            <td style="font-family: var(--font-mono); font-weight: 700; color: #ffffff;">₹${t.amount.toFixed(2)}</td>
            <td class="mono-cell">${t.authCryptogram || 'N/A'}</td>
            <td><span class="badge badge-emerald">VERIFIED</span></td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  },

  async loadAuditLogs() {
    try {
      const res = await window.API.getAuditLogs();
      const tbody = document.getElementById('admin-audit-tbody');
      if (!tbody) return;

      tbody.innerHTML = (res.auditLogs || []).slice(0, 20).map((log) => `
        <tr>
          <td style="font-size: 0.78rem; color: var(--text-muted);">${new Date(log.timestamp).toLocaleTimeString()}</td>
          <td><span class="badge ${log.severity === 'WARN' ? 'badge-amber' : log.severity === 'ERROR' ? 'badge-rose' : 'badge-cyan'}">${log.action}</span></td>
          <td><strong>${log.actor}</strong></td>
          <td style="font-size: 0.8rem; color: var(--text-secondary);">${log.details}</td>
          <td class="mono-cell">${log.ipAddress}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  },

  async loadStudentsDirectory() {
    try {
      const res = await window.API.getStudentsDirectory();
      const tbody = document.getElementById('admin-students-tbody');
      if (!tbody) return;

      tbody.innerHTML = (res.students || []).map((s) => {
        const isFrozen = s.card && s.card.status === 'FROZEN';

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 10px;">
                <img src="${s.avatar}" alt="${s.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover;" />
                <div>
                  <strong>${s.name}</strong>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${s.rollNo}</div>
                </div>
              </div>
            </td>
            <td>${s.department}</td>
            <td class="mono-cell">${s.card ? s.card.cardUid : 'N/A'}</td>
            <td style="font-family: var(--font-mono); font-weight: 700; color: #ffffff;">₹${s.wallet ? s.wallet.balance.toFixed(2) : '0.00'}</td>
            <td>
              <span class="badge ${isFrozen ? 'badge-rose' : 'badge-emerald'}">
                ${isFrozen ? 'FROZEN' : 'ACTIVE'}
              </span>
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn ${isFrozen ? 'btn-success' : 'btn-danger'}" style="font-size: 0.75rem; padding: 4px 10px;" onclick="AdminDashboard.toggleFreeze('${s.card.cardUid}', '${isFrozen ? 'ACTIVE' : 'FROZEN'}')">
                  ${isFrozen ? '🔓 Unfreeze' : '🔒 Freeze Card'}
                </button>
                <button class="btn btn-outline" style="font-size: 0.75rem; padding: 4px 10px;" onclick="AdminDashboard.grantSubsidy('${s.id}', '${s.name}')">
                  🎁 Grant Subsidy
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load students directory:', err);
    }
  },

  async toggleFreeze(cardUid, newStatus) {
    if (!confirm(`Are you sure you want to set Card [${cardUid}] to ${newStatus}?`)) return;

    try {
      await window.API.toggleCardFreeze(cardUid, newStatus, 'Action by Campus Security / Admin');
      window.soundSystem.playTap();
      window.showToast(
        'Card Status Changed',
        `Card UID ${cardUid} is now ${newStatus}`,
        newStatus === 'FROZEN' ? 'warning' : 'success'
      );
      await this.loadStudentsDirectory();
      await this.loadAuditLogs();
    } catch (err) {
      alert(`Action failed: ${err.message}`);
    }
  },

  async grantSubsidy(studentId, studentName) {
    const amountStr = prompt(`Enter welfare subsidy amount to credit to ${studentName} (₹):`, '200');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) return alert('Invalid amount');

    try {
      await window.API.grantSubsidy(studentId, amount, 'University Student Welfare Food Subsidy');
      window.soundSystem.playSuccess();
      window.showToast('🎁 Subsidy Credited', `Credited ₹${amount.toFixed(2)} to ${studentName}'s campus wallet!`, 'success');
      await this.loadMetrics();
      await this.loadTransactions();
      await this.loadStudentsDirectory();
    } catch (err) {
      alert(`Failed to grant subsidy: ${err.message}`);
    }
  },

  exportCsv() {
    window.API.getAdminTransactions().then((res) => {
      const txns = res.transactions || [];
      const headers = ['Transaction ID', 'Timestamp', 'Student Name', 'Roll No', 'Vendor', 'Type', 'Amount (INR)', 'Auth Cryptogram', 'Verification Method'];
      const rows = txns.map((t) => [
        t.id,
        t.timestamp,
        `"${t.studentName || ''}"`,
        t.rollNo || '',
        `"${t.vendorName || ''}"`,
        t.type,
        t.amount,
        t.authCryptogram || '',
        t.method || ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `campus_audit_ledger_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    });
  },

  initEventListeners() {
    const filterType = document.getElementById('admin-txn-filter-type');
    const searchInput = document.getElementById('admin-txn-search');
    const exportBtn = document.getElementById('btn-export-csv');

    if (filterType) filterType.addEventListener('change', () => this.loadTransactions());
    if (searchInput) searchInput.addEventListener('input', () => this.loadTransactions());
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportCsv());
  }
};

window.AdminDashboard = AdminDashboard;
