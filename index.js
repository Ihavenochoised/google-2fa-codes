import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pageRouter from './routes/routes.js';
import apiRouter, { initializeDatabase } from './routes/api.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// MongoDB configuration
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || '2fa-vault';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// 🧩 Routers
app.use('/', pageRouter);
app.use('/api', express.json(), apiRouter);

// 404 fallback
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public/404.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        // Connect to MongoDB
        await initializeDatabase(MONGODB_URI, DB_NAME);
        
        // Start listening
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📊 Database: ${DB_NAME}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();