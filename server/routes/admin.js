const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { broadcast } = require('../websocket');
const crypto = require('crypto');

// Campus executive metrics
router.get('/metrics', (req, res) => {
  const metrics = store.getAdminMetrics();
  res.json({ metrics });
});

// Full transaction ledger with search and filters
router.get('/transactions', (req, res) => {
  const { studentId, vendorId, type, search } = req.query;
  let txns = store.getTransactions({ studentId, vendorId, type });

  if (search) {
    const s = search.toLowerCase();
    txns = txns.filter(t =>
      (t.studentName && t.studentName.toLowerCase().includes(s)) ||
      (t.rollNo && t.rollNo.toLowerCase().includes(s)) ||
      (t.authCryptogram && t.authCryptogram.toLowerCase().includes(s)) ||
      (t.vendorName && t.vendorName.toLowerCase().includes(s)) ||
      (t.id && t.id.toLowerCase().includes(s))
    );
  }

  res.json({
    totalCount: txns.length,
    transactions: txns
  });
});

// System Audit Logs
router.get('/audit-logs', (req, res) => {
  const logs = store.getAuditLogs(150);
  res.json({ auditLogs: logs });
});

// Student Management Directory
router.get('/students', (req, res) => {
  const students = store.getUsers().filter(u => u.role === 'STUDENT');
  res.json({ students });
});

// Freeze or Unfreeze a student ID card (e.g. Lost card report)
router.post('/cards/:cardUid/freeze', (req, res) => {
  const { cardUid } = req.params;
  const { status = "FROZEN", reason = "Reported lost by student/parent" } = req.body;

  if (!["ACTIVE", "FROZEN"].includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be ACTIVE or FROZEN" });
  }

  const student = store.setCardStatus(cardUid, status);
  if (!student) {
    return res.status(404).json({ error: `Card UID [${cardUid}] not found` });
  }

  store.logAudit(
    status === 'FROZEN' ? 'CARD_FROZEN' : 'CARD_UNFROZEN',
    'ADMIN_PORTAL',
    `Card [${cardUid}] for ${student.name} (${student.rollNo}) set to ${status}. Reason: ${reason}`,
    status === 'FROZEN' ? 'WARN' : 'INFO'
  );

  broadcast('CARD_STATUS_CHANGED', {
    cardUid,
    status,
    studentId: student.id,
    studentName: student.name
  });

  res.json({
    success: true,
    message: `Card [${cardUid}] is now ${status}`,
    student
  });
});

// Grant campus subsidy / scholarship welfare credit
router.post('/students/:studentId/subsidy', (req, res) => {
  const { studentId } = req.params;
  const { amount = 200.00, subsidyReason = "Campus Merit Subsidy" } = req.body;
  const numAmount = parseFloat(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Valid positive subsidy amount required" });
  }

  const student = store.getUser(studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const updatedWallet = store.updateWallet(studentId, numAmount, false);
  const authCryptogram = `SUB-${Date.now().toString(16).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const txn = store.addTransaction({
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    vendorId: null,
    vendorName: "University Financial Aid Office",
    amount: numAmount,
    type: "CAMPUS_SUBSIDY_GRANT",
    method: "INSTITUTIONAL_CREDIT",
    posTerminalId: "ADMIN_CONSOLE",
    authCryptogram,
    itemsSummary: subsidyReason,
    note: `Granted by Campus Administration: ${subsidyReason}`
  });

  store.logAudit(
    'SUBSIDY_GRANTED',
    'ADMIN_PORTAL',
    `Granted ₹${numAmount.toFixed(2)} campus subsidy to ${student.name} (${student.rollNo}). Ref: ${authCryptogram}`,
    'INFO'
  );

  broadcast('WALLET_BALANCE_UPDATED', {
    studentId: student.id,
    newBalance: updatedWallet.balance,
    rechargeAmount: numAmount,
    transaction: txn
  });

  res.json({
    success: true,
    message: `Successfully credited ₹${numAmount.toFixed(2)} subsidy to ${student.name}`,
    transaction: txn,
    newBalance: updatedWallet.balance
  });
});

// Reset store to fresh default seed data
router.post('/reset', (req, res) => {
  store.reset();
  broadcast('STORE_RESET', { timestamp: new Date().toISOString() });
  res.json({ success: true, message: "Campus ledger and state reset to factory seed data" });
});

module.exports = router;
