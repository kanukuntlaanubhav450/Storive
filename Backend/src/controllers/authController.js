const supabase = require('../config/supabaseClient');
const { maskEmail } = require('../utils/logUtils');

// Helper function to add timeout to Supabase queries
const withTimeout = (promise, timeoutMs = 8000) => {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Supabase request timed out')), timeoutMs)
        )
    ]);
};

exports.register = async (req, res) => {
    const { email, password, name } = req.body;

    try {
        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
        });

        if (authError) throw authError;

        if (authData.user) {
            // 2. Create user record in our custom 'users' table
            const { error: dbError } = await supabase
                .from('users')
                .insert([
                    {
                        id: authData.user.id, // Link to Supabase Auth ID
                        email: email,
                        name: name
                    }
                ]);

            if (dbError) {
                // Optional: specific rollback logic if needed, though rare in this flow
                console.error('Error creating user profile:', dbError);
                return res.status(500).json({
                    error: 'User created but profile failed to initialize. Please contact support.',
                });
            }
        }

        res.status(201).json({ message: 'User registered successfully. Please check your email for verification if enabled.', user: authData.user });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;

        // Set Access Token as Cookie (HttpOnly)
        // Note: In production, ensure 'secure: true' and 'sameSite' are configured correctly
        res.cookie('access_token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax', // Needed for localhost to localhost communication
            path: '/',
            maxAge: 3600 * 1000, // 1 hour
        });

        // send refresh token as well if needed, or handle session management via Supabase client on frontend
        // For this architecture, we follow the spec: "Set cookie tokens"

        // Send minimal response. Access Token is in HttpOnly cookie.
        // In Development, we return the token to allow localStorage fallback for localhost.
        const responseData = {
            message: 'Login successful',
            user: {
                id: data.user.id,
                email: data.user.email
            }
        };

        if (process.env.NODE_ENV !== 'production') {
            responseData.session = data.session;
            responseData.access_token = data.session.access_token;
        }

        res.status(200).json(responseData);

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

