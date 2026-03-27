const { app, ensureBackendReady } = require('../backend/server');

module.exports = async (req, res) => {
  await ensureBackendReady();
  return app(req, res);
};
