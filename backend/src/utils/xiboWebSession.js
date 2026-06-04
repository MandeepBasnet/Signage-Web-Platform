import axios from "axios";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";

// A single shared, authenticated Xibo *web* session (cookie + CSRF), used to fetch
// resources that the OAuth API does not expose — notably layout thumbnails, which
// only exist on the web UI at {baseUrl}/layout/thumbnail/{id} (no /api).
//
// Credentials come from env (XIBO_WEB_USERNAME / XIBO_WEB_PASSWORD), so the session
// can re-login at any time: it survives restarts, refreshes forever, and never
// stores a user's password. The single shared identity is fine here because it only
// renders thumbnail IMAGES of layouts the user is already permitted to see.

// Re-login proactively after this long (Xibo web sessions are typically longer, but
// this bounds staleness; the thumbnail handler also retries on a dead session).
const SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes

let session = null; // { client, loggedInAt }
let loginPromise = null; // in-flight login guard (prevents stampede)

export class WebSessionNotConfiguredError extends Error {
  constructor(message) {
    super(message);
    this.name = "WebSessionNotConfiguredError";
  }
}

// Base web URL = XIBO_API_URL without the trailing /api.
// e.g. https://signage.modusmedia.io/api -> https://signage.modusmedia.io
export function getWebBaseUrl() {
  const apiUrl = process.env.XIBO_API_URL;
  if (!apiUrl) {
    throw new WebSessionNotConfiguredError("XIBO_API_URL is not configured.");
  }
  return apiUrl.replace(/\/api\/?$/, "");
}

// Perform a fresh CSRF + cookie login against the Xibo web UI.
// Mirrors the logic used in xiboClient.verifyXiboPassword, but with the
// service-account credentials from env. Returns an axios client bound to a jar.
async function performWebLogin() {
  const username = process.env.XIBO_WEB_USERNAME;
  const password = process.env.XIBO_WEB_PASSWORD;

  if (!username || !password) {
    throw new WebSessionNotConfiguredError(
      "XIBO_WEB_USERNAME / XIBO_WEB_PASSWORD are not configured; layout thumbnails are unavailable.",
    );
  }

  const baseUrl = getWebBaseUrl();
  const loginUrl = `${baseUrl}/login`;

  const jar = new CookieJar();
  const client = wrapper(axios.create({ jar }));

  console.log(`[xiboWebSession] Logging in to ${loginUrl} as "${username}"...`);

  // 1. GET the login page to obtain the CSRF token.
  const getRes = await client.get(loginUrl);
  const tokenMatch =
    getRes.data.match(/name=["']csrfToken["'][^>]*value=["']([^"']+)["']/) ||
    getRes.data.match(/value=["']([^"']+)["'][^>]*name=["']csrfToken["']/);

  if (!tokenMatch) {
    throw new Error("[xiboWebSession] CSRF token not found on login page.");
  }
  const csrfToken = tokenMatch[1];

  // 2. POST credentials. A 302 redirect away from /login = success.
  const postRes = await client.post(
    loginUrl,
    new URLSearchParams({ csrfToken, username, password }),
    {
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
    },
  );

  const location = postRes.headers?.location || "";
  const success = postRes.status === 302 && !location.includes("login");
  if (!success) {
    throw new Error(
      `[xiboWebSession] Login failed (status ${postRes.status}, location "${location}"). Check XIBO_WEB_USERNAME / XIBO_WEB_PASSWORD.`,
    );
  }

  console.log(`[xiboWebSession] ✓ Web session established.`);
  return client;
}

function isFresh() {
  return (
    session &&
    session.client &&
    Date.now() - session.loggedInAt < SESSION_TTL_MS
  );
}

// Return a logged-in axios client, logging in (or re-logging in) as needed.
// Concurrent callers share a single in-flight login.
export async function getWebClient() {
  if (isFresh()) {
    return session.client;
  }

  if (!loginPromise) {
    loginPromise = performWebLogin()
      .then((client) => {
        session = { client, loggedInAt: Date.now() };
        return client;
      })
      .finally(() => {
        loginPromise = null;
      });
  }

  return loginPromise;
}

// Drop the cached session so the next getWebClient() re-logs-in. Call this when a
// request comes back looking like the login page / 401 / 403 (session expired).
export function invalidateWebSession() {
  session = null;
}
