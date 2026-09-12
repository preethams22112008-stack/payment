const crypto = require('crypto');
const store = require('../data/store');

// Keep track of used nonces to prevent replay attacks within token validity window
const usedNonces = new Map(); // nonce -> expiry timestamp

// Clean up expired nonces every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [nonce, expiry] of usedNonces.entries()) {
    if (now > expiry) {
      usedNonces.delete(nonce);
    }
  }
}, 60000);

/**
 * Generate a dynamic signed token for a student card
 * Used by virtual card display (works offline if student has their secret or generated in advance)
 */
function generateDynamicToken(studentId, cardUid, secretKey) {
  const timestamp = Math.floor(Date.now() / 1000); // unix seconds
  const nonce = crypto.randomBytes(6).toString('hex');
  const payloadStr = `${studentId}:${cardUid}:${timestamp}:${nonce}`;
  
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(payloadStr);
  const signature = hmac.digest('hex');

  const tokenObj = {
    sid: studentId,
    uid: cardUid,
    ts: timestamp,
    non: nonce,
    sig: signature
  };

  const encoded = Buffer.from(JSON.stringify(tokenObj)).toString('base64url');
  return {
    rawToken: `CAMPUS-ID:${encoded}`,
    tokenObj,
    expiresInSeconds: 60 // Fresh token renewed every 30-60s
  };
}

/**
 * Validate a token scanned or tapped at the Merchant POS
 * Can accept:
 * 1. Dynamic QR/Barcode string: "CAMPUS-ID:<base64url>"
 * 2. Raw JSON string of token
 * 3. Physical NFC UID direct tap: "NFC-8A7F-B21C"
 * 4. Card Barcode number: "8901234567890" or Student Roll No "2024CS1042"
 */
function validatePaymentToken(tokenInput) {
  if (!tokenInput || typeof tokenInput !== 'string') {
    return { valid: false, error: "Empty or invalid token format" };
  }

  const trimmed = tokenInput.trim();

  // Case 1: Dynamic Signed Cryptographic Token (QR / Dynamic Barcode)
  if (trimmed.startsWith('CAMPUS-ID:') || trimmed.startsWith('{') || trimmed.includes('"sig"')) {
    try {
      let tokenData;
      if (trimmed.startsWith('CAMPUS-ID:')) {
        const b64 = trimmed.replace('CAMPUS-ID:', '');
        const json = Buffer.from(b64, 'base64url').toString('utf8');
        tokenData = JSON.parse(json);
      } else {
        tokenData = JSON.parse(trimmed);
      }

      const { sid, uid, ts, non, sig } = tokenData;
      if (!sid || !uid || !ts || !non || !sig) {
        return { valid: false, error: "Malformed cryptographic token structure" };
      }

      const student = store.getUser(sid);
      if (!student) {
        return { valid: false, error: `Student ID [${sid}] not found in campus directory` };
      }

      if (!student.card || student.card.cardUid.toUpperCase() !== uid.toUpperCase()) {
        return { valid: false, error: "Card UID mismatch with student record" };
      }

      // Check card status
      if (student.card.status === 'FROZEN') {
        return { valid: false, error: "CARD FROZEN: Student or Admin has disabled this card for security" };
      }

      // Replay Attack Check
      if (usedNonces.has(non)) {
        return { valid: false, error: "SECURITY ALERT: Token replay detected! Nonce has already been consumed." };
      }

      // Timestamp Freshness Check (allow up to 10 minutes clock drift / offline grace)
      const now = Math.floor(Date.now() / 1000);
      const ageSeconds = now - ts;
      if (ageSeconds > 600) {
        return { valid: false, error: `Token expired (${Math.round(ageSeconds / 60)} mins old). Please present fresh barcode/NFC.` };
      }

      // Cryptographic Signature Verification
      const secretKey = student.card.secretKey;
      const expectedPayload = `${sid}:${uid}:${ts}:${non}`;
      const hmac = crypto.createHmac('sha256', secretKey);
      hmac.update(expectedPayload);
      const expectedSig = hmac.digest('hex');

      // Constant-time comparison
      const sigBuf = Buffer.from(sig, 'hex');
      const expBuf = Buffer.from(expectedSig, 'hex');
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, error: "CRYPTOGRAPHIC FAILURE: Digital signature verification failed. Possible forgery." };
      }

      // Mark nonce consumed for 15 minutes
      usedNonces.set(non, Date.now() + 900000);

      return {
        valid: true,
        student,
        verificationMethod: "CRYPTOGRAPHIC_HMAC_SHA256",
        cardUid: uid
      };
    } catch (err) {
      return { valid: false, error: `Failed to decode signed token: ${err.message}` };
    }
  }

  // Case 2: Direct Physical NFC UID Tap (e.g., "NFC-8A7F-B21C")
  if (trimmed.toUpperCase().startsWith('NFC-')) {
    const student = store.getStudentByCardUid(trimmed);
    if (!student) {
      return { valid: false, error: `Unrecognized NFC Card UID [${trimmed}]` };
    }
    if (student.card && student.card.status === 'FROZEN') {
      return { valid: false, error: "CARD FROZEN: This NFC card is locked. Contact Campus Admin." };
    }
    return {
      valid: true,
      student,
      verificationMethod: "HARDWARE_NFC_CARD_UID",
      cardUid: student.card.cardUid
    };
  }

  // Case 3: Physical Barcode / Roll Number scan
  const studentByBarcode = store.getStudentByBarcode(trimmed);
  if (studentByBarcode) {
    if (studentByBarcode.card && studentByBarcode.card.status === 'FROZEN') {
      return { valid: false, error: "CARD FROZEN: Student card is suspended." };
    }
    return {
      valid: true,
      student: studentByBarcode,
      verificationMethod: "CARD_BARCODE_LOOKUP",
      cardUid: studentByBarcode.card ? studentByBarcode.card.cardUid : "N/A"
    };
  }

  return { valid: false, error: `Could not identify card or student with identifier: [${trimmed}]` };
}

module.exports = {
  generateDynamicToken,
  validatePaymentToken
};
