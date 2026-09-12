const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');

const { initWebSocket } = require('./websocket');
const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const posRoutes = require('./routes/pos');
const ordersRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: "healthy",
    system: "Smart Campus Micro-Payments & Ordering Ecosystem",
    version: "1.0.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Fallback for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize WebSocket server
initWebSocket(server);

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(`🎓 SMART CAMPUS MICRO-PAYMENTS & ORDERING ECOSYSTEM`);
  console.log(`📡 Server running at: http://localhost:${PORT}`);
  console.log(`⚡ WebSocket stream mounted at: ws://localhost:${PORT}/ws`);
  console.log('================================================================');
  console.log(`Modules available:`);
  console.log(`1. Student / Parent App:        http://localhost:${PORT}#student`);
  console.log(`2. Merchant POS Counter:         http://localhost:${PORT}#pos`);
  console.log(`3. Vendor Kitchen Display (KDS): http://localhost:${PORT}#kitchen`);
  console.log(`4. Admin / Management Dashboard: http://localhost:${PORT}#admin`);
  console.log(`5. Simulation Studio (Split):   http://localhost:${PORT}#split`);
  console.log('================================================================');
});

module.exports = { app, server };
