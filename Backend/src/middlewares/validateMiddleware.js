const { z } = require('zod');

/**
 * Middleware factory to validate request body against a Zod schema
 * @param {z.ZodSchema} schema - The Zod schema to validate against
 */
const validate = (schema) => (req, res, next) => {
    try {
        // Parse matches the data against schema and returns typed data (strips unknown if strict, but we just want validation here)
        // Note: req.body is replaced with the parsed data which is sanitized/transformed
        req.body = schema.parse(req.body);
        next();
    } catch (error) {
        if (error instanceof z.ZodError) {
            // Format Zod errors into a readable object
            const formattedErrors = error.errors.map(err => ({
                field: err.path.join('.'),
                message: err.message
            }));

            return res.status(400).json({
                error: 'Validation failed',
                details: formattedErrors
            });
        }
        next(error);
    }
};

module.exports = validate;
