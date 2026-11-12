import { getPublicEventConfig, getSupabaseConfig, readEventConfig } from "../lib/supabase.js";
import { sendJson, sendMethodNotAllowed } from "../lib/admin-auth.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return sendMethodNotAllowed(response, "GET");
  }

  const supabaseConfig = getSupabaseConfig();
  if (!supabaseConfig) {
    return sendJson(response, { error: "Konfigurasi undangan belum tersedia." }, 503);
  }

  try {
    const config = await readEventConfig(supabaseConfig);
    return sendJson(response, getPublicEventConfig(config));
  } catch (error) {
    console.error("Gagal mengambil konfigurasi undangan.", error);
    return sendJson(
      response,
      { error: "Informasi undangan belum dapat dimuat. Silakan coba lagi." },
      500
    );
  }
}
