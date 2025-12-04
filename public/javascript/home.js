const API_BASE = '/api'; // Replace with your server endpoint

let currentTab = 'register';

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

    document.getElementById('registerTab').classList.add('hidden');
    document.getElementById('loginTab').classList.add('hidden');
    document.getElementById('resetTab').classList.add('hidden');

    if (tab === 'register') {
        document.getElementById('registerTab').classList.remove('hidden');
    } else if (tab === 'login') {
        document.getElementById('loginTab').classList.remove('hidden');
    } else if (tab === 'reset') {
        document.getElementById('resetTab').classList.remove('hidden');
    }
}

// Encryption functions using Web Crypto API
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

async function encryptCode(code, password) {
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const key = await deriveKey(password, salt);
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoder.encode(code)
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    return btoa(String.fromCharCode(...combined));
}

async function decryptCode(encryptedData, password) {
    try {
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        const salt = combined.slice(0, 16);
        const iv = combined.slice(16, 28);
        const data = combined.slice(28);

        const key = await deriveKey(password, salt);
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            data
        );

        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return null;
    }
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;
    const codeInputs = document.querySelectorAll('.backup-code');

    if (!username || username.length < 3) {
        showAlert('Username must be at least 3 characters', 'error');
        return;
    }

    if (password.length < 8) {
        showAlert('Password must be at least 8 characters', 'error');
        return;
    }

    // Collect only non-empty codes
    const codes = [];
    for (let input of codeInputs) {
        const code = input.value.trim();
        if (code) {
            if (!/^\d{8}$/.test(code)) {
                showAlert(`Code ${parseInt(input.dataset.index) + 1} must be exactly 8 digits`, 'error');
                return;
            }
            codes.push(code);
        }
    }

    if (codes.length === 0) {
        showAlert('Please enter at least one backup code', 'error');
        return;
    }

    // Encrypt all codes client-side
    showAlert(`Encrypting ${codes.length} code(s)...`, 'info');
    const encryptedCodes = [];
    for (let code of codes) {
        const encrypted = await encryptCode(code, password);
        encryptedCodes.push(encrypted);
    }

    // Send to server
    try {
        const response = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username,
                encryptedCodes: encryptedCodes
            })
        });

        const result = await response.json();

        if (response.ok) {
            showAlert(`Registration successful! ${codes.length} code(s) securely stored.`, 'success');
            // Clear form
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            codeInputs.forEach(input => input.value = '');
        } else {
            showAlert(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please check your connection.', 'error');
    }
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showAlert('Please enter both username and password', 'error');
        return;
    }

    showAlert('Retrieving code...', 'info');

    try {
        const response = await fetch(`${API_BASE}/retrieve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username
            })
        });

        const result = await response.json();

        if (response.ok) {
            // Decrypt the code client-side
            const decryptedCode = await decryptCode(result.encryptedCode, password);

            if (decryptedCode && /^\d{8}$/.test(decryptedCode)) {
                // Show the code
                document.getElementById('setupScreen').classList.add('hidden');
                document.getElementById('codeScreen').classList.remove('hidden');
                document.getElementById('retrievedCode').textContent = decryptedCode;

                // Update code counter
                const totalCodes = result.totalCodes || 10;
                const codesUsed = totalCodes - result.codesRemaining;
                document.getElementById('codeHeader').textContent = `Code ${codesUsed}/${totalCodes}:`;
                document.getElementById('codesRemainingCount').textContent = result.codesRemaining;
            } else {
                showAlert('Incorrect password or corrupted data', 'error');
            }
        } else {
            showAlert(result.error || 'Failed to retrieve code', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please check your connection.', 'error');
    }
}

async function resetAccount() {
    const username = document.getElementById('resetUsername').value.trim();
    const confirmUsername = document.getElementById('confirmUsername').value.trim();

    if (!username) {
        showAlert('Please enter your username', 'error');
        return;
    }

    if (username !== confirmUsername) {
        showAlert('Usernames do not match. Please confirm your username.', 'error');
        return;
    }

    if (!confirm(`Are you absolutely sure you want to permanently delete the account "${username}"? This cannot be undone and all your backup codes will be lost forever.`)) {
        return;
    }

    showAlert('Deleting account...', 'info');

    try {
        const response = await fetch(`${API_BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: username
            })
        });

        const result = await response.json();

        if (response.ok) {
            showAlert('Account deleted successfully. You can now register again with the same username.', 'success');
            document.getElementById('resetUsername').value = '';
            document.getElementById('confirmUsername').value = '';

            // Switch to register tab after 2 seconds
            setTimeout(() => {
                document.querySelector('.tab-btn').click();
            }, 2000);
        } else {
            showAlert(result.error || 'Failed to delete account', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please check your connection.', 'error');
    }
}

function logout() {
    document.getElementById('codeScreen').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
    document.getElementById('retrievedCode').textContent = '--------';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

// Only allow digits in code inputs
document.querySelectorAll('.backup-code').forEach(input => {
    input.addEventListener('input', function (e) {
        this.value = this.value.replace(/[^0-9]/g, '');
    });
});

// Enter key handlers
document.getElementById('regPassword').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') register();
});

document.getElementById('loginPassword').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') login();
});

document.getElementById('confirmUsername').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') resetAccount();
});