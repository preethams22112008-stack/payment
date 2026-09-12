const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { broadcast, notifyStudent } = require('../websocket');

// Get wallet details
router.get('/balance/:studentId', (req, res) => {
  const student = store.getUser(req.params.studentId);
  if (!student || !student.wallet) {
    return res.status(404).json({ error: "Student wallet not found" });
  }
  res.json({
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    wallet: student.wallet
  });
});

// Initiate UPI Recharge
router.post('/recharge/initiate', (req, res) => {
  const { studentId, amount, upiApp, payerName } = req.body;
  const numAmount = parseFloat(amount);

  if (!studentId || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Valid studentId and positive recharge amount required" });
  }

  const student = store.getUser(studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const txnRef = `UPI-TXN-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const upiId = "campus.pay@centralbank";
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent("Smart Campus Wallet")}&am=${numAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Topup-${student.rollNo}`)}&tr=${txnRef}`;

  res.json({
    success: true,
    transactionReference: txnRef,
    amount: numAmount,
    studentId: student.id,
    studentName: student.name,
    upiUri,
    merchantVpa: upiId,
    timestamp: new Date().toISOString(),
    expiresInSeconds: 300,
    supportedApps: ["Google Pay", "PhonePe", "Paytm", "BHIM", "CRED UPI"]
  });
});

// Verify and Execute UPI Recharge (Mock Payment Gateway Sandbox)
router.post('/recharge/verify', (req, res) => {
  const { studentId, amount, transactionReference, scenario = "SUCCESS", upiApp = "Google Pay", payerVpa } = req.body;
  const numAmount = parseFloat(amount);

  if (!studentId || isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ error: "Invalid payment verification details" });
  }

  const student = store.getUser(studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  // Handle simulation scenarios
  if (scenario === "DECLINED") {
    store.logAudit(
      'WALLET_RECHARGE_FAILED',
      student.name,
      `UPI payment declined by bank (Ref: ${transactionReference}, Amount: ₹${numAmount})`,
      'WARN'
    );
    return res.status(402).json({
      success: false,
      error: "BANK_DECLINED: Your issuing bank declined the transaction. Check UPI balance/PIN.",
      transactionReference
    });
  }

  if (scenario === "TIMEOUT") {
    return res.status(408).json({
      success: false,
      error: "GATEWAY_TIMEOUT: UPI NPCI gateway took too long to respond. Transaction aborted.",
      transactionReference
    });
  }

  // Success path: Atomic Credit to student's campus ledger
  const updatedWallet = store.updateWallet(studentId, numAmount, false);

  const txn = store.addTransaction({
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    vendorId: null,
    vendorName: "Online UPI Payment Gateway",
    amount: numAmount,
    type: "ONLINE_UPI_RECHARGE",
    method: `UPI_${upiApp.toUpperCase().replace(/\s+/g, '_')}`,
    posTerminalId: null,
    authCryptogram: transactionReference,
    itemsSummary: `Digital Campus Wallet Recharge via ${upiApp}`,
    note: `Online top-up. Payer VPA: ${payerVpa || 'student@okhdfcbank'}`
  });

  store.logAudit(
    'WALLET_RECHARGE_SUCCESS',
    student.name,
    `Successfully credited ₹${numAmount.toFixed(2)} to wallet via UPI (Ref: ${transactionReference})`,
    'INFO'
  );

  // Broadcast real-time balance update
  broadcast('WALLET_BALANCE_UPDATED', {
    studentId: student.id,
    newBalance: updatedWallet.balance,
    rechargeAmount: numAmount,
    transaction: txn
  });

  res.json({
    success: true,
    message: "Wallet recharged successfully",
    transaction: txn,
    newBalance: updatedWallet.balance
  });
});

// Update Daily Spend Limit (Parental / Student Budget control)
router.post('/daily-limit', (req, res) => {
  const { studentId, dailyLimit } = req.body;
  const numLimit = parseFloat(dailyLimit);

  if (!studentId || isNaN(numLimit) || numLimit < 50) {
    return res.status(400).json({ error: "Daily limit must be at least ₹50.00" });
  }

  const updatedWallet = store.updateDailySpendLimit(studentId, numLimit);
  if (!updatedWallet) {
    return res.status(404).json({ error: "Student not found" });
  }

  const student = store.getUser(studentId);
  store.logAudit(
    'BUDGET_LIMIT_UPDATED',
    student.name,
    `Daily spending limit adjusted to ₹${numLimit.toFixed(2)}`,
    'INFO'
  );

  broadcast('WALLET_BALANCE_UPDATED', {
    studentId: student.id,
    newBalance: updatedWallet.balance,
    dailySpendLimit: updatedWallet.dailySpendLimit
  });

  res.json({
    success: true,
    message: "Daily spending limit updated",
    wallet: updatedWallet
  });
});

module.exports = router;
