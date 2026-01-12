const supabase = require('../config/supabaseClient');

const authenticateToken = async (req, res, next) => {
    // Check for token in cookies or Authorization header
    let token = req.cookies?.access_token;

    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'Access denied. no token provided.' });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(403).json({ error: 'Invalid or expired token.' });
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(403).json({ error: 'Invalid token.' });
    }
};

module.exports = authenticateToken;
