const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { generateDynamicToken } = require('../crypto/tokenValidator');

// In-memory active session tracking (defaults to null so login is required)
let activeSessions = new Map(); // token -> { user, domain, allowedPortals, expiresAt }
let activeSessionUser = null;

/**
 * Domain-restricted Login Endpoint
 * Allowed domains:
 * - @std    -> Student Portal only
 * - @shop   -> Merchant POS & Kitchen KDS only
 * - @admin  -> Admin & Ledger Dashboard only
 */
router.post('/login', (req, res) => {
  const { email, password = "campus123" } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: "Email address is required." });
  }

  const cleanEmail = email.trim().toLowerCase();

  // 1. Strict Domain Validation
  let domain = null;
  if (cleanEmail.endsWith('@std') || cleanEmail.includes('@std.')) {
    domain = 'std';
  } else if (cleanEmail.endsWith('@shop') || cleanEmail.includes('@shop.')) {
    domain = 'shop';
  } else if (cleanEmail.endsWith('@admin') || cleanEmail.includes('@admin.')) {
    domain = 'admin';
  } else {
    return res.status(403).json({
      error: "ACCESS RESTRICTED: Invalid domain. Access is strictly limited to authorized campus domains: students use @std, merchants use @shop, admins use @admin."
    });
  }

  // 2. Find matching user in directory
  const users = store.getUsers();
  let user = users.find(u => u.email.toLowerCase() === cleanEmail);

  // If specific user not found, find or create default domain persona
  if (!user) {
    if (domain === 'std') {
      user = users.find(u => u.domain === 'std');
    } else if (domain === 'shop') {
      user = users.find(u => u.domain === 'shop');
    } else if (domain === 'admin') {
      user = users.find(u => u.domain === 'admin');
    }
  }

  if (!user) {
    return res.status(404).json({ error: "User account not found for this domain." });
  }

  // Check password if provided
  if (user.password && password && user.password !== password) {
    return res.status(401).json({ error: "Invalid password. (Default demo: campus123)" });
  }

  // Generate session token
  const sessionToken = `SES-${domain.toUpperCase()}-${Date.now().toString(16)}-${Math.random().toString(36).substr(2, 6)}`;
  
  // Set permitted portals strictly based on domain
  let allowedPortals = [];
  if (domain === 'std') {
    allowedPortals = ['student'];
  } else if (domain === 'shop') {
    allowedPortals = ['pos', 'kitchen'];
  } else if (domain === 'admin') {
    allowedPortals = ['admin', 'split'];
  }

  const sessionData = {
    sessionToken,
    user,
    domain,
    role: user.role,
    allowedPortals,
    loginTime: new Date().toISOString()
  };

  activeSessions.set(sessionToken, sessionData);
  activeSessionUser = sessionData;

  store.logAudit(
    'USER_LOGIN_SUCCESS',
    user.name,
    `Logged in via domain @${domain}. Authorized portals: [${allowedPortals.join(', ')}]`,
    'INFO'
  );

  res.json({
    success: true,
    message: `Welcome ${user.name}! Access granted for domain @${domain}.`,
    session: sessionData
  });
});

// Current active session check
router.get('/session', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader ? authHeader.replace('Bearer ', '') : null;

  let session = token ? activeSessions.get(token) : activeSessionUser;
  if (!session) {
    return res.status(401).json({ authenticated: false, error: "No active session. Please log in." });
  }

  // Refresh user data from store
  const freshUser = store.getUser(session.user.id);
  if (freshUser) session.user = freshUser;

  res.json({
    authenticated: true,
    session
  });
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (token) activeSessions.delete(token);
  if (activeSessionUser && activeSessionUser.user) {
    store.logAudit('USER_LOGOUT', activeSessionUser.user.name, `Logged out from domain @${activeSessionUser.domain}`, 'INFO');
  }
  activeSessionUser = null;

  res.json({ success: true, message: "Logged out successfully" });
});

// Switch persona within authorized domain or for testing
router.post('/switch', (req, res) => {
  const { userId } = req.body;
  const user = store.getUser(userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const domain = user.domain || (user.role === 'STUDENT' ? 'std' : user.role === 'ADMIN' ? 'admin' : 'shop');
  let allowedPortals = [];
  if (domain === 'std') allowedPortals = ['student'];
  else if (domain === 'shop') allowedPortals = ['pos', 'kitchen'];
  else if (domain === 'admin') allowedPortals = ['admin', 'split'];

  activeSessionUser = {
    sessionToken: `SES-${domain.toUpperCase()}-${Date.now().toString(16)}`,
    user,
    domain,
    role: user.role,
    allowedPortals,
    loginTime: new Date().toISOString()
  };

  store.logAudit('USER_ROLE_SWITCH', user.name, `Active role switched to ${user.role} (@${domain})`);
  res.json({ success: true, session: activeSessionUser });
});

// Card dynamic HMAC-SHA256 token endpoint
router.get('/card/token/:studentId', (req, res) => {
  const student = store.getUser(req.params.studentId);
  if (!student || !student.card) {
    return res.status(404).json({ error: "Student or card record not found" });
  }

  if (student.card.status === 'FROZEN') {
    return res.status(403).json({ error: "Card is FROZEN. Token cannot be generated." });
  }

  const tokenData = generateDynamicToken(student.id, student.card.cardUid, student.card.secretKey);
  res.json(tokenData);
});

module.exports = router;
