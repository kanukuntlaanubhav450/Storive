const express = require('express');
const cors = require('cors');

const app = express();

const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const folderRoutes = require('./routes/folderRoutes');

// Middlewares
app.use