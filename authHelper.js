import crypto from 'crypto';

const SALT = process.env.PIN_SALT || 'pos-locale-clothing-boutique-salt-key-2026';

/**
 * Hash a PIN code using SHA-256 with salt
 * @param {string} pin 
 * @returns {string} hashed pin
 */
export function hashPin(pin) {
  if (!pin) throw new Error('PIN is required');
  return crypto.createHash('sha256').update(pin + SALT).digest('hex');
}

/**
 * Compare a plain PIN with its hash
 * @param {string} pin 
 * @param {string} hashedPin 
 * @returns {boolean} match status
 */
export function verifyPin(pin, hashedPin) {
  if (!pin || !hashedPin) return false;
  return hashPin(pin) === hashedPin;
}
