# 🎓 Smart Campus Micro-Payments & Ordering Ecosystem

A full-stack, enterprise-grade web application with a hybrid online-offline architecture for university campuses. Features digital wallet micro-payments, cryptographic offline NFC/barcode smart ID checkout, Swiggy/Zepto-style canteen & stationery pre-ordering, a live Kitchen Display System (KDS), administrative audit ledgers, and an Apple Liquid Glass user interface with dynamic Light & Dark themes.

---

## 🌟 Key Features

1. **Apple Liquid Glass Interface**:
   - High-refraction acrylic materials (`backdrop-filter: blur(28px) saturate(190%)`), specular prism border reflections, and floating ambient liquid lighting orbs.
   - Dynamic **Theme Switcher** (☀️ Light Mode / 🌙 Dark Mode with OLED pure black background).
2. **Domain-Isolated Login Gateway**:
   - Access is strictly governed by domain rules:
     - 🎓 **Students (`@std`)**: Student & Parent Portal (3D Virtual Smart ID Card, UPI Wallet Top-up, Pre-Orders).
     - 🛒 **Merchants (`@shop`)**: Merchant POS Terminal & Kitchen KDS Display.
     - 📊 **Admins (`@admin`)**: College Management & Financial Ledger.
   - Anti-tampering route guards block unauthorized direct URL hash manipulation.
3. **Offline Zero-Device-Data Micro-Payments**:
   - Students checkout at physical counters using dynamic HMAC-SHA256 signed barcode/NFC ID tokens.
   - **Zero cellular data required on the student's phone** during checkout.
   - Merchant POS connects to local Wi-Fi, authorizes deductions against central ledger, and supports local edge queueing if network drops.
4. **Swiggy / Zepto Style Pre-Ordering**:
   - Advance ordering for cafeteria food and laser stationery/printouts with live preparation pipeline and 4-digit pickup OTP.
5. **Real-time Kitchen Display System (KDS)**:
   - 3-column Kanban queue with second-by-second prep timers (Green ➔ Amber ➔ Flashing Red) and acoustic kitchen bell.

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Application
```bash
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Demo Login Credentials

| Role | Domain Email | Password | Allowed Portal Scope |
| :--- | :--- | :--- | :--- |
| 🎓 **Student** | `aarav.sharma@std` | `campus123` | **Student & Parent App only** |
| 🛒 **Merchant** | `canteen@shop` | `campus123` | **POS Terminal & Kitchen KDS only** |
| 📊 **Admin** | `dean.sundaram@admin` | `campus123` | **Admin Dashboard & Simulation Studio** |

---

## 🧪 Run Tests

```bash
# Integration Tests
npm test

# Domain Authentication & Route Guard Tests
node test/auth-domain-test.js

# Full End-to-End Simulation
node test/e2e-simulator.js
```

---

## 📁 Project Structure

```
├── public/                 # Frontend assets
│   ├── css/                # Apple Liquid Glass stylesheets
│   │   ├── variables.css   # Dark/Light design tokens (pure black canvas)
│   │   ├── liquid-glass.css# Acrylic materials & ambient orbs
│   │   ├── login.css       # Gateway login styles
│   │   ├── student.css     # 3D ID card & pre-orders
│   │   ├── pos.css         # Cashier billing & NFC pad
│   │   └── kitchen.css     # KDS Kanban queue
│   ├── js/                 # Client logic
│   │   ├── api.js          # REST API client with session tokens
│   │   ├── audio.js        # Web Audio API synthesizer
│   │   ├── ws.js           # Real-time WebSocket manager
│   │   ├── student.js      # Virtual card & UPI top-up
│   │   ├── pos.js          # POS NFC tap & receipt slips
│   │   ├── kitchen.js      # Kitchen timers & OTP handover
│   │   ├── admin.js        # Analytics & ledger
│   │   └── app.js          # Route guards & theme engine
│   └── index.html          # Main HTML structure
├── server/                 # Backend Node.js / Express
│   ├── crypto/             # HMAC-SHA256 token verification
│   ├── data/               # Persistent store & initial seed data
│   ├── routes/             # Auth, Wallet, POS, Orders, Admin
│   ├── websocket.js        # Real-time broadcast bus
│   └── server.js           # Express app setup
├── test/                   # Integration and simulation test suites
├── .gitignore              # Excludes node_modules
├── index.js                # Root entry point
└── package.json            # Project dependencies & scripts
```

---

## 📄 License
MIT
