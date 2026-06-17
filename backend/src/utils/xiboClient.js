import axios from "axios";
import FormData from "form-data";
import qs from "qs";
import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import { timedXibo } from "./perf.js";
let token = null;
let tokenPromise = null; // shared in-flight auth request (prevents stampedes)

// Get application access token (for API operations). Concurrent callers share a
// single in-flight request, so we never fire multiple auth calls at once.
export async function getAccessToken() {
  if (token) return token;
  if (tokenPromise) return tokenPromise;
  tokenPromise = fetchAccessToken().finally(() => {
    tokenPromise = null;
  });
  return tokenPromise;
}

async function fetchAccessToken() {
  // Check if XIBO_API_URL is configured
  if (!process.env.XIBO_API_URL) {
    throw new Error(
      "XIBO_API_URL is not configured. Please set the XIBO_API_URL environment variable."
    );
  }

  // Xibo API uses form data for authentication
  const formData = new FormData();
  formData.append("client_id", process.env.XIBO_CLIENT_ID);
  formData.append("client_secret", process.env.XIBO_CLIENT_SECRET);
  formData.append("grant_type", "client_credentials");

  console.log(`[xiboClient] Authenticating with:`);
  console.log(`  - URL: ${process.env.XIBO_API_URL}/authorize/access_token`);
  console.log(`  - Client ID: ${process.env.XIBO_CLIENT_ID}`);
  console.log(
    `  - Client Secret length: ${process.env.XIBO_CLIENT_SECRET?.length || 0}`
  );

  try {
    const res = await axios.post(
      `${process.env.XIBO_API_URL}/authorize/access_token`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 10000, // 10 second timeout
      }
    );
    console.log(`[xiboClient] ✓ Authentication successful`);
    token = res.data.access_token;
    setTimeout(() => (token = null), res.data.expires_in * 900);
    return token;
  } catch (error) {
    // Handle network/DNS errors
    if (
      error.code === "ENOTFOUND" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ETIMEDOUT"
    ) {
      const apiUrl = process.env.XIBO_API_URL;
      throw new Error(
        `Cannot connect to Xibo API server (${apiUrl}). Please check:\n` +
          `1. The XIBO_API_URL is correct: ${apiUrl}\n` +
          `2. The server is accessible from this network\n` +
          `3. Your internet connection is working\n` +
          `Error: ${error.message}`
      );
    }

    // Handle authentication errors
    if (error.response) {
      console.error(`[xiboClient] ✗ Authentication failed:`, {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });
      throw new Error(
        `Xibo API authentication failed: ${error.response.status} ${error.response.statusText}. ` +
          `Please check your XIBO_CLIENT_ID and XIBO_CLIENT_SECRET.`
      );
    }

    // Re-throw other errors
    throw error;
  }
}

