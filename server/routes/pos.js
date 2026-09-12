const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { validatePaymentToken } = require('../crypto/tokenValidator');
const { broadcast } = require('../websocket');
const crypto = require('crypto');

/**
 * Authorize an Offline ID Micro-Payment at a Merchant POS Terminal
 * The student requires ZERO internet data on their personal device.
 * Merchant POS connects to shop local Wi-Fi / central server.
 */
router.post('/authorize', (req, res) => {
  const { token, amount, vendorId = "ven_canteen", posTerminalId = "POS-TERM-01", itemsSummary = "Quick Counter Purchase" } = req.body;
  const numAmount = parseFloat(amount);

  if (!token) {
    return res.status(400).json({ success: false, error: "Missing ID token / NFC tag data" });
  }

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ success: false, error: "Invalid payment amount. Must be greater than ₹0." });
  }

  // 1. Cryptographic and Identity Validation
  const validation = validatePaymentToken(token);
  if (!validation.valid) {
    store.logAudit(
      'POS_AUTH_REJECTED',
      posTerminalId,
      `Payment declined: ${validation.error} (Input: ${token.substring(0, 30)}...)`,
      'WARN'
    );
    return res.status(401).json({
      success: false,
      errorCode: "TOKEN_INVALID",
      error: validation.error
    });
  }

  const { student, verificationMethod, cardUid } = validation;

  // 2. Card Frozen Check
  if (student.card && student.card.status === 'FROZEN') {
    return res.status(403).json({
      success: false,
      errorCode: "CARD_FROZEN",
      error: "Card is LOCKED. Contact Campus Administration."
    });
  }

  // 3. Daily Spending Limit Check (Parental / Student Safety)
  const wallet = student.wallet;
  const projectedDailySpend = (wallet.todaySpent || 0) + numAmount;
  if (wallet.dailySpendLimit && projectedDailySpend > wallet.dailySpendLimit) {
    const remainingLimit = Math.max(0, wallet.dailySpendLimit - (wallet.todaySpent || 0));
    return res.status(403).json({
      success: false,
      errorCode: "DAILY_LIMIT_EXCEEDED",
      error: `Daily spending limit reached! Limit: ₹${wallet.dailySpendLimit.toFixed(2)}, Available today: ₹${remainingLimit.toFixed(2)}.`
    });
  }

  // 4. Wallet Balance Check
  if (wallet.balance < numAmount) {
    return res.status(402).json({
      success: false,
      errorCode: "INSUFFICIENT_FUNDS",
      error: `Insufficient balance. Current balance: ₹${wallet.balance.toFixed(2)}, Required: ₹${numAmount.toFixed(2)}. Please recharge via UPI.`
    });
  }

  // 5. Vendor Details
  const vendor = store.getVendor(vendorId) || { id: vendorId, name: "Campus Counter", shortName: "Campus Counter" };

  // 6. Atomic Deduction
  const updatedWallet = store.updateWallet(student.id, -numAmount, true);

  // 7. Generate Non-Repudiation Authorization Cryptogram
  const authCryptogram = `AUTH-${Date.now().toString(16).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

  // 8. Record in Transaction Ledger
  const txn = store.addTransaction({
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    vendorId: vendor.id,
    vendorName: vendor.name,
    amount: numAmount,
    type: "OFFLINE_MICROPAYMENT",
    method: verificationMethod,
    posTerminalId,
    authCryptogram,
    itemsSummary,
    note: `Verified via ${verificationMethod} on ${posTerminalId}. Student device required zero internet data.`
  });

  // 9. Audit Logging
  store.logAudit(
    'POS_PAYMENT_SUCCESS',
    posTerminalId,
    `Charged ₹${numAmount.toFixed(2)} to ${student.name} (${student.rollNo}) for ${itemsSummary}. Auth: ${authCryptogram}`,
    'INFO'
  );

  // 10. Real-time broadcast
  broadcast('WALLET_BALANCE_UPDATED', {
    studentId: student.id,
    newBalance: updatedWallet.balance,
    deductionAmount: numAmount,
    transaction: txn
  });

  broadcast('TRANSACTION_NEW', {
    transaction: txn,
    terminalId: posTerminalId
  });

  // 11. Return Authorization Slip for POS Receipt Printing
  res.json({
    success: true,
    message: "Payment authorized successfully",
    authorization: {
      authCryptogram,
      status: "APPROVED",
      timestamp: txn.timestamp,
      amount: numAmount,
      currency: "INR",
      posTerminalId,
      verificationMethod,
      vendor: {
        id: vendor.id,
        name: vendor.name,
        counterLocation: vendor.counterLocation
      },
      student: {
        id: student.id,
        name: student.name,
        rollNo: student.rollNo,
        department: student.department,
        cardUid
      },
      remainingBalance: updatedWallet.balance,
      todayTotalSpent: updatedWallet.todaySpent,
      itemsSummary
    }
  });
});

/**
 * Edge Offline Queue Sync
 * When POS terminal drops Wi-Fi connection and operates in local offline queue mode,
 * it submits stored offline transactions once Wi-Fi is restored.
 */
router.post('/offline-sync', (req, res) => {
  const { posTerminalId, queuedTransactions = [] } = req.body;

  if (!Array.isArray(queuedTransactions) || queuedTransactions.length === 0) {
    return res.json({ success: true, message: "No queued transactions to sync", syncedCount: 0 });
  }

  let syncedCount = 0;
  let rejectedCount = 0;
  const syncResults = [];

  for (const item of queuedTransactions) {
    const { token, amount, offlineTxnId, timestamp, itemsSummary, vendorId } = item;
    const numAmount = parseFloat(amount);

    const validation = validatePaymentToken(token);
    if (!validation.valid) {
      rejectedCount++;
      syncResults.push({ offlineTxnId, status: "REJECTED", reason: validation.error });
      continue;
    }

    const { student, verificationMethod } = validation;
    const vendor = store.getVendor(vendorId) || { id: "ven_canteen", name: "Campus Counter" };

    // Deduct
    const updatedWallet = store.updateWallet(student.id, -numAmount, true);
    const authCryptogram = `SYNC-${Date.now().toString(16).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    const txn = store.addTransaction({
      studentId: student.id,
      studentName: student.name,
      rollNo: student.rollNo,
      vendorId: vendor.id,
      vendorName: vendor.name,
      amount: numAmount,
      type: "OFFLINE_MICROPAYMENT",
      method: `${verificationMethod}_OFFLINE_SYNC`,
      posTerminalId: posTerminalId || "POS-EDGE-OFFLINE",
      authCryptogram,
      itemsSummary: itemsSummary || "Offline Buffered Purchase",
      note: `Offline queue batch sync from local POS buffer. Original Offline ID: ${offlineTxnId}`
    });

    syncedCount++;
    syncResults.push({ offlineTxnId, status: "SYNCED", authCryptogram, newBalance: updatedWallet.balance });
  }

  store.logAudit(
    'POS_OFFLINE_BATCH_SYNC',
    posTerminalId || "POS-EDGE",
    `Synced ${syncedCount} offline queued transactions (${rejectedCount} rejected).`,
    'INFO'
  );

  broadcast('ADMIN_METRICS_UPDATED', store.getAdminMetrics());

  res.json({
    success: true,
    syncedCount,
    rejectedCount,
    results: syncResults
  });
});

module.exports = router;
