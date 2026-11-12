import {
  getPublicEventConfig,
  readEventConfig,
  supabaseRequest
} from "../../lib/supabase.js";
import {
  parseJsonBody,
  requireAdminSession,
  requireAllowedOrigin,
  requireSupabaseConfig,
  sendJson,
  sendMethodNotAllowed
} from "../../lib/admin-auth.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "4kb" }
  }
};

const validateConfigInput = (body) => {
  const fields = ["date", "startTime", "endTime", "venueName", "venueAddress", "mapsUrl"];
  if (
    !body ||
    Object.keys(body).length !== fields.length ||
    Object.keys(body).some((field) => !fields.includes(field)) ||
    fields.some((field) => typeof body[field] !== "string")
  ) {
    return { error: "Data acara tidak lengkap atau tidak valid." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    return { error: "Tanggal acara tidak valid." };
  }
  const date = new Date(`${body.date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) {
    return { error: "Tanggal acara tidak valid." };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime)) {
    return { error: "Jam mulai tidak valid." };
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime)) {
    return { error: "Jam selesai tidak valid." };
  }

  const start = new Date(`${body.date}T${body.startTime}:00+07:00`);
  const end = new Date(`${body.date}T${body.endTime}:00+07:00`);
  if (end <= start) {
    return { error: "Jam selesai harus setelah jam mulai pada tanggal yang sama." };
  }

  const venueName = body.venueName.trim();
  const venueAddress = body.venueAddress.trim();
  if (!venueName || venueName.length > 120 || !venueAddress || venueAddress.length > 250) {
    return { error: "Nama tempat atau alamat tidak valid." };
  }

  let mapsUrl;
  try {
    const url = new URL(body.mapsUrl);
    if (url.protocol !== "https:" || url.username || url.password) {
      return { error: "Tautan Google Maps harus berupa URL HTTPS yang valid." };
    }
    mapsUrl = url.href;
  } catch {
    return { error: "Tautan Google Maps harus berupa URL HTTPS yang valid." };
  }
  if (mapsUrl.length > 2048) {
    return { error: "Tautan Google Maps terlalu panjang." };
  }

  return {
    value: {
      start: `${body.date}T${body.startTime}:00+07:00`,
      end: `${body.date}T${body.endTime}:00+07:00`,
      venueName,
      venueAddress,
      mapsUrl
    }
  };
};

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "PUT") {
    return sendMethodNotAllowed(response, "GET, PUT");
  }

  const session = requireAdminSession(request, response);
  if (!session) {
    return;
  }
  if (request.method === "PUT" && !requireAllowedOrigin(request, response)) {
    return;
  }

  const supabaseConfig = requireSupabaseConfig(response);
  if (!supabaseConfig) {
    return;
  }

  try {
    const currentConfig = await readEventConfig(supabaseConfig);
    if (!currentConfig.event || typeof currentConfig.event !== "object") {
      throw new Error("Event configuration is missing.");
    }

    if (request.method === "GET") {
      return sendJson(response, getPublicEventConfig(currentConfig));
    }

    const validation = validateConfigInput(parseJsonBody(request.body));
    if (validation.error) {
      return sendJson(response, { error: validation.error }, 400);
    }

    const updatedConfig = {
      ...currentConfig,
      event: {
        ...currentConfig.event,
        start: validation.value.start,
        end: validation.value.end,
        time_zone: "Asia/Jakarta",
        venue_name: validation.value.venueName,
        venue_address: validation.value.venueAddress,
        maps_url: validation.value.mapsUrl
      }
    };
    const query = new URLSearchParams({ id: "eq.1" });
    await supabaseRequest(supabaseConfig, `event_config?${query}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: { config_json: updatedConfig }
    });

    return sendJson(response, {
      ok: true,
      config: getPublicEventConfig(updatedConfig)
    });
  } catch (error) {
    console.error("Gagal memuat atau menyimpan konfigurasi acara.", error);
    return sendJson(response, { error: "Konfigurasi acara belum dapat disimpan." }, 500);
  }
}
