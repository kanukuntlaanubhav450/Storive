/**
 * Mask email address for secure logging (PII protection)
 * Example: user@example.com → u***@example.com
 * 
 * @param {string} email - Email address to mask
 * @returns {string} - Masked email
 */
function maskEmail(email) {
    if (!email || typeof email !== 'string') {
        return '[invalid-email]';
    }

    const atIndex = email.indexOf('@');
    if (atIndex <= 0) {
        return '[invalid-email]';
    }

    const localPart = email.substring(0, atIndex);
    const domain = email.substring(atIndex);

    // Show first character + *** + domain
    const masked = localPart.charAt(0) + '***' + domain;
    return masked;
}

module.exports = { maskEmail };
