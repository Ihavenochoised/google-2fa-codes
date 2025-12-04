import express from 'express';
import { MongoClient } from 'mongodb';

const router = express.Router();

// MongoDB connection
let db;
let usersCollection;

// Initialize MongoDB connection
export async function initializeDatabase(mongoUri, dbName = '2fa-vault') {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log('✅ Connected to MongoDB');
        
        db = client.db(dbName);
        usersCollection = db.collection('users');
        
        // Create indexes
        await usersCollection.createIndex({ username: 1 }, { unique: true });
        console.log('✅ Database indexes created');
        
        return client;
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        throw error;
    }
}

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to the 2FA Vault API 🔐' });
});

router.get('/status', async (req, res) => {
    try {
        const userCount = await usersCollection.countDocuments();
        res.json({ 
            uptime: process.uptime(), 
            status: 'OK', 
            time: new Date(),
            totalUsers: userCount,
            database: 'Connected'
        });
    } catch (error) {
        res.status(500).json({ 
            uptime: process.uptime(), 
            status: 'ERROR', 
            time: new Date(),
            database: 'Disconnected'
        });
    }
});

router.post('/register', (req, res) => {
    register(req, res);
});

router.post('/retrieve', (req, res) => {
    retrieve(req, res);
});

router.post('/reset', (req, res) => {
    reset(req, res);
});

// ------------- API FUNCTIONS -------------

async function register(req, res) {
    const { username, encryptedCodes } = req.body;
    
    // Validation
    if (!username || typeof username !== 'string' || username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!Array.isArray(encryptedCodes) || encryptedCodes.length === 0) {
        return res.status(400).json({ error: 'Must provide at least one encrypted code' });
    }
    
    if (encryptedCodes.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 codes allowed' });
    }
    
    // Check if all codes are valid base64 strings
    for (let code of encryptedCodes) {
        if (typeof code !== 'string' || code.length === 0) {
            return res.status(400).json({ error: 'Invalid encrypted code format' });
        }
    }
    
    try {
        // Create user document
        const userDoc = {
            username: username,
            encryptedCodes: encryptedCodes,
            usedCodes: [],
            lastRequest: null,
            createdAt: new Date()
        };
        
        await usersCollection.insertOne(userDoc);
        
        res.json({ 
            success: true, 
            message: 'User registered successfully',
            totalCodes: encryptedCodes.length
        });
    } catch (error) {
        if (error.code === 11000) {
            // Duplicate key error (username already exists)
            return res.status(409).json({ error: 'Username already exists' });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
}

async function retrieve(req, res) {
    const { username } = req.body;
    
    // Validation
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        // Find user
        const user = await usersCollection.findOne({ username: username });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Rate limiting: prevent consecutive requests (5 minute cooldown)
        const now = Date.now();
        const cooldownMs = 5 * 60 * 1000; // 5 minutes
        
        if (user.lastRequest && (now - user.lastRequest) < cooldownMs) {
            const waitTime = Math.ceil((cooldownMs - (now - user.lastRequest)) / 1000 / 60);
            return res.status(429).json({ 
                error: `Please wait ${waitTime} minute(s) before requesting another code` 
            });
        }
        
        // Find an unused code
        let unusedCode = null;
        let unusedIndex = -1;
        
        for (let i = 0; i < user.encryptedCodes.length; i++) {
            if (!user.usedCodes.includes(i)) {
                unusedCode = user.encryptedCodes[i];
                unusedIndex = i;
                break;
            }
        }
        
        // Check if any codes remain
        if (unusedCode === null) {
            return res.status(410).json({ error: 'No backup codes remaining' });
        }
        
        // Update user: mark code as used and update last request time
        await usersCollection.updateOne(
            { username: username },
            { 
                $push: { usedCodes: unusedIndex },
                $set: { lastRequest: now }
            }
        );
        
        const totalCodes = user.encryptedCodes.length;
        const codesRemaining = totalCodes - user.usedCodes.length - 1; // -1 for the code we just used
        
        res.json({ 
            encryptedCode: unusedCode,
            codesRemaining: codesRemaining,
            totalCodes: totalCodes
        });
    } catch (error) {
        console.error('Retrieve error:', error);
        res.status(500).json({ error: 'Server error during retrieval' });
    }
}

async function reset(req, res) {
    const { username } = req.body;
    
    // Validation
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    try {
        // Delete user
        const result = await usersCollection.deleteOne({ username: username });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
            success: true, 
            message: 'Account deleted successfully' 
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ error: 'Server error during reset' });
    }
}

// -----------------------------------------

export default router;