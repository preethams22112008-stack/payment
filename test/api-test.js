const http = require('http');
const { app, server } = require('../server/server');

// Helper to make local JSON requests
function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Smart Campus Automated Integration Tests ---');
  let failures = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failures++;
    }
  }

  try {
    // 1. Health check
    const health = await request('GET', '/api/health');
    assert(health.status === 200 && health.body.status === 'healthy', 'API Health Check returns 200 Healthy');

    // 2. Auth current user
    const auth = await request('GET', '/api/auth/current');
    assert(auth.status === 200 && auth.body.user.id === 'stu_101', 'Current user defaults to Aarav Sharma (stu_101)');
    const initialBalance = auth.body.user.wallet.balance;

    // 3. Dynamic token generation
    const tokenRes = await request('GET', '/api/auth/card/token/stu_101');
    assert(tokenRes.status === 200 && tokenRes.body.rawToken.startsWith('CAMPUS-ID:'), 'Dynamic HMAC-SHA256 token generated');
    const dynamicToken = tokenRes.body.rawToken;

    // 4. Online UPI Recharge (Mock Gateway)
    const rechargeInit = await request('POST', '/api/wallet/recharge/initiate', {
      studentId: 'stu_101',
      amount: 500,
      upiApp: 'PhonePe'
    });
    assert(rechargeInit.status === 200 && rechargeInit.body.upiUri.includes('upi://pay'), 'UPI Payment Intent URI generated');

    const rechargeVerify = await request('POST', '/api/wallet/recharge/verify', {
      studentId: 'stu_101',
      amount: 500,
      transactionReference: rechargeInit.body.transactionReference,
      scenario: 'SUCCESS',
      upiApp: 'PhonePe'
    });
    assert(rechargeVerify.status === 200 && rechargeVerify.body.newBalance === initialBalance + 500, 'Wallet credited ₹500 via mock UPI gateway');

    // 5. Merchant POS Offline ID Micro-Payment using the dynamic token
    const posAuth = await request('POST', '/api/pos/authorize', {
      token: dynamicToken,
      amount: 55.00,
      vendorId: 'ven_canteen',
      posTerminalId: 'POS-TERM-CANTEEN-01',
      itemsSummary: 'Masala Dosa'
    });
    assert(posAuth.status === 200 && posAuth.body.authorization.status === 'APPROVED', 'Merchant POS authorizes dynamic token');
    assert(posAuth.body.authorization.verificationMethod === 'CRYPTOGRAPHIC_HMAC_SHA256', 'Verified via CRYPTOGRAPHIC_HMAC_SHA256');

    // 6. Test Replay Attack Prevention (using same token again)
    const replayAuth = await request('POST', '/api/pos/authorize', {
      token: dynamicToken,
      amount: 20.00,
      vendorId: 'ven_canteen'
    });
    assert(replayAuth.status === 401 && replayAuth.body.error.includes('replay'), 'Security: Replay attack blocked on consumed nonce');

    // 7. Merchant POS Hardware NFC Card UID Tap (e.g. NFC-8A7F-B21C)
    const nfcAuth = await request('POST', '/api/pos/authorize', {
      token: 'NFC-8A7F-B21C',
      amount: 20.00,
      vendorId: 'ven_canteen',
      itemsSummary: 'Filter Coffee'
    });
    assert(nfcAuth.status === 200 && nfcAuth.body.authorization.verificationMethod === 'HARDWARE_NFC_CARD_UID', 'Direct NFC Card UID tap authorized');

    // 8. Swiggy/Zepto style pre-ordering
    const preOrder = await request('POST', '/api/orders/create', {
      studentId: 'stu_101',
      vendorId: 'ven_canteen',
      items: [
        { id: 'item_c3', name: 'Crispy Samosa (Set of 2)', qty: 2, price: 30.00 }
      ],
      scheduledTime: 'Pickup in 15 mins',
      notes: 'Extra chutney please'
    });
    assert(preOrder.status === 200 && preOrder.body.order.orderNumber.startsWith('ORD-'), 'Pre-order placed successfully from wallet balance');
    const orderId = preOrder.body.order.id;
    const pickupOtp = preOrder.body.order.pickupOtp;

    // 9. Kitchen Display status transition
    const prepStatus = await request('POST', `/api/orders/${orderId}/status`, { status: 'PREPARING' });
    assert(prepStatus.status === 200 && prepStatus.body.order.status === 'PREPARING', 'KDS transitions order to PREPARING');

    const readyStatus = await request('POST', `/api/orders/${orderId}/status`, { status: 'READY' });
    assert(readyStatus.status === 200 && readyStatus.body.order.status === 'READY', 'KDS transitions order to READY');

    const completeStatus = await request('POST', `/api/orders/${orderId}/status`, {
      status: 'COMPLETED',
      verifiedOtp: pickupOtp
    });
    assert(completeStatus.status === 200 && completeStatus.body.order.status === 'COMPLETED', 'KDS completes order with pickup OTP verification');

    // 10. Stationery Printout Quote Calculator
    const printQuote = await request('POST', '/api/orders/print/quote', {
      pageCount: 15,
      colorMode: 'BW',
      doubleSided: false,
      copies: 2,
      binding: 'SPIRAL'
    });
    assert(printQuote.status === 200 && printQuote.body.totalCost === 130.00, 'Printout quote calculates pages and binding accurately (₹130.00)');

    // 11. Admin Metrics & Audit
    const adminMetrics = await request('GET', '/api/admin/metrics');
    assert(adminMetrics.status === 200 && adminMetrics.body.metrics.totalGmv > 0, 'Admin metrics aggregates campus GMV and transaction counts');

    const auditLogs = await request('GET', '/api/admin/audit-logs');
    assert(auditLogs.status === 200 && auditLogs.body.auditLogs.length > 0, 'Tamper-evident audit log records events');

    console.log('\n========================================');
    if (failures === 0) {
      console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!');
    } else {
      console.error(`💥 ${failures} TESTS FAILED!`);
    }
    console.log('========================================');

    server.close();
    process.exit(failures === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test run encountered unexpected error:', err);
    server.close();
    process.exit(1);
  }
}

// Start tests once server is ready
runTests();
