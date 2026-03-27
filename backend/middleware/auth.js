const crypto = require('crypto');

const INSECURE_API_KEYS = new Set([
  '',
  'change-me-before-production',
  'dev-api-key-change-me'
]);

function getExpectedApiKey() {
  return String(process.env.ADMIN_API_KEY || '').trim();
}

function isConfiguredApiKey(value) {
  return !INSECURE_API_KEYS.has(String(value || '').trim());
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireApiKey(req, res, next) {
  const expectedApiKey = getExpectedApiKey();

  if (!isConfiguredApiKey(expectedApiKey)) {
    res.status(503).json({
      error: 'Admin API key is not configured.'
    });
    return;
  }

  const providedApiKey = String(req.header('x-api-key') || '').trim();

  if (!isConfiguredApiKey(providedApiKey) || !safeCompare(providedApiKey, expectedApiKey)) {
    res.status(401).json({
      error: 'Unauthorized'
    });
    return;
  }

  next();
}

module.exports = {
  requireApiKey,
  isConfiguredApiKey
};
