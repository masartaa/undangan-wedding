export const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
};

export const supabaseRequest = async (config, path, options = {}) => {
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    method: options.method ?? "GET",
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    console.error("Permintaan Supabase gagal.", { status: response.status, path });
    throw new Error("Supabase request failed.");
  }

  return response;
};

export const readEventConfig = async (supabaseConfig) => {
  const query = new URLSearchParams({
    select: "config_json",
    id: "eq.1",
    limit: "1"
  });
  const response = await supabaseRequest(supabaseConfig, `event_config?${query}`);
  const rows = await response.json();

  if (
    !Array.isArray(rows) ||
    !rows[0]?.config_json ||
    typeof rows[0].config_json !== "object" ||
    Array.isArray(rows[0].config_json)
  ) {
    throw new Error("Supabase returned an invalid event configuration.");
  }

  return rows[0].config_json;
};

export const getPublicEventConfig = (config) => ({
  event: {
    start: config.event?.start,
    end: config.event?.end,
    time_zone: config.event?.time_zone,
    venue_name: config.event?.venue_name,
    venue_address: config.event?.venue_address,
    maps_url: config.event?.maps_url
  },
  couple: {
    groom: {
      name: config.couple?.groom?.name,
      parents: config.couple?.groom?.parents
    },
    bride: {
      name: config.couple?.bride?.name,
      parents: config.couple?.bride?.parents
    }
  },
  welcome_message: config.welcome_message,
  gallery: Array.isArray(config.gallery) ? config.gallery : [],
  music: config.music ?? null,
  seo: {
    title: config.seo?.title,
    description: config.seo?.description,
    url: config.seo?.url,
    image: config.seo?.image
  }
});
