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
