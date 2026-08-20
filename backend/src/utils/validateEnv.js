// Startup environment/security validation. Fails fast in PRODUCTION on insecure
// configuration; in development it only warns, so local work isn't disrupted.
// Call once after dotenv.config(), before the server starts listening.
const WEAK_SECRETS = new Set([
  "secret",
  "changeme",
  "change_me",
  "jwt_secret",
  "your_jwt_secret",
  "supersecret",
]);

// Matches the localhost check in server.js — kept in sync deliberately: an
// allowlist that only ever names these is useless to a deployed frontend.
const isLocalhostOrigin = (origin) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

export function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";
  const problems = [];

  // Vars the app cannot function (or sign tokens) without.
  for (const key of [
    "XIBO_API_URL",
    "XIBO_CLIENT_ID",
    "XIBO_CLIENT_SECRET",
    "JWT_SECRET",
  ]) {
    if (!process.env[key]) problems.push(`${key} is not set`);
  }

  // JWT secret strength — a weak/guessable secret means forgeable sessions.
  const secret = process.env.JWT_SECRET || "";
  if (secret && (secret.length < 32 || WEAK_SECRETS.has(secret.toLowerCase()))) {
    problems.push(
      "JWT_SECRET is weak — use a random value of at least 32 characters " +
        '(generate: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))")'
    );
  }

  // Browser origins permitted by CORS. An unset (or localhost-only) allowlist in
  // production is the worst kind of misconfiguration: the server boots and
  // reports healthy, but every browser request dies at the preflight with no
  // Access-Control-Allow-Origin header, so the failure only shows up in the
  // frontend console. Fail here instead.
  const originList = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (isProd && originList.length === 0) {
    problems.push(
      "ALLOWED_ORIGINS is not set — CORS falls back to the localhost defaults, " +
        "which blocks the deployed frontend (set it to the frontend origin, " +
        "e.g. https://app.example.com)"
    );
  }

  for (const origin of originList) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      problems.push(
        `ALLOWED_ORIGINS entry "${origin}" is not a valid origin ` +
          "(expected e.g. https://app.example.com)"
      );
      continue;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      problems.push(
        `ALLOWED_ORIGINS entry "${origin}" must use http:// or https://`
      );
    } else if (parsed.origin !== origin) {
      // The Origin header a browser sends is exactly scheme://host[:port], and
      // the allowlist is compared with a strict string match — so a trailing
      // slash or a path silently never matches.
      problems.push(
        `ALLOWED_ORIGINS entry "${origin}" must be exactly "${parsed.origin}" ` +
          "(no trailing slash, path or query)"
      );
    }
  }

  if (isProd && originList.length > 0 && originList.every(isLocalhostOrigin)) {
    problems.push(
      "ALLOWED_ORIGINS contains only localhost origins — the deployed frontend " +
        "will be blocked by CORS"
    );
  }

  // Global TLS verification must not be disabled — it exposes every outbound
  // HTTPS call (incl. the Xibo app token + credentials) to MITM.
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    problems.push(
      "NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate verification (MITM risk); " +
        "unset it and fix the Xibo certificate trust instead"
    );
  }

  if (problems.length === 0) {
    console.log("[env] security check passed");
    return;
  }

  const header = "[env] security check found issue(s):";
  const list = problems.map((p) => `  ✗ ${p}`).join("\n");

  if (isProd) {
    console.error(
      `\n${header}\n${list}\n\nRefusing to start in production — fix the above and retry.\n`
    );
    process.exit(1);
  }
  console.warn(
    `\n⚠️  ${header}\n${list}\n  (permitted in development; MUST be fixed before production)\n`
  );
}
