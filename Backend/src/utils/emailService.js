const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Create reusable transporter object using SMTP
const createTransporter = () => {
    // Check if SMTP is configured
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        console.warn('SMTP not configured. OTP will be logged to console only.');
        return null;
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

/**
 * Send OTP verification email
 * @param {string} email - Recipient email address
 * @param {string} otp - 6-digit OTP code
 * @param {string} name - User's name for personalization
 * @returns {Promise<boolean>} - True if sent successfully
 */
/**
 * Prevent HTML injection
 */
const escapeHtml = (unsafe) => {
    return (unsafe || '').replace(/[&<>"'/]/g, (match) => {
        const chars = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };
        return chars[match];
    });
};

/**
 * Mask an email address for safe logging
 */
const maskEmail = (email) => {
    if (!email || !email.includes('@')) return 'invalid-email';
    const [local, domain] = email.split('@');
    if (local.length <= 1) return `*@${domain}`;
    return `${local[0]}***@${domain}`;
};

/**
 * Mask a string (name, file name) for safe logging
 */
const maskString = (str) => {
    if (!str) return '***';
    if (str.length <= 2) return `${str[0]}*`;
    return `${str[0]}***${str[str.length - 1]}`;
};

const sendOTPEmail = async (email, otp, name) => {
    const transporter = createTransporter();
    const escapedName = escapeHtml(name);

    // Email HTML template
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Storive</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Secure Cloud Storage</p>
            </div>
            <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">Verify Your Email</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Hi ${escapedName || 'there'},<br><br>
                    Thanks for signing up for Storive! Please use the following OTP to verify your email address:
                </p>
                <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%); border-radius: 12px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                    <p style="color: #888; font-size: 14px; margin: 0 0 10px 0; letter-spacing: 1px;">YOUR VERIFICATION CODE</p>
                    <p style="color: #333; font-size: 40px; font-weight: 700; margin: 0; letter-spacing: 8px; font-family: 'Courier New', monospace;">${otp}</p>
                </div>
                <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
                    This code will expire in <strong>5 minutes</strong>. If you didn't request this code, please ignore this email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #aaa; font-size: 12px; text-align: center; margin: 0;">
                    © ${new Date().getFullYear()} Storive. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Plain text version
    const textContent = `
    Storive - Email Verification

    Hi ${name || 'there'},

    Thanks for signing up for Storive! Your verification code is:

    ${otp}

    This code will expire in 5 minutes.

    If you didn't request this code, please ignore this email.

    © ${new Date().getFullYear()} Storive
    `;

    // If no SMTP configured, log to console (for testing/dev only)
    if (!transporter) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n========================================');
            console.log('📧 OTP EMAIL (Console Mode)');
            console.log('========================================');
            console.log(`To: ${maskEmail(email)}`);
            console.log(`Name: ${maskString(name)}`);
            console.log(`OTP Code: ${otp}`);
            console.log('========================================\n');
            return true;
        } else {
            console.error('SMTP not configured. Cannot send OTP in production.');
            return false;
        }
    }

    try {
        const info = await transporter.sendMail({
            from: `"Storive" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: email,
            subject: 'Verify Your Email - Storive',
            text: textContent,
            html: htmlContent,
        });

        console.log('OTP email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending OTP email:', error);

        // Development-only fallback: Ensure we don't block registration if SMTP is down in dev
        if (process.env.NODE_ENV !== 'production') {
            // Fallback to console logging
            console.log('\n========================================');
            console.log('📧 OTP EMAIL (Fallback - Email failed)');
            console.log('========================================');
            console.log(`To: ${maskEmail(email)}`);
            console.log(`OTP Code: ${otp}`);
            console.log('========================================\n');
            return true; // Return true so registration can proceed in dev
        }

        // In production, propagate the failure
        return false;
    }
};

/**
 * Generate a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
const generateOTP = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Send share notification email
 * @param {string} recipientEmail - Email of person receiving access
 * @param {string} recipientName - Name of recipient
 * @param {string} sharedByName - Name of person sharing
 * @param {string} resourceName - Name of file/folder being shared
 * @param {string} resourceType - 'file' or 'folder'
 * @param {string} role - 'viewer' or 'editor'
 * @param {string} accessUrl - URL to access the resource
 * @returns {Promise<boolean>} - True if sent successfully
 */
const sendShareNotificationEmail = async (recipientEmail, recipientName, sharedByName, resourceName, resourceType, role, accessUrl) => {
    const transporter = createTransporter();
    const escapedRecipientName = escapeHtml(recipientName);
    const escapedSharedByName = escapeHtml(sharedByName);
    const escapedResourceName = escapeHtml(resourceName);

    // Sanitize accessUrl to prevent XSS (protocol check + escaping)
    let safeAccessUrl = '#';
    try {
        const parsedUrl = new URL(accessUrl);
        if (['http:', 'https:'].includes(parsedUrl.protocol)) {
            safeAccessUrl = escapeHtml(accessUrl);
        } else {
            console.warn(`Blocked potentially unsafe URL in email: ${parsedUrl.protocol}`);
        }
    } catch (e) {
        console.error('Invalid accessUrl provided to email service', e);
    }

    const roleText = role === 'editor' ? 'edit' : 'view';
    const icon = resourceType === 'folder' ? '📁' : '📄';

    // Email HTML template
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>File Shared With You</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px 16px 0 0; padding: 40px 30px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Storive</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Secure Cloud Storage</p>
            </div>
            <div style="background: white; border-radius: 0 0 16px 16px; padding: 40px 30px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin: 0 0 20px 0; font-size: 24px;">${icon} ${escapedSharedByName} shared a ${resourceType} with you</h2>
                <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    Hi ${escapedRecipientName || 'there'},<br><br>
                    <strong>${escapedSharedByName}</strong> has shared <strong>"${escapedResourceName}"</strong> with you and given you permission to <strong>${roleText}</strong> it.
                </p>
                <div style="background: linear-gradient(135deg, #f5f7fa 0%, #e4e9f2 100%); border-radius: 12px; padding: 30px; margin: 0 0 30px 0;">
                    <p style="color: #888; font-size: 14px; margin: 0 0 15px 0;">SHARED ITEM</p>
                    <p style="color: #333; font-size: 20px; font-weight: 600; margin: 0 0 10px 0;">${icon} ${escapedResourceName}</p>
                    <p style="color: #666; font-size: 14px; margin: 0;">
                        <span style="display: inline-block; padding: 4px 12px; background: ${role === 'editor' ? '#10b981' : '#3b82f6'}; color: white; border-radius: 6px; font-size: 12px; font-weight: 500;">
                            ${role === 'editor' ? '✏️ Can Edit' : '👁️ Can View'}
                        </span>
                    </p>
                </div>
                <div style="text-align: center; margin: 0 0 30px 0;">
                    <a href="${safeAccessUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
                        Open in Storive
                    </a>
                </div>
                <p style="color: #999; font-size: 14px; line-height: 1.6; margin: 0;">
                    You can access this ${resourceType} anytime from your <strong>Shared with me</strong> section in Storive.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                <p style="color: #aaa; font-size: 12px; text-align: center; margin: 0;">
                    © ${new Date().getFullYear()} Storive. All rights reserved.
                </p>
            </div>
        </div>
    </body>
    </html>
    `;

    // Plain text version
    const textContent = `
    Storive - File Shared With You

    Hi ${recipientName || 'there'},

    ${sharedByName} has shared "${resourceName}" with you.

    Permission: ${role === 'editor' ? 'Can Edit' : 'Can View'}

    Access it here: ${accessUrl}

    You can find this ${resourceType} in your "Shared with me" section.

    © ${new Date().getFullYear()} Storive
    `;

    // If no SMTP configured, log to console
    if (!transporter) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n========================================');
            console.log('📧 SHARE NOTIFICATION EMAIL (Console Mode)');
            console.log('========================================');
            console.log(`To: ${maskEmail(recipientEmail)}`);
            console.log(`Shared by: ${maskString(sharedByName)}`);
            console.log(`Resource: ${maskString(resourceName)} (${resourceType})`);
            console.log(`Role: ${role}`);
            console.log(`URL: ${safeAccessUrl}`);
            console.log('========================================\n');
            return true;
        } else {
            console.error('SMTP not configured. Cannot send share notification in production.');
            return false;
        }
    }

    try {
        const info = await transporter.sendMail({
            from: `"Storive" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
            to: recipientEmail,
            subject: `${sharedByName} shared "${resourceName}" with you`,
            text: textContent,
            html: htmlContent,
        });

        console.log('Share notification email sent:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending share notification email:', error);

        // Development fallback
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n========================================');
            console.log('📧 SHARE NOTIFICATION (Fallback - Email failed)');
            console.log('========================================');
            console.log(`To: ${maskEmail(recipientEmail)}`);
            console.log(`Resource: ${maskString(resourceName)}`);
            console.log('========================================\n');
            return true;
        }

        return false;
    }
};

module.exports = {
    sendOTPEmail,
    generateOTP,
    sendShareNotificationEmail,
};
