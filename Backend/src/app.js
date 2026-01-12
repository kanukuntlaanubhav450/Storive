const express = require('express');
const cors = require('cors');

const app = express();

const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const folderRoutes = require('./routes/folderRoutes');
const fileRoutes = require('./routes/fileRoutes');
const shareRoutes = require('./routes/shareRoutes');

// Middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.get('/api/public/shares/:token', require('./controllers/shareController').accessPublicLink);

app.use('/api/auth', authRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/shares', shareRoutes);

// Search (Simple route)
app.get('/api/search', require('./middlewares/authMiddleware'), require('./controllers/searchController').searchItems);

// Activity
app.use('/api/activity', require('./routes/activityRoutes'));



app.get('/', (req, res) => {
    res.send('Storive API is running...');
});

module.exports = app;
