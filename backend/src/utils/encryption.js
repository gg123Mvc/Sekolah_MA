import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const DEFAULT_KEY_FALLBACK = '9f83a21b45c8e7d0123456789abcdef0123456789abcdef0123456789abcdef0';

function getKeyBuffer() {
  const hexKey = process.env.ENCRYPTION_KEY || DEFAULT_KEY_FALLBACK;
  if (!hexKey || hexKey.length < 64) {
    throw new Error('ENCRYPTION_KEY harus berupa 64 karakter hex (32 bytes) di file .env');
  }
  return Buffer.from(hexKey.slice(0, 64), 'hex');
}

/**
 * Enkripsi teks menggunakan AES-256-GCM
 * @param {string} text - Teks plaintext yang akan dienkripsi
 * @returns {string} iv:authTag:encryptedData (hex)
 */
export function encrypt(text) {
  if (!text) return null;
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Dekripsi teks AES-256-GCM
 * @param {string} encryptedText - Format iv:authTag:encryptedData
 * @returns {string} Plaintext hasil dekripsi
 */
export function decrypt(encryptedText) {
  if (!encryptedText) return null;
  // Jika format bukan encrypted (misal sisa plain text lama), kembalikan langsung
  if (!encryptedText.includes(':')) {
    return encryptedText;
  }
  
  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error('Format encrypted data tidak valid');
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const key = getKeyBuffer();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Masking API Key / Secret agar tidak pernah diekspos secara utuh ke frontend
 * @param {string} key - API Key / Token
 * @returns {string} Masked string (contoh: gsk_****...89ab)
 */
export function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 8) return '****';
  const prefix = key.slice(0, 4);
  const suffix = key.slice(-4);
  return `${prefix}••••••••${suffix}`;
}
