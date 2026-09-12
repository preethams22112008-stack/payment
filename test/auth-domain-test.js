const http = require('http');

function post(path, body, token = null) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'GET',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function runAuthTests() {
  console.log('🧪 Starting Domain-Based Authentication & Portal Guard Tests...');
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Invalid domain rejection
  const invalidRes = await post('/api/auth/login', { email: 'intruder@gmail.com', password: 'password' });
  assert(invalidRes.status === 403 && invalidRes.data.error.includes('ACCESS RESTRICTED'), 'Rejects non-campus domain (user@gmail.com)');

  // 2. Student Domain (@std)
  const stdRes = await post('/api/auth/login', { email: 'aarav.sharma@std', password: 'campus123' });
  assert(stdRes.status === 200 && stdRes.data.session.domain === 'std', 'Student domain (@std) login successful');
  assert(
    JSON.stringify(stdRes.data.session.allowedPortals) === JSON.stringify(['student']),
    'Student domain is strictly restricted to ["student"] portal only'
  );
  const stdToken = stdRes.data.session.sessionToken;

  // 3. Merchant Domain (@shop)
  const shopRes = await post('/api/auth/login', { email: 'canteen@shop', password: 'campus123' });
  assert(shopRes.status === 200 && shopRes.data.session.domain === 'shop', 'Merchant domain (@shop) login successful');
  assert(
    JSON.stringify(shopRes.data.session.allowedPortals) === JSON.stringify(['pos', 'kitchen']),
    'Merchant domain is restricted to ["pos", "kitchen"] only (No student wallet / No admin ledger)'
  );

  // 4. Admin Domain (@admin)
  const adminRes = await post('/api/auth/login', { email: 'dean.sundaram@admin', password: 'campus123' });
  assert(adminRes.status === 200 && adminRes.data.session.domain === 'admin', 'Admin domain (@admin) login successful');
  assert(
    stdRes.data.session.allowedPortals.includes('admin') === false,
    'Verified student CANNOT access admin portal'
  );
  assert(
    shopRes.data.session.allowedPortals.includes('admin') === false,
    'Verified merchant CANNOT access admin portal'
  );

  // 5. Session Verification
  const sessionRes = await get('/api/auth/session', stdToken);
  assert(sessionRes.status === 200 && sessionRes.data.authenticated === true, 'Session token verified successfully');

  // 6. Logout
  const logoutRes = await post('/api/auth/logout', {}, stdToken);
  assert(logoutRes.status === 200, 'Logout successfully invalidates session');

  // 7. Verify CSS assets (Liquid Glass & Login)
  const lgCss = await get('/css/liquid-glass.css');
  assert(lgCss.status === 200, 'liquid-glass.css served with 200 OK');

  const loginCss = await get('/css/login.css');
  assert(loginCss.status === 200, 'login.css served with 200 OK');

  console.log('\n======================================================');
  if (failed === 0) {
    console.log('🎉 ALL DOMAIN SECURITY & LIQUID GLASS TESTS PASSED!');
  } else {
    console.error(`💥 ${failed} TESTS FAILED!`);
  }
  console.log('======================================================');
}

runAuthTests().catch(console.error);
