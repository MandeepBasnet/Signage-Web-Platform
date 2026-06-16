import { API_BASE_URL } from "../config/api.js";
import { getAuthHeaders } from "../utils/auth.js";

// Thin fetch wrapper for React Query queryFns: attaches auth headers, throws on
// non-2xx (so React Query treats it as an error), and returns parsed JSON.
export async function apiGet(path) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || `Request failed: ${res.status}`);
  }
  return res.json();
}
