const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

function decodeJwt(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.warn("Failed to decode JWT:", error);
    return null;
  }
}

export function saveAuth(token, user) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn("Unable to persist auth data:", error);
  }
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (error) {
    console.warn("Unable to clear auth data:", error);
  }
}

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isTokenValid() {
  const token = getStoredToken();
  if (!token) return false;
  const payload = decodeJwt(token);
  if (!payload) {
    clearAuth();
    return false;
  }

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    clearAuth();
    return false;
  }
  return true;
}

export function getAuthHeaders(extra = {}) {
  const token = getStoredToken();
  return {
    Authorization: token ? `Bearer ${token}` : undefined,
    ...extra,
  };
}
