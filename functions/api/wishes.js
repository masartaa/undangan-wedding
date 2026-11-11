const PAGE_SIZE = 10;
const MAX_PAGE = 10000;
const MAX_BODY_BYTES = 4096;
const MAX_WISHES_PER_WINDOW = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;
const ALLOWED_FIELDS = new Set(["name", "message", "website"]);
const INVALID_CONTROLS = /[\u0000-\u001f\u007f]/;
const INVALID_MESSAGE_CONTROLS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const jsonResponse = (body, status = 200, headers = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });

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

const hashRateLimitKey = async (clientAddress) => {
  const address = clientAddress?.trim() || "unknown";
  if (address.length > 128) {
    throw new Error("Alamat klien tidak valid untuk pembatasan kiriman.");
  }

  const input = new TextEncoder().encode(`wishes:${address}`);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  const key = Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `wishes:${key}`;
};

const readBoundedBody = async (request, maximumBytes) => {
  const reader = request.body?.getReader();
  if (!reader) {
    return { text: "" };
  }

  const chunks = [];
  let length = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      length += value.byteLength;
      if (length > maximumBytes) {
        await reader.cancel().catch((error) => console.error("Kiriman ucapan dihentikan.", error));
        return { tooLarge: true };
      }

      chunks.push(value);
    }
  } catch (error) {
    console.error("Gagal membaca kiriman ucapan.", error);
    return { readFailed: true };
  }

  const bodyBytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(bodyBytes) };
  } catch {
    return { invalidEncoding: true };
  }
};

export async function onRequestGet({ request, env }) {
  const database = env.DB;
  if (!database) {
    return jsonResponse({ error: "Layanan ucapan sedang belum tersedia." }, 503);
  }

  const requestedPage = new URL(request.url).searchParams.get("page") ?? "1";
  if (!/^\d{1,5}$/.test(requestedPage)) {
    return jsonResponse({ error: "Nomor halaman ucapan tidak valid." }, 400);
  }

  const page = Number(requestedPage);
  if (!Number.isSafeInteger(page) || page < 1 || page > MAX_PAGE) {
    return jsonResponse({ error: "Nomor halaman ucapan tidak valid." }, 400);
  }

  try {
    const result = await database
      .prepare(
        `SELECT id, name, message, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at
         FROM wishes
         WHERE hidden = 0
         ORDER BY wishes.created_at DESC, wishes.id DESC
         LIMIT ? OFFSET ?`
      )
      .bind(PAGE_SIZE + 1, (page - 1) * PAGE_SIZE)
      .all();

    const rows = result.results ?? [];
    if (!Array.isArray(rows)) {
      throw new Error("Database returned an invalid wishes result.");
    }

    return jsonResponse({
      wishes: rows.slice(0, PAGE_SIZE),
      page,
      hasMore: rows.length > PAGE_SIZE
    });
  } catch (error) {
    console.error("Gagal mengambil daftar ucapan.", error);
    return jsonResponse({ error: "Daftar ucapan belum dapat dimuat. Silakan coba lagi." }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse({ error: "Kirim ucapan menggunakan format JSON." }, 415);
  }

  const contentLength = request.headers.get("content-length");
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)
  ) {
    return jsonResponse({ error: "Ukuran kiriman melebihi batas." }, 413);
  }

  const bodyResult = await readBoundedBody(request, MAX_BODY_BYTES);
  if (bodyResult.tooLarge) {
    return jsonResponse({ error: "Ukuran kiriman melebihi batas." }, 413);
  }

  if (bodyResult.readFailed) {
    return jsonResponse({ error: "Isi kiriman tidak dapat dibaca." }, 400);
  }

  if (bodyResult.invalidEncoding) {
    return jsonResponse({ error: "Isi kiriman harus menggunakan UTF-8." }, 400);
  }

  let body;
  try {
    body = JSON.parse(bodyResult.text);
  } catch {
    return jsonResponse({ error: "Format kiriman tidak valid." }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Format kiriman tidak valid." }, 400);
  }

  if (Object.hasOwn(body, "website") && typeof body.website !== "string") {
    return jsonResponse({ error: "Data ucapan tidak valid." }, 400);
  }

  if (body.website?.trim()) {
    return jsonResponse({ ok: true, message: "Terima kasih atas ucapan Anda." }, 201);
  }

  if (Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field))) {
    return jsonResponse({ error: "Data ucapan tidak valid." }, 400);
  }

  const nameResult = validateWishText(body.name, "Nama", 80, INVALID_CONTROLS);
  if (nameResult.error) {
    return jsonResponse({ error: nameResult.error }, 400);
  }

  const messageResult = validateWishText(body.message, "Ucapan", 300, INVALID_MESSAGE_CONTROLS);
  if (messageResult.error) {
    return jsonResponse({ error: messageResult.error }, 400);
  }

  const database = env.DB;
  if (!database) {
    return jsonResponse({ error: "Layanan ucapan sedang belum tersedia." }, 503);
  }

  try {
    const now = Date.now();
    const windowStart = Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;
    const rateLimitKey = await hashRateLimitKey(request.headers.get("CF-Connecting-IP"));

    await database
      .prepare("DELETE FROM rate_limit WHERE window_start < ?")
      .bind(now - RATE_LIMIT_RETENTION_MS)
      .run();

    const count = await database
      .prepare(
        `INSERT INTO rate_limit (key, count, window_start)
         VALUES (?, 1, ?)
         ON CONFLICT(key, window_start)
         DO UPDATE SET count = rate_limit.count + 1
         WHERE rate_limit.count < ?
         RETURNING count`
      )
      .bind(rateLimitKey, windowStart, MAX_WISHES_PER_WINDOW)
      .first("count");

    if (count === null) {
      const retryAfter = Math.ceil((windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000);
      return jsonResponse(
        { error: "Batas kiriman tercapai. Silakan coba lagi beberapa saat lagi." },
        429,
        { "Retry-After": String(retryAfter) }
      );
    }

    await database
      .prepare("INSERT INTO wishes (name, message) VALUES (?, ?)")
      .bind(nameResult.value, messageResult.value)
      .run();

    return jsonResponse(
      { ok: true, message: "Terima kasih, ucapan dan doa Anda berhasil dikirim." },
      201
    );
  } catch (error) {
    console.error("Gagal menyimpan ucapan.", error);
    return jsonResponse({ error: "Ucapan belum dapat disimpan. Silakan coba lagi." }, 500);
  }
}
