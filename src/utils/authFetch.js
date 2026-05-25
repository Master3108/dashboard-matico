/**
 * authFetch — wrapper de fetch que agrega JWT automáticamente
 *
 * Uso:
 *   import { authFetch } from '../utils/authFetch';
 *   const res = await authFetch('/api/profile?user_id=TK-ABC123');
 *   const data = await res.json();
 */

const TOKEN_KEY = 'matico_jwt';

export function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(jwt) {
    if (jwt) {
        localStorage.setItem(TOKEN_KEY, jwt);
    }
}

export function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
}

export async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = {
        ...(options.headers || {}),
    };

    // Only add Content-Type for non-FormData requests
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    // If 401, token expired — clear and redirect to login
    if (response.status === 401) {
        const data = await response.clone().json().catch(() => ({}));
        if (data.error === 'Token expirado' || data.error === 'Token inválido') {
            clearToken();
            localStorage.removeItem('matico_user');
            // Dispatch event so App.jsx can catch it and show login
            window.dispatchEvent(new CustomEvent('matico:session-expired'));
        }
    }

    return response;
}

// For webhook calls that need auth
export async function authWebhook(body) {
    return authFetch('/webhook/MATICO', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}
