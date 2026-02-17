const express = require('express');
const cors = require('cors');

const app = express();

const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const folderRoutes = require('./routes/folderRoutes');
const fileRoutes = require('./routes/fileRoutes');
const shareRoutes = require('./routes/shareRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

// Middlewares
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://192.168.198.13000',
    'http://127.0.0.1:3000'
];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1 || process.env.CORS_ORIGIN) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(null, true); // Allow anyway for development
        }
    },
    credentials: true
}));
app.use((req, res, next) => {
    // Redact sensitive info from logs
    let logUrl = req.url;
    try {
        // Construct full URL to parse query params easily (base is dummy)
        const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

        // Redact sensitive query params
        ['token', 'access_token', 'code', 'key', 'password'].forEach(param => {
            if (urlObj.searchParams.has(param)) {
                urlObj.searchParams.set(param, '***');
            }
        });

        // Redact specific path segments (e.g. /api/public/shares/:token)
        if (urlObj.pathname.startsWith('/api/public/shares/')) {
            const segments = urlObj.pathname.split('/');
            // Expected: ['', 'api', 'public', 'shares', 'TOKEN', ...]
            if (segments.length > 4) {
                segments[4] = '***';
                urlObj.pathname = segments.join('/');
            }
        }

        logUrl = urlObj.pathname + urlObj.search;
    } catch (e) {
        // Ignore parsing errors, log original
    }

    console.log(`[${new Date().toISOString()}] ${req.method} ${logUrl}`);
    next();
});
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/api/public/shares/:token', require('./controllers/shareController').accessPublicLink);

app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/shares', shareRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Search (Simple route)
app.get('/api/search', require('./middlewares/authMiddleware'), require('./controllers/searchController').searchItems);

// Activity
app.use('/api/activity', require('./routes/activityRoutes'));



app.get('/', (req, res) => {
    res.send('Storive API is running...');
});

module.exports = app;
