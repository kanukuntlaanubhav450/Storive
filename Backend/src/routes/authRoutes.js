const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const otpController = require('../controllers/otpController');

const authMiddleware = require('../middlewares/authMiddleware');

const validate = require('../middlewares/validateMiddleware');
const {
    sendOtpSchema,
    verifyOtpSchema,
    resendOtpSchema,
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema
} = require('../validators/authValidators');

// OTP-based registration flow
router.post('/send-otp', validate(sendOtpSchema), otpController.sendOTP);
router.post('/verify-otp', validate(verifyOtpSchema), otpController.verifyOTP);
router.post('/resend-otp', validate(resendOtpSchema), otpController.resendOTP);

// Legacy register (can be kept for backward compatibility or removed)
router.post('/register', validate(registerSchema), authController.register);
router.post('/login', validate(loginSchema), authController.login);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/change-password', validate(changePasswordSchema), authMiddleware, authController.changePassword);
router.post('/update-profile', validate(updateProfileSchema), authMiddleware, authController.updateProfile);
router.get('/google', authController.loginGoogle); // OAuth Initiation
router.get('/me', authMiddleware, authController.getMe);

// Logout
router.post('/logout', authController.logout);

// Dev-only health probe — disabled in non-development environments
router.get('/debug-health', (req, res) => {
    if (process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ error: 'Not found' });
    }
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
