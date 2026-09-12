const express = require('express');
const router = express.Router();
const store = require('../data/store');
const { broadcast, notifyStudent } = require('../websocket');
const crypto = require('crypto');

// Get all vendors with menus
router.get('/vendors', (req, res) => {
  res.json({ vendors: store.getVendors() });
});

// List orders with optional filters
router.get('/list', (req, res) => {
  const { studentId, vendorId, status } = req.query;
  const orders = store.getOrders({ studentId, vendorId, status });
  res.json({ orders });
});

// Get single order
router.get('/:id', (req, res) => {
  const order = store.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }
  res.json({ order });
});

// Place advance pre-order (Swiggy / Zepto style)
router.post('/create', (req, res) => {
  const { studentId, vendorId, items, scheduledTime = "ASAP (Instant)", notes = "", orderType = "PRE_ORDER_FOOD" } = req.body;

  if (!studentId || !vendorId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Missing required order parameters (studentId, vendorId, items)" });
  }

  const student = store.getUser(studentId);
  if (!student) {
    return res.status(404).json({ error: "Student not found" });
  }

  const vendor = store.getVendor(vendorId);
  if (!vendor) {
    return res.status(404).json({ error: "Vendor not found" });
  }

  // Calculate order total
  let totalAmount = 0;
  const processedItems = items.map(item => {
    const qty = parseInt(item.qty, 10) || 1;
    const price = parseFloat(item.price) || 0;
    const lineTotal = price * qty;
    totalAmount += lineTotal;
    return {
      id: item.id,
      name: item.name,
      qty,
      price,
      lineTotal,
      options: item.options || null
    };
  });

  totalAmount = parseFloat(totalAmount.toFixed(2));

  // Check wallet balance
  if (student.wallet.balance < totalAmount) {
    return res.status(402).json({
      error: `Insufficient wallet balance for pre-order. Balance: ₹${student.wallet.balance.toFixed(2)}, Order Total: ₹${totalAmount.toFixed(2)}. Top up via UPI first.`
    });
  }

  // Check daily spend limit
  const projectedSpend = (student.wallet.todaySpent || 0) + totalAmount;
  if (student.wallet.dailySpendLimit && projectedSpend > student.wallet.dailySpendLimit) {
    return res.status(403).json({
      error: `Order exceeds daily spending limit (Limit: ₹${student.wallet.dailySpendLimit.toFixed(2)}, Already spent today: ₹${(student.wallet.todaySpent || 0).toFixed(2)})`
    });
  }

  // Deduct funds from wallet
  const updatedWallet = store.updateWallet(student.id, -totalAmount, true);

  // Generate order
  const order = store.createOrder({
    studentId: student.id,
    studentName: student.name,
    studentRoll: student.rollNo,
    studentPhone: student.phone,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorLocation: vendor.counterLocation,
    items: processedItems,
    totalAmount,
    scheduledTime,
    notes,
    orderType
  });

  // Add to transaction ledger
  const authCryptogram = `PRE-${order.orderNumber}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const itemsSummary = processedItems.map(i => `${i.name} x${i.qty}`).join(', ');

  const txn = store.addTransaction({
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    vendorId: vendor.id,
    vendorName: vendor.name,
    amount: totalAmount,
    type: "ONLINE_PREORDER",
    method: "CAMPUS_WALLET",
    posTerminalId: "WEB_APP_PREORDER",
    authCryptogram,
    itemsSummary,
    note: `Pre-ordered at ${vendor.name} (Order: ${order.orderNumber}, Slot: ${scheduledTime})`
  });

  store.logAudit(
    'PREORDER_CREATED',
    student.name,
    `Placed pre-order ${order.orderNumber} for ₹${totalAmount.toFixed(2)} at ${vendor.name}. Pickup OTP: ${order.pickupOtp}`,
    'INFO'
  );

  // Real-time broadcast: Alert Kitchen Display with chime!
  broadcast('KITCHEN_ORDER_NEW', {
    order,
    vendorId: vendor.id,
    alertSound: true
  });

  // Broadcast wallet deduction & transaction
  broadcast('WALLET_BALANCE_UPDATED', {
    studentId: student.id,
    newBalance: updatedWallet.balance,
    deductionAmount: totalAmount,
    transaction: txn
  });

  broadcast('ORDER_CREATED', { order });

  res.json({
    success: true,
    message: "Pre-order placed successfully!",
    order,
    transaction: txn,
    remainingBalance: updatedWallet.balance
  });
});

// Update order lifecycle status (Kitchen Display actions)
router.post('/:id/status', (req, res) => {
  const { status, verifiedOtp } = req.body;
  const validStatuses = ['PLACED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
  }

  const order = store.getOrder(req.params.id);
  if (!order) {
    return res.status(404).json({ error: "Order not found" });
  }

  // If completing, optionally verify pickup OTP
  if (status === 'COMPLETED' && verifiedOtp) {
    if (verifiedOtp.toString().trim() !== order.pickupOtp.toString().trim()) {
      return res.status(400).json({ error: "Incorrect 4-digit pickup OTP" });
    }
  }

  const updatedOrder = store.updateOrderStatus(order.id, status);

  store.logAudit(
    'ORDER_STATUS_CHANGE',
    'KDS_TERMINAL',
    `Order ${order.orderNumber} transitioned to status [${status}]. Student: ${order.studentName}`,
    'INFO'
  );

  // Broadcast update to all connected screens
  broadcast('ORDER_STATUS_CHANGED', {
    order: updatedOrder,
    status,
    studentId: updatedOrder.studentId
  });

  res.json({
    success: true,
    message: `Order status updated to ${status}`,
    order: updatedOrder
  });
});

// Calculate quote for stationery / printouts
router.post('/print/quote', (req, res) => {
  const {
    documentName = "Campus_Assignment.pdf",
    pageCount = 10,
    colorMode = "BW", // BW | COLOR
    doubleSided = false,
    copies = 1,
    binding = "NONE" // NONE | SPIRAL | HARDCOVER
  } = req.body;

  const pages = Math.max(1, parseInt(pageCount, 10) || 1);
  const numCopies = Math.max(1, parseInt(copies, 10) || 1);

  const ratePerPage = colorMode === "COLOR" ? 10.00 : (doubleSided ? 1.50 : 2.00);
  const printingCost = pages * ratePerPage * numCopies;

  let bindingCost = 0;
  if (binding === "SPIRAL") {
    bindingCost = 35.00 * numCopies;
  } else if (binding === "HARDCOVER") {
    bindingCost = 150.00 * numCopies;
  }

  const totalCost = parseFloat((printingCost + bindingCost).toFixed(2));
  const estimatedPrepMinutes = Math.min(25, Math.max(2, Math.round((pages * numCopies) / 20) + (binding !== "NONE" ? 5 : 1)));

  res.json({
    documentName,
    pageCount: pages,
    copies: numCopies,
    colorMode,
    ratePerPage,
    printingCost: parseFloat(printingCost.toFixed(2)),
    binding,
    bindingCost: parseFloat(bindingCost.toFixed(2)),
    totalCost,
    estimatedPrepMinutes: `${estimatedPrepMinutes} mins`,
    vendorId: "ven_printshop"
  });
});

module.exports = router;