// Helper to verify password via Web UI (Proxy Auth)
async function verifyXiboPassword(username, password) {
  try {
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));
    
    // Base URL from API URL (remove /api)
    // Example: https://portal.signage-lab.com/api -> https://portal.signage-lab.com
    const baseUrl = process.env.XIBO_API_URL.replace(/\/api\/?$/, "");
    const loginUrl = `${baseUrl}/login`;

    console.log(`[verifyXiboPassword] Checking password against ${loginUrl}...`);

    // 1. Get Login Page for Token
    const getRes = await client.get(loginUrl);
    
    // Robust Regex to find csrfToken value
    // Matches: name="csrfToken" ... value="XYZ" OR value="XYZ" ... name="csrfToken"
    // Handles newlines and different attribute ordering
    const tokenMatch = getRes.data.match(/name=["']csrfToken["'][^>]*value=["']([^"']+)["']/) || 
                       getRes.data.match(/value=["']([^"']+)["'][^>]*name=["']csrfToken["']/);

    if (!tokenMatch) {
      console.error("[verifyXiboPassword] ❌ CSRF Token not found in login page HTML");
      // Fail open or closed? Closed for security.
      return false; 
    }

    const csrfToken = tokenMatch[1];
    
    // 2. Submit Login
    const postRes = await client.post(loginUrl, 
      new URLSearchParams({
        csrfToken: csrfToken,
        username: username,
        password: password
      }), 
      {
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      }
    );

    // 3. Check Result
    // 302 Redirect is the expected success case
    if (postRes.status === 302) {
      const location = postRes.headers.location;
      // If redirecting back to login, it failed (e.g. /login)
      if (location && location.includes("login")) {
         console.log(`[verifyXiboPassword] ❌ Redirected back to login (Auth Failed)`);
         return false;
      }
      console.log(`[verifyXiboPassword] ✅ Redirected to ${location} (Auth Success)`);
      return true;
    }

    // If we got 200 OK, it usually means the page re-rendered with validation errors
    if (postRes.status === 200) {
        console.log(`[verifyXiboPassword] ❌ Received 200 OK (Login Form Re-rendered - Auth Failed)`);
        return false;
    }

    return false;

  } catch (err) {
    console.error(`[verifyXiboPassword] Error: ${err.message}`);
    return false;
  }
}


// Authenticate user with Xibo credentials
// Since Xibo doesn't support password grant, we use a workaround:
// 1. Get app token with client credentials
// 2. Search for user by username
// 3. Verify user exists and get their info
// Note: This approach uses the application token, so all API calls will be made with app permissions
export async function authenticateUser(username, password) {
  // 1. PASSWORD VERIFICATION IS THE AUTH GATE (fail closed).
  // Xibo's API has no password grant, so we verify against the Xibo web login
  // (verifyXiboPassword). This does NOT depend on the app token's user-search
  // permission. A login is accepted ONLY if the password explicitly verifies —
  // any error or unverified state rejects it. (Previously this could fail OPEN:
  // a user-search 401/timeout would accept the login without checking the
  // password. That is fixed here.)
  let isPasswordValid = false;
  try {
    isPasswordValid = await verifyXiboPassword(username, password);
  } catch (err) {
    console.error(
      `[authenticateUser] Password verification error for "${username}":`,
      err.message
    );
    return {
      success: false,
      message: "Could not verify credentials. Please try again.",
    };
  }

  if (!isPasswordValid) {
    console.warn(`[authenticateUser] ❌ Invalid credentials for "${username}"`);
    return { success: false, message: "Invalid credentials" };
  }

  console.log(`[authenticateUser] ✅ Password verified for "${username}"`);

  // 2. Password is valid. Get the app token (required to issue an authenticated
  // session). If this fails, the auth service is down — fail closed.
  let appToken;
  try {
    appToken = await getAccessToken();
  } catch (tokenError) {
    console.error(
      `[authenticateUser] App token retrieval failed:`,
      tokenError.message
    );
    return {
      success: false,
      message: `Authentication service unavailable: ${tokenError.message}`,
    };
  }

  // 3. Fetch user metadata (userId / groups / email) — BEST EFFORT ONLY. This
  // just enriches the session and must never gate the (already verified) login;
  // if it fails we proceed with minimal info derived from the login identifier.
  let user = {
    userName: username,
    email: username.includes("@") ? username : null,
    userId: null,
  };
  try {
    let userSearchResponse;
    try {
      userSearchResponse = await axios.get(`${process.env.XIBO_API_URL}/user`, {
        headers: { Authorization: `Bearer ${appToken}` },
        params: { userName: username },
      });
    } catch {
      // Filter param unsupported — fall back to listing users.
      userSearchResponse = await axios.get(`${process.env.XIBO_API_URL}/user`, {
        headers: { Authorization: `Bearer ${appToken}` },
      });
    }

    let users = [];
    if (Array.isArray(userSearchResponse.data)) {
      users = userSearchResponse.data;
    } else if (userSearchResponse.data?.data) {
      users = Array.isArray(userSearchResponse.data.data)
        ? userSearchResponse.data.data
        : [userSearchResponse.data.data];
    } else if (userSearchResponse.data) {
      users = [userSearchResponse.data];
    }

    const matched = users.find(
      (u) =>
        u.userName === username ||
        u.email === username ||
        u.userName?.toLowerCase() === username?.toLowerCase() ||
        u.email?.toLowerCase() === username?.toLowerCase()
    );
    if (matched) {
      user = matched;
    } else {
      console.warn(
        `[authenticateUser] Password verified but no matching user record for "${username}"; continuing with minimal info.`
      );
    }
  } catch (metaError) {
    console.warn(
      `[authenticateUser] Could not fetch user metadata (continuing):`,
      metaError.response?.status || metaError.message
    );
  }

  return {
    success: true,
    access_token: appToken,
    user,
    note: "Authenticated via web-login password verification",
  };
}

// Get user info using access token
export async function getUserInfo(accessToken) {
  try {
    const res = await axios.get(`${process.env.XIBO_API_URL}/user/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.data;
  } catch (error) {
    throw error;
  }
}

// GET a Xibo grid endpoint and also return the total row count from the
// `X-Total-Count` response header (Xibo's standard for grid endpoints), which
// `xiboRequest` discards. Used for server-side pagination. Returns
// { data, total }; falls back to data.length when the header is absent.
export async function xiboGetWithCount(endpoint, userToken = null) {
  const accessToken = userToken || (await getAccessToken());
  const res = await timedXibo(() =>
    axios.get(`${process.env.XIBO_API_URL}${endpoint}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  );
  const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
  const total = Number(res.headers["x-total-count"]);
  return { data, total: Number.isFinite(total) ? total : data.length };
}

export async function xiboRequest(
  endpoint,
  method = "GET",
  data = null,
  userToken = null,
  customHeaders = {}
) {
  // Use user's token if provided, otherwise use application token
  const accessToken = userToken || (await getAccessToken());

  // Xibo API requires form data for PUT requests
  const isPutRequest = method.toUpperCase() === "PUT";

  let requestConfig = {
    method,
    url: `${process.env.XIBO_API_URL}${endpoint}`,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...customHeaders,
    },
  };

  if (data) {
    // Check if Content-Type is explicitly set to JSON for PUT requests
    const isJsonPut = isPutRequest && requestConfig.headers["Content-Type"] === "application/json";

    if (isPutRequest && !isJsonPut) {
      // Xibo requires application/x-www-form-urlencoded for PUT requests (default behavior)
      
      // FIX: Removed specific check for 'elements' string. 
      // We ALWAYS want to use qs.stringify to ensure all keys (mediaIds AND elements) 
      // are properly encoded as form fields.
      
      const serializedData = qs.stringify(data);
      console.log(`[xiboRequest] Serialized data preview (Length: ${serializedData.length}):`, serializedData.substring(0, 500) + (serializedData.length > 500 ? "..." : ""));
      requestConfig.data = serializedData;
      
      requestConfig.headers["Content-Type"] =
        "application/x-www-form-urlencoded";
    } else {
      // Use JSON for other methods OR if explicitly requested for PUT
      requestConfig.data = data;
      if (!requestConfig.headers["Content-Type"]) {
        requestConfig.headers["Content-Type"] = "application/json";
      }
    }
  } else if (isPutRequest && !requestConfig.headers["Content-Type"]) {
    // Even if no data, PUT requests need form data content type by default
    requestConfig.headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  try {
    console.log(`[xiboRequest] ${method} ${requestConfig.url}`, {
      hasData: !!data,
      dataKeys: data ? Object.keys(data) : null,
      headers: Object.keys(requestConfig.headers),
    });
    const res = await timedXibo(() => axios(requestConfig));
    return res.data;
  } catch (err) {
    // Retry on 401 Unauthorized
    if (err.response && err.response.status === 401) {
      console.warn(
        `[xiboRequest] 401 Unauthorized for ${endpoint}. Retrying with fresh App Token...`
      );

      try {
        // Force refresh of app token
        token = null; 
        const freshToken = await getAccessToken();

        // Update header with new token
        requestConfig.headers.Authorization = `Bearer ${freshToken}`;

        const retryRes = await timedXibo(() => axios(requestConfig));
        return retryRes.data;
      } catch (retryErr) {
        console.error(
          `[xiboRequest] Retry failed for ${endpoint}:`,
          retryErr.message
        );
        // Throw the original error if retry fails, or the retry error?
        // Usually better to throw the retry error as it's the most recent
        throw retryErr;
      }
    }

    console.error(`[xiboRequest] ${method} ${requestConfig.url} failed:`, {
      status: err.response?.status,
      statusText: err.response?.statusText,
      message: err.message,
      responseData: err.response?.data,
    });
    throw err;
  }
}
