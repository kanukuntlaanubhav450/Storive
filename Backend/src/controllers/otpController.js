const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');
const { sendOTPEmail, generateOTP } = require('../utils/emailService');
const { encrypt, decrypt } = require('../utils/encryption');

// In-memory fallback store for development/when DB is acting up
// Format: email -> { otp, otp_expires_at, name, password_hash }
const otpStore = new Map();

/**
 * Initiate registration - send OTP to email
 * POST /auth/send-otp
 */
exports.sendOTP = async (req, res) => {
    const { password, name } = req.body;
    let { email } = req.body;

    // Validate required fields
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    email = email.toLowerCase().trim();

    // Validate password length
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Check if email is already registered in users table
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (existingUser) {
            return res.status(400).json({ error: 'Email is already registered. Please sign in.' });
        }

        // Generate OTP
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        const otpHash = await bcrypt.hash(otp, 10);

        // Encrypt password for temporary storage
        const passwordHash = encrypt(password);
        if (!passwordHash) throw new Error('Encryption failed');

        // Store in memory
        otpStore.set(email, {
            email,
            name,
            password_hash: passwordHash,
            otp_hash: otpHash,
            otp_expires_at: otpExpiresAt
        });

        // Cleanup memory after expiration (6 mins to be safe)
        setTimeout(() => {
            if (otpStore.has(email)) {
                otpStore.delete(email);
            }
        }, 6 * 60 * 1000);

        let usedFallback = false;

        const upsertData = {
            email: email,
            name: name,
            password_hash: passwordHash,
            otp_expires_at: otpExpiresAt.toISOString(),
        };

        // Attempt with new column name
        let { error: upsertError } = await supabase
            .from('pending_registrations')
            .upsert({ ...upsertData, otp_hash: otpHash }, { onConflict: 'email' });

        // Fallback for stale PostgREST cache
        if (upsertError && upsertError.code === 'PGRST204' && upsertError.message.includes('otp_hash')) {
            const { error: fallbackError } = await supabase
                .from('pending_registrations')
                .upsert({ ...upsertData, otp: otpHash }, { onConflict: 'email' });
            upsertError = fallbackError;
        }

        if (upsertError) {
            console.error('Registration DB upsert warning:', upsertError.message);
            usedFallback = true;
        }

        // Send OTP email
        await sendOTPEmail(email, otp, name);

        // Development-only: Log OTP to console for easy access
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n----------------------------------------');
            console.log(`[DEV] OTP for ${email}: ${otp}`);
            console.log('----------------------------------------\n');
        }

        res.status(200).json({
            message: 'OTP sent successfully. Please check your email.',
            email: email, // Return email so frontend knows which email to display
            warning: usedFallback ? 'Running in fallback mode (db error)' : undefined
        });

    } catch (error) {
        console.error('Send OTP error:', error);
        res.status(500).json({
            error: 'An error occurred. Please try again.'
        });
    }
};

/**
 * Verify OTP and complete registration
 * POST /auth/verify-otp
 */
