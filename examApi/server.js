// server.js

process.env.TZ = 'Asia/Kolkata';

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: '*',
    credentials: true,
}));

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Routes
const examRoutes = require('./routes/examRoutes');
app.use('/api', examRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err.message,
    });
});
