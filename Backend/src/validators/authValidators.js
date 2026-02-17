const { z } = require('zod');

/**
 * Reusable email schema
 */
const emailSchema = z.string()
    .trim()
    .email('Invalid email address')
    .transform(val => val.toLowerCase());

/**
 * Reusable password schema
 */
const passwordSchema = z.string()
    .min(6, 'Password must be at least 6 characters');

/**
 * Schema for Registration
 */
const registerSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: z.string().trim().min(2, 'Name is required')
});

/**
 * Schema for Login
 */
const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required') // Don't enforce complexity on login, just presence
});

/**
 * Schema for sending OTP
 */
const sendOtpSchema = z.object({
    email: emailSchema,
    name: z.string().trim().min(2, 'Name is required'),
    password: passwordSchema
});

/**
 * Schema for verifying OTP
 */
const verifyOtpSchema = z.object({
    email: emailSchema,
    otp: z.string().regex(/^\d{6}$/, 'OTP must be 6 digits')
});

/**
 * Schema for resending OTP
 */
const resendOtpSchema = z.object({
    email: emailSchema
});

/**
 * Schema for forgot password
 */
const forgotPasswordSchema = z.object({
    email: emailSchema
});

/**
 * Schema for reset password
 */
const resetPasswordSchema = z.object({
    password: passwordSchema
});

/**
 * Schema for change password
 */
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: passwordSchema
});

/**
 * Schema for updating profile
 */
const updateProfileSchema = z.object({
    name: z.string().trim().min(2, 'Name is required')
});

module.exports = {
    registerSchema,
    loginSchema,
    sendOtpSchema,
    verifyOtpSchema,
    resendOtpSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema
};
