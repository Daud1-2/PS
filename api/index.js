const { app } = require('../backend/server');

module.exports = async (req, res) => {
  return app(req, res);
};
