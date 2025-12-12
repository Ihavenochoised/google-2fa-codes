const API_BASE = '/api';

// Decryption function
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

let response = null;
async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!username || !password) {
        showAlert('Please enter both username and password', 'error');
        return;
    }
    
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Retrieving code...';
    
    try {
        response = response ?? await fetch(`${API_BASE}/retrieve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            const decryptedCode = await decryptCode(result.encryptedCode, password);
            
            if (decryptedCode && /^\d{8}$/.test(decryptedCode)) {
                document.getElementById('loginForm').classList.add('hidden');
                document.getElementById('codeDisplay').classList.remove('hidden');
                document.getElementById('retrievedCode').textContent = decryptedCode;
                
                const totalCodes = result.totalCodes || 10;
                const codesUsed = totalCodes - result.codesRemaining;
                document.getElementById('codeHeader').textContent = `Code ${codesUsed}/${totalCodes}:`;
                document.getElementById('codesRemainingCount').textContent = result.codesRemaining;

                // Debug, delete this on next commit
                alert(codesUsed)

                response = null;
                
                fetch(`${API_BASE}/code-used`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: codesUsed })
                })
            } else {
                showAlert('Incorrect password or corrupted data', 'error');
            }
        } else {
            showAlert(result.error || 'Failed to retrieve code', 'error');
        }
    } catch (error) {
        showAlert('Network error. Please check your connection.', 'error');
    } finally {
        loginBtn.disabled = false;
        loginBtn.textContent = 'Retrieve Backup Code';
    }
}

document.getElementById('loginBtn').addEventListener('click', login);

document.getElementById('loginPassword').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') login();
});