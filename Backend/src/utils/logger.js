/**
 * Secure Logger Utility
 * Handles environment-aware logging and PII sanitization (UUIDs, etc.)
 */

const isProduction = process.env.NODE_ENV === 'production';
const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

/**
 * Sanitizes a string (expected UUID or identifier)
 * Truncates to first 4 and last 4 characters.
 * Example: 1234-5678-9012 -> 1234...9012
 */
const sanitize = (id) => {
    if (typeof id !== 'string') return id;
    if (id.length <= 8) return '***';
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
};

/**
 * Deeply sanitizes an object or array
 */
const sanitizeDeep = (obj) => {
    if (!obj || typeof obj !== 'object') {
        // If it looks like a UUID, sanitize it
        if (typeof obj === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(obj)) {
            return sanitize(obj);
        }
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(sanitizeDeep);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        const isPIIKey = ['id', 'userId', 'owner_id', 'resourceId', 'grantee_user_id', 'actor_id'].includes(key);
        const isUUID = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

        if ((isPIIKey || isUUID) && typeof value === 'string') {
            sanitized[key] = sanitize(value);
        } else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeDeep(value);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
};

const logger = {
    debug: (...args) => {
        if (logLevel === 'debug') {
            console.debug(`[DEBUG]`, ...args.map(sanitizeDeep));
        }
    },
    info: (...args) => {
        if (['debug', 'info'].includes(logLevel)) {
            console.log(`[INFO]`, ...args.map(sanitizeDeep));
        }
    },
    warn: (...args) => {
        if (['debug', 'info', 'warn'].includes(logLevel)) {
            console.warn(`[WARN]`, ...args.map(sanitizeDeep));
        }
    },
    error: (...args) => {
        // Errors are always logged, but PII is still sanitized
        console.error(`[ERROR]`, ...args.map(sanitizeDeep));
    }
};

module.exports = logger;
