const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const TAG_LENGTH = 16;
const KEY = Buffer.from(process.env.PASSWORD_ENC_KEY || '', 'hex');

// Check if key is valid
if (KEY.length !== 32) {
    console.error('CRITICAL: PASSWORD_ENC_KEY is not set or invalid (must be 32 bytes hex).');
    // We don't throw here to avoid crashing app boot if env isn't loaded yet, 
    // but encrypt will fail.
}

/**
 * Encrypts text using AES-256-GCM
 * Returns format: iv:authTag:encryptedData
 */
const encrypt = (text) => {
    if (!text) return null;
    if (KEY.length !== 32) throw new Error('Invalid encryption key');

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    // Return packed string: iv:tag:ciphertext
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
};

const decrypt = (text) => {
    if (!text) return null;
    if (KEY.length !== 32) throw new Error('Invalid encryption key');

    const parts = text.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted text format');

    const [ivHex, tagHex, encryptedHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    if (iv.length !== IV_LENGTH) throw new Error(`Invalid IV length (expected ${IV_LENGTH})`);
    if (tag.length !== TAG_LENGTH) throw new Error(`Invalid auth tag length (expected ${TAG_LENGTH})`);

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};

module.exports = { encrypt, decrypt };
