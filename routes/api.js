import express from 'express';

const router = express.Router();

// In-memory storage (replace with database in production)
const users = new Map(); // username -> { encryptedCodes: [], usedCodes: Set(), lastRequest: null }

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to the 2FA Vault API 🔐' });
});

router.get('/status', (req, res) => {
    res.json({ 
        uptime: process.uptime(), 
        status: 'OK', 
        time: new Date(),
        totalUsers: users.size 
    });
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

function register(req, res) {
    const { username, encryptedCodes } = req.body;
    
    // Validation
    if (!username || typeof username !== 'string' || username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!Array.isArray(encryptedCodes) || encryptedCodes.length !== 10) {
        return res.status(400).json({ error: 'Must provide exactly 10 encrypted codes' });
    }
    
    // Check if all codes are valid base64 strings
    for (let code of encryptedCodes) {
        if (typeof code !== 'string' || code.length === 0) {
            return res.status(400).json({ error: 'Invalid encrypted code format' });
        }
    }
    
    // Check if username already exists
    if (users.has(username)) {
        return res.status(409).json({ error: 'Username already exists' });
    }
    
    // Store user data
    users.set(username, {
        encryptedCodes: encryptedCodes,
        usedCodes: new Set(),
        lastRequest: null
    });
    
    res.json({ 
        success: true, 
        message: 'User registered successfully' 
    });
}

function retrieve(req, res) {
    const { username } = req.body;
    
    // Validation
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if user exists
    if (!users.has(username)) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    const userData = users.get(username);
    
    // Rate limiting: prevent consecutive requests (5 minute cooldown)
    const now = Date.now();
    const cooldownMs = 5 * 60 * 1000; // 5 minutes
    
    if (userData.lastRequest && (now - userData.lastRequest) < cooldownMs) {
        const waitTime = Math.ceil((cooldownMs - (now - userData.lastRequest)) / 1000 / 60);
        return res.status(429).json({ 
            error: `Please wait ${waitTime} minute(s) before requesting another code` 
        });
    }
    
    // Find an unused code
    let unusedCode = null;
    let unusedIndex = -1;
    
    for (let i = 0; i < userData.encryptedCodes.length; i++) {
        if (!userData.usedCodes.has(i)) {
            unusedCode = userData.encryptedCodes[i];
            unusedIndex = i;
            break;
        }
    }
    
    // Check if any codes remain
    if (unusedCode === null) {
        return res.status(410).json({ error: 'No backup codes remaining' });
    }
    
    // Mark code as used and update last request time
    userData.usedCodes.add(unusedIndex);
    userData.lastRequest = now;
    
    const codesRemaining = userData.encryptedCodes.length - userData.usedCodes.size;
    
    res.json({ 
        encryptedCode: unusedCode,
        codesRemaining: codesRemaining
    });
}

function reset(req, res) {
    const { username } = req.body;
    
    // Validation
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    // Check if user exists
    if (!users.has(username)) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user
    users.delete(username);
    
    res.json({ 
        success: true, 
        message: 'Account deleted successfully' 
    });
}

// -----------------------------------------

export default router;