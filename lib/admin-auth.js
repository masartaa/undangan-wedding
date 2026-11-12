import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseConfig } from "./supabase.js";

const SESSION_COOKIE = "__Host-wedding_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

export const sendJson = (response, body, status = 200, headers = {}) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Robots-Tag", "noindex, nofollow");
  for (const [name, value] of Object.entries(headers)) {
    response.setHeader(name, value);
  }
  response.status(status).json(body);
};

export const sendMethodNotAllowed = (response, allowed) =>
  sendJson(
    response,
    { error: "Metode permintaan tidak didukung." },
    405,
    { Allow: allowed }
  );

export const getSessionSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    return null;
  }
  return secret;
};

const sign = (payload, secret) =>
  createHmac("sha256", secret).update(payload).digest("base64url");

export const createSessionCookie = (username) => {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }

  const payload = Buffer.from(
    JSON.stringify({
      sub: username,
      exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
    })
  ).toString("base64url");
  const token = `${payload}.${sign(payload, secret)}`;
  return `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${SESSION_DURATION_SECONDS}; HttpOnly; Secure; SameSite=Strict`;
};

export const clearSessionCookie = () =>
  `${SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict`;

const readCookie = (request, name) => {
  const cookieHeader = request.headers.cookie;
  if (typeof cookieHeader !== "string") {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");
    if (cookieName === name) {
      return valueParts.join("=");
    }
  }

  return null;
};

export const readSession = (request) => {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes.");
  }

  const token = readCookie(request, SESSION_COOKIE);
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const [payload, signature] = parts;
  const expected = Buffer.from(sign(payload, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      typeof session.sub !== "string" ||
      typeof session.exp !== "number" ||
      session.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
};

export const requireAdminSession = (request, response) => {
  try {
    const session = readSession(request);
    if (!session) {
      sendJson(response, { error: "Sesi admin tidak valid atau telah berakhir." }, 401);
      return null;
    }
    return session;
  } catch (error) {
    console.error("Konfigurasi sesi admin tidak valid.", error);
    sendJson(response, { error: "Layanan admin belum dikonfigurasi." }, 503);
    return null;
  }
};

export const isAllowedOrigin = (request) => {
  const origin = request.headers.origin;
  if (typeof origin !== "string") {
    return false;
  }

  let requestOrigin;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return false;
  }

  const allowedOrigins = new Set();
  if (process.env.APP_ORIGIN) {
    try {
      allowedOrigins.add(new URL(process.env.APP_ORIGIN).origin);
    } catch {
      return false;
    }
  }
  if (process.env.VERCEL_URL) {
    try {
      allowedOrigins.add(new URL(`https://${process.env.VERCEL_URL}`).origin);
    } catch {
      return false;
    }
  }

  return allowedOrigins.has(requestOrigin);
};

export const requireAllowedOrigin = (request, response) => {
  if (!isAllowedOrigin(request)) {
    sendJson(response, { error: "Asal permintaan tidak diizinkan." }, 403);
    return false;
  }
  return true;
};

export const requireSupabaseConfig = (response) => {
  const config = getSupabaseConfig();
  if (!config) {
    sendJson(response, { error: "Layanan admin belum dikonfigurasi." }, 503);
    return null;
  }
  return config;
};

export const parseJsonBody = (body) => {
  if (typeof body === "string" || Buffer.isBuffer(body)) {
    try {
      body = JSON.parse(body.toString());
    } catch {
      return null;
    }
  }
  return body && typeof body === "object" && !Array.isArray(body) ? body : null;
};

export const hashClientAddress = (request, prefix) => {
  const forwardedFor = request.headers["x-forwarded-for"];
  const address = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",", 1)[0].trim()
      : request.headers["x-real-ip"];

  if (typeof address !== "string" || !address.trim() || address.length > 128) {
    throw new Error("Alamat klien tidak valid untuk pembatasan percobaan login.");
  }

  const digest = createHash("sha256").update(address.trim()).digest("hex");
  return `${prefix}:${digest}`;
};
