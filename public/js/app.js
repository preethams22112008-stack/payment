/**
 * Main Application Orchestrator
 * With Apple Liquid Glass Theme Engine & Domain-Based Access Control
 */

const App = {
  currentSession: null,
  activeModule: null,
  currentTheme: 'dark',

  async init() {
    this.initTheme();
    this.initLoginGateway();
    this.initModals();

    // Verify session
    await this.checkSession();
  },

  // Apple Liquid Glass Theme Engine (Light / Dark)
  initTheme() {
    const savedTheme = localStorage.getItem('campus_theme') || 'dark';
    this.setTheme(savedTheme);

    // Bind all theme toggles (header and login gateway)
    document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        window.soundSystem.playTap();
      });
    });
  },

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('campus_theme', theme);

    if (theme === 'light') {
      document.body.classList.add('theme-light');
      document.querySelectorAll('.theme-toggle-btn').forEach((b) => {
        b.innerHTML = '🌙';
        b.title = 'Switch to Dark Liquid Glass';
      });
    } else {
      document.body.classList.remove('theme-light');
      document.querySelectorAll('.theme-toggle-btn').forEach((b) => {
        b.innerHTML = '☀️';
        b.title = 'Switch to Light Liquid Glass';
      });
    }
  },

  // Check Active Authentication Session
  async checkSession() {
    try {
      const res = await window.API.getSession();
      if (res.authenticated && res.session) {
        this.onLoginSuccess(res.session);
      } else {
        this.showLoginGateway();
      }
    } catch (err) {
      this.showLoginGateway();
    }
  },

  showLoginGateway() {
    this.currentSession = null;
    const overlay = document.getElementById('login-gateway');
    if (overlay) overlay.classList.remove('hidden');
    document.querySelector('.app-header')?.style.setProperty('display', 'none');
    document.querySelectorAll('.module-view').forEach((v) => (v.style.display = 'none'));
  },

  hideLoginGateway() {
    const overlay = document.getElementById('login-gateway');
    if (overlay) overlay.classList.add('hidden');
    document.querySelector('.app-header')?.style.removeProperty('display');
  },

  initLoginGateway() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const cardEl = document.querySelector('.login-glass-card');

    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passInput.value;

        try {
          const res = await window.API.login(email, password);
          window.soundSystem.playSuccess();
          this.onLoginSuccess(res.session);
        } catch (err) {
          window.soundSystem.playError();
          if (cardEl) {
            cardEl.classList.remove('login-shake');
            void cardEl.offsetWidth; // trigger reflow
            cardEl.classList.add('login-shake');
          }
          window.showToast('Login Failed', err.message, 'error');
        }
      });
    }

    // 1-Click Demo Login Shortcuts
    window.quickDemoLogin = async (email) => {
      window.soundSystem.playTap();
      if (emailInput) emailInput.value = email;
      if (passInput) passInput.value = 'campus123';

      try {
        const res = await window.API.login(email, 'campus123');
        window.soundSystem.playSuccess();
        this.onLoginSuccess(res.session);
      } catch (err) {
        window.soundSystem.playError();
        window.showToast('Login Failed', err.message, 'error');
      }
    };
  },

  onLoginSuccess(session) {
    this.currentSession = session;
    this.hideLoginGateway();

    // Render User Header Profile Pill
    this.renderHeaderUser(session);

    // Apply strict Domain Role Guards to Navigation
    this.applyDomainNavigationGuards(session);

    // Initialize modules with user context
    this.initModules(session);

    // Navigate to user's primary permitted portal
    const primaryPortal = session.allowedPortals[0] || 'student';
    window.location.hash = primaryPortal;
    this.switchModule(primaryPortal);

    window.showToast(
      '🌟 Gateway Authenticated',
      `Logged in as ${session.user.name} (@${session.domain} domain)`,
      'success'
    );
  },

  renderHeaderUser(session) {
    const avatarEl = document.getElementById('header-user-avatar');
    const nameEl = document.getElementById('header-user-name');
    const domainEl = document.getElementById('header-user-domain');

    if (avatarEl) avatarEl.src = session.user.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150';
    if (nameEl) nameEl.textContent = session.user.name;

    if (domainEl) {
      domainEl.textContent = `@${session.domain}`;
      domainEl.className = `domain-pill ${session.domain}`;
    }

    // Bind Logout
    const logoutBtn = document.getElementById('btn-header-logout');
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        window.soundSystem.playTap();
        await window.API.logout();
        window.showToast('Logged Out', 'Your session has ended.', 'info');
        this.showLoginGateway();
      };
    }
  },

  // STRICT DOMAIN-BASED ACCESS CONTROL GUARD
  applyDomainNavigationGuards(session) {
    const allowed = session.allowedPortals || [];

    // Hide navigation tabs not permitted for this domain
    document.querySelectorAll('.role-tab').forEach((tab) => {
      const target = tab.dataset.target;
      const isPermitted = allowed.includes(target);

      tab.style.display = isPermitted ? 'inline-flex' : 'none';
      tab.classList.toggle('active', target === allowed[0]);
    });

    // Intercept hash change and enforce domain boundary
    if (!this.hashGuardBound) {
      window.addEventListener('hashchange', () => {
        if (!this.currentSession) return;
        const target = window.location.hash.replace('#', '') || this.currentSession.allowedPortals[0];
        this.verifyAndSwitchRoute(target);
      });
      this.hashGuardBound = true;
    }
  },

  verifyAndSwitchRoute(targetModule) {
    if (!this.currentSession) {
      this.showLoginGateway();
      return;
    }

    const allowed = this.currentSession.allowedPortals || [];

    // DOMAIN ISOLATION CHECK: Block if user's domain does not permit this portal
    if (!allowed.includes(targetModule)) {
      window.soundSystem.playError();
      window.showToast(
        '🚫 ACCESS RESTRICTED',
        `Domain @${this.currentSession.domain} is not authorized to access #${targetModule}. Redirected to your domain portal.`,
        'error'
      );

      // Bounce back to user's first allowed portal
      window.location.hash = allowed[0];
      this.switchModule(allowed[0]);
      return;
    }

    this.switchModule(targetModule);
  },

  switchModule(moduleId) {
    this.activeModule = moduleId;

    // Update nav pills
    document.querySelectorAll('.role-tab').forEach((tab) => {
      tab.classList.toggle('active', tab.dataset.target === moduleId);
    });

    // Update views
    document.querySelectorAll('.module-view').forEach((view) => {
      const isActive = view.id === `view-${moduleId}`;
      view.style.display = isActive ? 'block' : 'none';
      view.classList.toggle('active', isActive);
    });

    // Refresh active module
    if (moduleId === 'student' && this.currentSession?.user) {
      window.StudentApp.init(this.currentSession.user);
    } else if (moduleId === 'pos') {
      window.MerchantPOS.init();
    } else if (moduleId === 'kitchen') {
      window.KitchenDisplay.init();
    } else if (moduleId === 'admin') {
      window.AdminDashboard.init();
    } else if (moduleId === 'split') {
      window.SimulationStudio.init();
    }
  },

  initModules(session) {
    if (session.domain === 'std') {
      window.StudentApp.init(session.user);
    } else if (session.domain === 'shop') {
      window.MerchantPOS.init();
      window.KitchenDisplay.init();
    } else if (session.domain === 'admin') {
      window.AdminDashboard.init();
      window.SimulationStudio.init();
    }
  },

  initModals() {
    // Universal modal close buttons
    document.querySelectorAll('.modal-close, .modal-backdrop').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target === el || e.target.classList.contains('modal-close')) {
          el.closest('.modal-backdrop')?.classList.remove('active');
        }
      });
    });

    // Reset Data Button
    document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
      if (!confirm('Reset all campus wallets, cards, transactions, and orders back to initial factory demo seed data?')) return;
      try {
        await window.API.resetData();
        window.showToast('System Reset', 'All campus ledgers restored to factory seed state.', 'info');
        setTimeout(() => window.location.reload(), 600);
      } catch (err) {
        alert(`Reset failed: ${err.message}`);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
