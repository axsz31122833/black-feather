const jwt = require('jsonwebtoken');

// Unified secret and expiry sourced from environment variables with safe defaults
const SECRET = process.env.JWT_SECRET || process.env.EDGE_JWT_SECRET || 'dev_local_secret_change_this';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate a JWT using jsonwebtoken.
 * @param {Object} payload - Claims to embed in the token
 * @param {Object} [options] - jsonwebtoken sign options (overrides default expiresIn)
 * @returns {string} JWT
 */
function generateToken(payload, options = {}) {
  const opts = { expiresIn: EXPIRES_IN, ...options };
  return jwt.sign(payload, SECRET, opts);
}

/**
 * Verify a JWT and return the decoded payload, or null if invalid/expired.
 * @param {string} token
 * @returns {Object|null}
 */
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    return null;
  }
}

module.exports = {
  SECRET,
  EXPIRES_IN,
  generateToken,
  verifyToken,
};