exports.loginGoogle = async (req, res) => {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Redirect back to frontend callback page after Google login
                redirectTo: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/callback`
            }
        });

        if (error) throw error;

        // Return the URL for the frontend to redirect the user to
        res.status(200).json({ url: data.url });

    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.getMe = async (req, res) => {
    // Middleware should have attached user to req
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // 1. Try to find user by Supabase Auth ID (normal case)
        const { data: userById, error: fetchByIdError } = await supabase
            .from('users')
            .select('*')
            .eq('id', req.user.id)
            .single();

        // Handle database errors from the ID lookup
        if (fetchByIdError) {
            // PGRST116 is Supabase's "no rows found" error code - this is expected for new OAuth users
            if (fetchByIdError.code !== 'PGRST116') {
                // This is a real database error (connection issue, permission error, etc.)
                console.error('Database error fetching user by ID:', fetchByIdError);
                return res.status(500).json({
                    error: 'Database error occurred while fetching user profile',
                    details: process.env.NODE_ENV !== 'production' ? fetchByIdError.message : undefined
                });
            }
            // fetchByIdError.code === 'PGRST116' means user not found by ID
            // This is normal for OAuth users, so we continue to email lookup below
        }

        // If found by ID, return immediately
        if (userById) {
            return res.status(200).json({ user: userById });
        }

        // 2. User not found by ID - check if this is an OAuth user linking to existing account
        // Look for existing user with same email (email/password account)
        const { data: userByEmail, error: fetchByEmailError } = await supabase
            .from('users')
            .select('*')
            .eq('email', req.user.email)
            .single();

        // Handle database errors from the email lookup
        if (fetchByEmailError) {
            // PGRST116 is Supabase's "no rows found" error code - this is expected for new OAuth users
            if (fetchByEmailError.code !== 'PGRST116') {
                // This is a real database error (connection issue, permission error, etc.)
                console.error('Database error fetching user by email:', fetchByEmailError);
                return res.status(500).json({
                    error: 'Database error occurred while fetching user profile',
                    details: process.env.NODE_ENV !== 'production' ? fetchByEmailError.message : undefined
                });
            }
            // fetchByEmailError.code === 'PGRST116' means no user found by email
            // This is normal for new OAuth users, so we continue to create new user below
        }

        if (userByEmail) {
            // Found existing user with same email!
            // SECURITY: Before linking, verify that the OAuth provider has confirmed this email
            // This prevents attackers from using unverified OAuth emails to hijack accounts
            const isEmailVerified = req.user.email_confirmed_at || req.user.confirmed_at;

            if (!isEmailVerified) {
                // Email is NOT verified by the OAuth provider - reject auto-linking
                console.warn(`🚨 SECURITY: Blocked unverified OAuth linking attempt for email: ${maskEmail(req.user.email)}`);
                console.warn(`   OAuth user ID: ${req.user.id}, Existing user ID: ${userByEmail.id}`);

                return res.status(403).json({
                    error: 'Email verification required',
                    message: 'Your email address must be verified by the OAuth provider before linking to an existing account. Please verify your email or sign in with your password.',
                    requiresVerification: true
                });
            }

            // Email is verified - safe to link accounts
            console.log(`🔗 Linking OAuth user ${req.user.id} to existing user ${userByEmail.id} (email: ${maskEmail(req.user.email)}) - Email verified ✓`);

            // Return the existing user's data
            // This allows OAuth users to access their email/password account's files
            return res.status(200).json({
                user: userByEmail,
                linked: true // Flag to indicate account was linked
            });
        }

        // 3. No existing user found - create new user record for OAuth user
        console.log(`✨ Creating new user profile for OAuth user: ${maskEmail(req.user.email)}`);

        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                id: req.user.id,
                email: req.user.email,
                name: req.user.user_metadata?.full_name || req.user.email?.split('@')[0]
            }])
            .select()
            .single();

        if (insertError) {
            console.error('Error creating user profile:', insertError);
            return res.status(500).json({ error: 'Failed to create user profile' });
        }

        return res.status(200).json({ user: newUser });

    } catch (error) {
        console.error('Error in getMe:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

exports.logout = (req, res) => {
    res.clearCookie('access_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
    });
    res.status(200).json({ message: 'Logged out successfully' });
};

exports.forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        // 1. Check if user exists in our 'users' table first (with timeout)
        const { data: user, error: userError } = await withTimeout(
            supabase
                .from('users')
                .select('id')
                .eq('email', email)
                .single()
        );

        // SECURITY: Always return the same response to prevent account enumeration
        // Attackers should not be able to determine if an email is registered
        if (userError || !user) {
            // Log internally for debugging, but don't reveal to caller
            if (userError && userError.code !== 'PGRST116') { // PGRST116 is "not found"
                console.warn('Forgot password - user lookup error:', userError);
            }
            // Return generic success message (same as when email is sent)
            return res.status(200).json({
                message: 'If an account with that email exists, you will receive a password reset link.'
            });
        }

        // 2. If user exists, proceed with password reset (with timeout)
        const { error } = await withTimeout(
            supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth/reset-password`,
            })
        );

        if (error) {
            // Handle specific error types
            if (error.message.toLowerCase().includes('rate limit')) {
                return res.status(429).json({
                    error: 'Too many password reset attempts. Please wait a minute before trying again.',
                    retryAfter: 60 // seconds
                });
            }
            throw error;
        }

        // Return the same generic message as the non-existent account case
        res.status(200).json({
            message: 'If an account with that email exists, you will receive a password reset link.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);

        // Handle timeout errors specifically
        if (error.message === 'Supabase request timed out') {
            return res.status(503).json({
                error: 'Service temporarily unavailable. Please try again in a moment.'
            });
        }

        res.status(400).json({ error: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    const { password } = req.body;

    // Validate password (same validation as changePassword)
    if (!password) {
        return res.status(400).json({ error: 'Password is required.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    try {
        // Get the access token from the Authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Invalid or expired reset token' });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // 1. Verify the token and get the user
        // Using the main supabase client (which has service role or anon key)
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            console.error('Token verification error:', userError);
            return res.status(401).json({ error: 'Invalid or expired reset token' });
        }

        // 2. Use the Admin API to update the user's password
        // This is safe because we just verified the token belongs to this user
        const { data: updateData, error: adminError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: password }
        );

        if (adminError) throw adminError;

        res.status(200).json({
            message: 'Password reset successful',
            user: {
                id: updateData.user.id,
                email: updateData.user.email
            }
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(400).json({ error: error.message || 'Failed to reset password' });
    }
};

// ============================================================
// Change Password (logged-in user, requires current password)
// ============================================================
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Basic validation
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    try {
        // req.user is injected by authMiddleware (contains { id, email, ... })
        const userEmail = req.user.email;
        const userId = req.user.id;

        // 1. Verify current password by attempting to sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: userEmail,
            password: currentPassword,
        });

        if (signInError) {
            return res.status(401).json({ error: 'Current password is incorrect.' });
        }

        // 2. Update password via admin API
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            userId,
            { password: newPassword }
        );

        if (updateError) throw updateError;

        res.status(200).json({ message: 'Password changed successfully.' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: error.message || 'Failed to change password.' });
    }
};

// ============================================================
// Update Profile (logged-in user can update their name)
// ============================================================
exports.updateProfile = async (req, res) => {
    // Only log sensitive data in development
    if (process.env.NODE_ENV !== 'production') {
        console.log('📝 Update Profile called');
        console.log('Request body:', req.body);
        console.log('User:', req.user);
    }

    const { name } = req.body;

    // Basic validation
    if (!name || name.trim() === '') {
        console.error('❌ Validation failed: Name is empty');
        return res.status(400).json({ error: 'Name is required.' });
    }

    try {
        // req.user is injected by authMiddleware
        const userId = req.user.id;
        if (process.env.NODE_ENV !== 'production') {
            console.log(`🔄 Updating user ${userId} with name: "${name.trim()}"`);
        }

        // Update the user's name in the users table
        const { data, error } = await supabase
            .from('users')
            .update({ name: name.trim() })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('❌ Supabase error:', error);
            throw error;
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('✅ Profile updated successfully:', data);
        }
        res.status(200).json({
            message: 'Profile updated successfully.',
            user: data
        });

    } catch (error) {
        console.error('❌ Update profile error:', error);
        res.status(500).json({ error: error.message || 'Failed to update profile.' });
    }
};

