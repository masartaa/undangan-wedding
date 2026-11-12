import { pbkdf2, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  createSessionCookie,
  getSessionSecret,
  hashClientAddress,
  parseJsonBody,
  requireAllowedOrigin,
  requireSupabaseConfig,
  sendJson,
  sendMethodNotAllowed
} from "../../lib/admin-auth.js";
import { supabaseRequest } from "../../lib/supabase.js";

const PBKDF2_ITERATIONS = 600000;
const PASSWORD_HASH_LENGTH = 32;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LIMIT = 5;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const derivePasswordHash = promisify(pbkdf2);

export const config = {
  api: {
    bodyParser: { sizeLimit: "4kb" }
  }
};

const verifyPassword = async (password, salt, storedHash) => {
  let saltBytes;
  let expectedHash;
  try {
    saltBytes = Buffer.from(salt, "base64");
    expectedHash = Buffer.from(storedHash, "base64");
  } catch {
    return false;
  }

  if (saltBytes.length < 16 || expectedHash.length !== PASSWORD_HASH_LENGTH) {
    return false;
  }

  const actualHash = await derivePasswordHash(
    password,
    saltBytes,
    PBKDF2_ITERATIONS,
    PASSWORD_HASH_LENGTH,
    "sha256"
  );
  return timingSafeEqual(actualHash, expectedHash);
};

const performDummyHash = (password) =>
  derivePasswordHash(
    password,
    Buffer.alloc(16),
    PBKDF2_ITERATIONS,
    PASSWORD_HASH_LENGTH,
    "sha256"
  );

const isLoginLimitReached = async (supabaseConfig, rateLimitKey, windowStart) => {
  const query = new URLSearchParams({
    select: "count",
    rate_key: `eq.${rateLimitKey}`,
    window_start: `eq.${windowStart}`,
    limit: "1"
  });
  const response = await supabaseRequest(supabaseConfig, `rate_limit?${query}`);
  const rows = await response.json();
  if (!Array.isArray(rows)) {
    throw new Error("Supabase returned an invalid login rate-limit result.");
  }
  return Number(rows[0]?.count ?? 0) >= LOGIN_LIMIT;
};

const recordFailedLogin = async (supabaseConfig, rateLimitKey, now, windowStart) => {
  const response = await supabaseRequest(supabaseConfig, "rpc/consume_rate_limit", {
    method: "POST",
    body: {
      p_key: rateLimitKey,
      p_window_start: windowStart,
      p_now: now,
      p_limit: LOGIN_LIMIT,
      p_retention_ms: RATE_LIMIT_RETENTION_MS
    }
  });
  return (await response.json()) === true;
};

const sendTooManyAttempts = (response, now, windowStart) =>
  sendJson(
    response,
    { error: "Terlalu banyak percobaan login. Silakan coba lagi dalam 15 menit." },
    429,
    { "Retry-After": String(Math.ceil((windowStart + LOGIN_WINDOW_MS - now) / 1000)) }
  );

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return sendMethodNotAllowed(response, "POST");
  }
  if (!requireAllowedOrigin(request, response)) {
    return;
  }
  if (!getSessionSecret()) {
    return sendJson(response, { error: "Layanan admin belum dikonfigurasi." }, 503);
  }

  const body = parseJsonBody(request.body);
  if (
    !body ||
    Object.keys(body).some((field) => !["username", "password"].includes(field)) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string" ||
    !/^[A-Za-z0-9._-]{3,80}$/.test(body.username) ||
    body.password.length < 12 ||
    body.password.length > 128
  ) {
    return sendJson(response, { error: "Username atau kata sandi tidak valid." }, 400);
  }

  const supabaseConfig = requireSupabaseConfig(response);
  if (!supabaseConfig) {
    return;
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / LOGIN_WINDOW_MS) * LOGIN_WINDOW_MS;
    const rateLimitKey = hashClientAddress(request, "admin-login");
    if (await isLoginLimitReached(supabaseConfig, rateLimitKey, windowStart)) {
      return sendTooManyAttempts(response, now, windowStart);
    }

    const query = new URLSearchParams({
      select: "username,password_hash,salt",
      username: `eq.${body.username}`,
      limit: "1"
    });
    const adminResponse = await supabaseRequest(supabaseConfig, `admin?${query}`);
    const admins = await adminResponse.json();
    if (!Array.isArray(admins)) {
      throw new Error("Supabase returned an invalid admin result.");
    }

    const admin = admins[0];
    const passwordMatches = admin
      ? await verifyPassword(body.password, admin.salt, admin.password_hash)
      : (await performDummyHash(body.password), false);

    if (!passwordMatches) {
      if (!(await recordFailedLogin(supabaseConfig, rateLimitKey, now, windowStart))) {
        return sendTooManyAttempts(response, now, windowStart);
      }
      return sendJson(response, { error: "Username atau kata sandi salah." }, 401);
    }

    response.setHeader("Set-Cookie", createSessionCookie(admin.username));
    return sendJson(response, { ok: true, username: admin.username });
  } catch (error) {
    console.error("Login admin gagal diproses.", error);
    return sendJson(response, { error: "Login belum dapat diproses. Silakan coba lagi." }, 500);
  }
}
