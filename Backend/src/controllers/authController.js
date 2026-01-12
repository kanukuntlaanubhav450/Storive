const supabase = require('../config/supabaseClient');

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
                return res.status(500).json({ error: 'User created but profile failed to initialize.' });
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
            maxAge: 3600 * 1000, // 1 hour
        });

        // send refresh token as well if needed, or handle session management via Supabase client on frontend
        // For this architecture, we follow the spec: "Set cookie tokens"

        res.status(200).json({ message: 'Login successful', session: data.session });

    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

exports.getMe = async (req, res) => {
    // Middleware should have attached user to req
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    res.status(200).json({ user: req.user });
};
