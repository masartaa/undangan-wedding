import { createHash } from "node:crypto";
import { getSupabaseConfig, supabaseRequest } from "../lib/supabase.js";

const PAGE_SIZE = 10;
const MAX_PAGE = 10000;
const MAX_BODY_BYTES = 4096;
const MAX_WISHES_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const ALLOWED_FIELDS = new Set(["name", "message", "website"]);
const INVALID_CONTROLS = /[\u0000-\u001f\u007f]/;
const INVALID_MESSAGE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const config = {
  api: {
    bodyParser: false
  }
};

const jsonResponse = (res, body, status = 200, headers = {}) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
  res.status(status).json(body);
};

const validateWishText = (value, label, maximumLength, disallowedControls) => {
  if (typeof value !== "string") {
    return { error: `${label} harus berupa teks.` };
  }

  const normalized = value.replace(/\r\n?/g, "\n").normalize("NFC").trim();

  if (!normalized) {
    return { error: `${label} tidak boleh kosong.` };
  }

  if (Array.from(normalized).length > maximumLength) {
    return { error: `${label} maksimal ${maximumLength} karakter.` };
  }

  if (disallowedControls.test(normalized)) {
    return { error: `${label} mengandung karakter yang tidak diperbolehkan.` };
  }

  return { value: normalized };
};

const readBoundedBody = async (request, maximumBytes) => {
  const chunks = [];
  let length = 0;
  let tooLarge = false;

  try {
    for await (const chunk of request) {
      if (tooLarge) {
        continue;
      }

      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      length += buffer.byteLength;
      if (length > maximumBytes) {
        tooLarge = true;
        chunks.length = 0;
        continue;
      }
      chunks.push(buffer);
    }
  } catch (error) {
    console.error("Gagal membaca kiriman ucapan.", error);
    return { readFailed: true };
  }

  if (tooLarge) {
    return { tooLarge: true };
  }

  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, length))
    };
  } catch {
    return { invalidEncoding: true };
  }
};

const getClientAddress = (request) => {
  const forwardedFor = request.headers["x-forwarded-for"];
  const address = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : typeof forwardedFor === "string"
      ? forwardedFor.split(",", 1)[0].trim()
      : request.headers["x-real-ip"];

  if (typeof address !== "string" || !address.trim() || address.length > 128) {
    throw new Error("Alamat klien tidak valid untuk pembatasan kiriman.");
  }

  return address.trim();
};

const hashRateLimitKey = (address) =>
  `wishes:${createHash("sha256").update(`wishes:${address}`).digest("hex")}`;

export default async function handler(request, response) {
  if (request.method === "GET") {
    const config = getSupabaseConfig();
    if (!config) {
      return jsonResponse(response, { error: "Layanan ucapan sedang belum tersedia." }, 503);
    }

    const requestedPage = new URL(request.url, "http://localhost").searchParams.get("page") ?? "1";
    if (!/^\d{1,5}$/.test(requestedPage)) {
      return jsonResponse(response, { error: "Nomor halaman ucapan tidak valid." }, 400);
    }

    const page = Number(requestedPage);
    if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
      return jsonResponse(response, { error: "Nomor halaman ucapan tidak valid." }, 400);
    }

    try {
      const query = new URLSearchParams({
        select: "id,name,message,created_at",
        hidden: "eq.false",
        order: "created_at.desc,id.desc",
        limit: String(PAGE_SIZE + 1),
        offset: String((page - 1) * PAGE_SIZE)
      });
      const result = await supabaseRequest(config, `wishes?${query}`);
      const rows = await result.json();
      if (!Array.isArray(rows)) {
        throw new Error("Supabase returned an invalid wishes result.");
      }

      return jsonResponse(response, {
        wishes: rows.slice(0, PAGE_SIZE),
        page,
        hasMore: rows.length > PAGE_SIZE
      });
    } catch (error) {
      console.error("Gagal mengambil daftar ucapan.", error);
      return jsonResponse(
        response,
        { error: "Daftar ucapan belum dapat dimuat. Silakan coba lagi." },
        500
      );
    }
  }

  if (request.method !== "POST") {
    return jsonResponse(
      response,
      { error: "Metode permintaan tidak didukung." },
      405,
      { Allow: "GET, POST" }
    );
  }

  const contentType = request.headers["content-type"]?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse(response, { error: "Kirim ucapan menggunakan format JSON." }, 415);
  }

  const contentLength = request.headers["content-length"];
  if (
    contentLength !== undefined &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
  ) {
    return jsonResponse(response, { error: "Ukuran kiriman melebihi batas." }, 413);
  }

  const bodyResult = await readBoundedBody(request, MAX_BODY_BYTES);
  if (bodyResult.tooLarge) {
    return jsonResponse(response, { error: "Ukuran kiriman melebihi batas." }, 413);
  }
  if (bodyResult.readFailed) {
    return jsonResponse(response, { error: "Isi kiriman tidak dapat dibaca." }, 400);
  }
  if (bodyResult.invalidEncoding) {
    return jsonResponse(response, { error: "Isi kiriman harus menggunakan UTF-8." }, 400);
  }

  let body;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return jsonResponse(response, { error: "Format kiriman tidak valid." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse(response, { error: "Format kiriman tidak valid." }, 400);
  }
  if (Object.hasOwn(body, "website") && typeof body.website !== "string") {
    return jsonResponse(response, { error: "Data ucapan tidak valid." }, 400);
  }
  if (body.website?.trim()) {
    return jsonResponse(response, { ok: true, message: "Terima kasih atas ucapan Anda." }, 201);
  }
  if (Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field))) {
    return jsonResponse(response, { error: "Data ucapan tidak valid." }, 400);
  }

  const nameResult = validateWishText(body.name, "Nama", 80, INVALID_CONTROLS);
  if (nameResult.error) {
    return jsonResponse(response, { error: nameResult.error }, 400);
  }
  const messageResult = validateWishText(body.message, "Ucapan", 300, INVALID_MESSAGE_CONTROLS);
  if (messageResult.error) {
    return jsonResponse(response, { error: messageResult.error }, 400);
  }

  const config = getSupabaseConfig();
  if (!config) {
    return jsonResponse(response, { error: "Layanan ucapan sedang belum tersedia." }, 503);
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    const rateLimitKey = hashRateLimitKey(getClientAddress(request));
    const rateLimitResult = await supabaseRequest(config, "rpc/consume_rate_limit", {
      method: "POST",
      body: {
        p_key: rateLimitKey,
        p_window_start: windowStart,
        p_now: now,
        p_limit: MAX_WISHES_PER_WINDOW,
        p_retention_ms: RATE_LIMIT_RETENTION_MS
      }
    });

    if ((await rateLimitResult.json()) !== true) {
      const retryAfter = Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
      return jsonResponse(
        response,
        { error: "Batas kiriman tercapai. Silakan coba lagi beberapa saat lagi." },
        429,
        { "Retry-After": String(retryAfter) }
      );
    }

    await supabaseRequest(config, "wishes", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: { name: nameResult.value, message: messageResult.value }
    });

    return jsonResponse(
      response,
      { ok: true, message: "Terima kasih, ucapan dan doa Anda berhasil dikirim." },
      201
    );
  } catch (error) {
    console.error("Gagal menyimpan ucapan.", error);
    return jsonResponse(
      response,
      { error: "Ucapan belum dapat disimpan. Silakan coba lagi." },
      500
    );
  }
}
