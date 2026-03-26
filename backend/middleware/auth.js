function getExpectedApiKey() {
  return String(process.env.ADMIN_API_KEY || 'dev-api-key-change-me').trim();
}

function requireApiKey(req, res, next) {
  const providedApiKey = String(req.header('x-api-key') || '').trim();

  if (!providedApiKey || providedApiKey !== getExpectedApiKey()) {
    res.status(401).json({
      error: 'Unauthorized'
    });
    return;
  }

  next();
}

module.exports = {
  requireApiKey
};
