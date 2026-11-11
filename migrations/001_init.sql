CREATE TABLE IF NOT EXISTS event_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_json TEXT NOT NULL CHECK (json_valid(config_json))
);

CREATE TABLE IF NOT EXISTS wishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 300),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS wishes_public_order
ON wishes (hidden, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rate_limit (
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  window_start INTEGER NOT NULL,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_window_cleanup
ON rate_limit (window_start);

INSERT INTO event_config (id, config_json)
VALUES (
  1,
  '{
    "event": {
      "start": "2027-01-03T09:00:00+07:00",
      "end": "2027-01-03T14:00:00+07:00",
      "time_zone": "Asia/Jakarta",
      "venue_name": "Koffie Goen Tuntang",
      "venue_address": "Koffie Goen Tuntang",
      "maps_url": "https://maps.app.goo.gl/E8JC392ENFyyGNjJA"
    },
    "couple": {
      "groom": {
        "name": "Nama Mempelai Pria",
        "parents": "Bapak dan Ibu Nama Orang Tua"
      },
      "bride": {
        "name": "Nama Mempelai Wanita",
        "parents": "Bapak dan Ibu Nama Orang Tua"
      }
    },
    "welcome_message": "Dengan penuh rasa syukur, kami mengundang Anda untuk hadir di hari bahagia kami.",
    "gallery": [],
    "music": null,
    "seo": {
      "title": "Undangan Pernikahan",
      "description": "Dengan penuh sukacita, kami mengundang Anda untuk hadir di resepsi pernikahan kami.",
      "url": "https://undangan-wedding.pages.dev/",
      "image": "https://undangan-wedding.pages.dev/images/og-image.png"
    }
  }'
)
ON CONFLICT (id) DO NOTHING;