exports.verifyOTP = async (req, res) => {
    const { otp } = req.body;
    let { email } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ error: 'Email and OTP are required' });
    }

    email = email.toLowerCase().trim();

    try {
        let pending = null;
        let isFallback = false;

        // 1. Try In-Memory first (Most reliable in current state)
        if (otpStore.has(email)) {
            console.log('Using in-memory OTP for verification');
            pending = otpStore.get(email);
            isFallback = true;
        }

        // 2. If not in memory, try Database (e.g. after server restart)
        if (!pending) {
            const { data: dbData, error: fetchError } = await supabase
                .from('pending_registrations')
                .select('*')
                .eq('email', email)
                .single();

            if (!fetchError && dbData) {
                pending = dbData;
            }
        }

        if (!pending) {
            return res.status(400).json({ error: 'No pending registration found. Please check your email or start over.' });
        }

        // Get the hash - handle both column names
        const hashToVerify = pending.otp_hash || pending.otp;

        // Check if OTP is expired
        if (new Date(pending.otp_expires_at) < new Date()) {
            // Cleanup expired - Always try to remove from both stores
            const { error: cleanupError } = await supabase.from('pending_registrations').delete().eq('email', email);
            if (cleanupError) {
                console.error('Expiration cleanup warning (DB):', cleanupError);
            }
            otpStore.delete(email);
            return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
        }

        // Verify OTP
        if (!hashToVerify || typeof hashToVerify !== 'string') {
            const { maskEmail } = require('../utils/logUtils');
            console.error(`[VerifyOTP] OTP hash missing or invalid for ${maskEmail(email)}`);
            return res.status(400).json({ error: 'OTP not set for this request. Please request a new one.' });
        }

        const isOtpMatch = await bcrypt.compare(otp, hashToVerify);
        if (!isOtpMatch) {
            return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
        }

        // OTP is valid! Create user in Supabase Auth
        // Decrypt password to pass to Supabase createUser
        let passwordToUse;
        try {
            passwordToUse = decrypt(pending.password_hash);
        } catch (decErr) {
            console.error('Decryption failed:', decErr);
            return res.status(500).json({ error: 'Security verification failed. Please try again.' });
        }

        // OTP is valid! Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: passwordToUse,
            email_confirm: true,
        });

        let userId;
        if (authError) {
            // Handle "User already registered" gracefully
            if (authError.message === 'User already registered') {
                return res.status(400).json({ error: 'User already exists. Please login.' });
            }

            // Fallback: Create entry in our users table only (Development mode)
            const { data: newUser, error: insertError } = await supabase
                .from('users')
                .insert({
                    email: email,
                    name: pending.name,
                })
                .select()
                .single();

            if (insertError) {
                return res.status(500).json({ error: 'Failed to create user.' });
            }
            userId = newUser.id;
        } else {
            userId = authData.user.id;

            // Create user record in our custom 'users' table
            // Create user record in our custom 'users' table
            const { error: profileError } = await supabase.from('users').insert({
                id: userId,
                email: email,
                name: pending.name
            });

            if (profileError) {
                console.error('Failed to create user profile after Auth success:', profileError);
                // Rollback: Delete the Supabase Auth user to maintain consistency
                await supabase.auth.admin.deleteUser(userId);
                return res.status(500).json({ error: 'Failed to create user profile. Please try again.' });
            }
        }

        // Cleanup - Always try to remove from both stores to ensure clean state
        const { error: cleanupError } = await supabase.from('pending_registrations').delete().eq('email', email);
        if (cleanupError) {
            console.error('Cleanup warning (DB):', cleanupError);
        }
        otpStore.delete(email);

        // Auto-login: sign the newly created user in to get a session token
        let sessionToken = null;
        try {
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                email: email,
                password: passwordToUse,
            });

            if (!signInError && signInData?.session) {
                sessionToken = signInData.session.access_token;

                // Set Access Token as HttpOnly cookie (same as login endpoint)
                res.cookie('access_token', sessionToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    path: '/',
                    maxAge: 3600 * 1000, // 1 hour
                });
            }
        } catch (signInErr) {
            console.warn('[verifyOTP] Auto-login after registration failed (non-critical):', signInErr.message);
        }

        const responseData = {
            message: 'Registration successful! You are now signed in.',
            userId: userId
        };


        res.status(201).json(responseData);


    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({ error: 'An error occurred. Please try again.' });
    }
};

/**
 * Resend OTP
 */
exports.resendOTP = async (req, res) => {
    let { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }
    email = email.toLowerCase().trim();

    // ... (Simplified for brevity, similar fallback logic can be applied if needed)
    // For now we just implement basic Resend
    try {
        let name = 'User';
        let found = false;
        let existingPasswordHash = null;

        // Try DB first — select password_hash too so we can preserve it
        const { data: pending } = await supabase
            .from('pending_registrations')
            .select('name, password_hash, otp_hash')
            .eq('email', email)
            .single();

        if (pending) {
            name = pending.name;
            // password_hash column name may vary depending on schema version
            existingPasswordHash = pending.password_hash || pending.otp_hash || null;
            found = true;
        } else if (otpStore.has(email)) {
            const stored = otpStore.get(email);
            name = stored.name;
            existingPasswordHash = stored.password_hash || null;
            found = true;
        }

        if (!found) return res.status(400).json({ error: 'No pending registration.' });

        // Guard: if we cannot recover the encrypted password we cannot complete
        // registration later, so fail now rather than silently corrupt the flow.
        if (!existingPasswordHash || existingPasswordHash === 'RETAIN') {
            console.error(`[resendOTP] Cannot find stored password_hash for ${email} — aborting resend.`);
            return res.status(400).json({ error: 'Registration session expired. Please start the sign-up process again.' });
        }

        // ... (Existing logic continues)
        const otp = generateOTP();
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
        const otpHash = await bcrypt.hash(otp, 10);

        // Update both Memory and DB — preserve the real encrypted password_hash
        otpStore.set(email, { email, name, password_hash: existingPasswordHash, otp_hash: otpHash, otp_expires_at: otpExpiresAt });

        const upsertData = { email, name, otp_expires_at: otpExpiresAt.toISOString() };

        let { error: upsertError } = await supabase
            .from('pending_registrations')
            .upsert({ ...upsertData, otp_hash: otpHash }, { onConflict: 'email' });

        // Fallback for stale schema cache
        if (upsertError && upsertError.code === 'PGRST204') {
            const { error: fallbackError } = await supabase
                .from('pending_registrations')
                .upsert({ ...upsertData, otp: otpHash }, { onConflict: 'email' });
            upsertError = fallbackError;
        }

        await sendOTPEmail(email, otp, name);

        // Development-only: Log OTP to console for easy access
        if (process.env.NODE_ENV !== 'production') {
            console.log('\n----------------------------------------');
            console.log(`[DEV RESEND] OTP for ${email}: ${otp}`);
            console.log('----------------------------------------\n');
        }

        res.status(200).json({
            message: 'OTP resent successfully',
            debug_otp: process.env.NODE_ENV !== 'production' ? otp : undefined
        });

    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({
            error: 'An error occurred. Please try again.'
        });
    }
};

