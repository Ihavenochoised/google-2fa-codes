const API_BASE = '/api';

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
    
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...combined));
}

function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertContainer.innerHTML = '';
    }, 5000);
}

// Clean code input - remove spaces and non-digits
function cleanCode(code) {
    return code.replace(/\s/g, '').replace(/[^0-9]/g, '');
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
    
    const codes = [];
    for (let input of codeInputs) {
        const code = cleanCode(input.value.trim());
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
    
    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    registerBtn.textContent = `Encrypting ${codes.length} code(s)...`;
    
    try {
        const encryptedCodes = [];
        for (let code of codes) {
            const encrypted = await encryptCode(code, password);
            encryptedCodes.push(encrypted);
        }
        
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
            showAlert(`Registration successful! ${codes.length} code(s) securely stored. Redirecting to home...`, 'success');
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            codeInputs.forEach(input => input.value = '');
            
            setTimeout(() => {
                window.location.href = '/';
            }, 5000);
        } else {
            showAlert(result.error || 'Registration failed', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please check your connection.', 'error');
    } finally {
        registerBtn.disabled = false;
        registerBtn.textContent = 'Register & Encrypt Codes';
    }
}

// Clean input on paste and type
document.querySelectorAll('.backup-code').forEach(input => {
    input.addEventListener('input', function(e) {
        this.value = cleanCode(this.value);
    });
    
    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const pastedText = (e.clipboardData || window.clipboardData).getData('text');
        this.value = cleanCode(pastedText);
    });
});

document.getElementById('registerBtn').addEventListener('click', register);

document.getElementById('regPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') register();
});