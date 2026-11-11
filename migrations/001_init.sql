CREATE TABLE IF NOT EXISTS event_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  config_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS rsvp (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('hadir', 'tidak')),
  guests INTEGER NOT NULL DEFAULT 1 CHECK (guests >= 1 AND guests <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  hidden SMALLINT NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rate_limit (
  key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (key, window_start)
);

INSERT INTO event_config (id, config_json)
VALUES (
  1,
  '{
    "date_time": "2027-01-03T09:00:00+07:00",
    "venue_name": "Koffie Goen Tuntang",
    "venue_address": "Koffie Goen Tuntang",
    "maps_url": "https://maps.app.goo.gl/E8JC392ENFyyGNjJA",
    "theme": "klasik",
    "texts": {
      "welcome": "Undangan segera hadir",
      "groom_name": "Nama Mempelai",
      "bride_name": "Nama Mempelai",
      "welcome_message": "Terima kasih atas doa dan restu Anda."
    },
    "photos": [],
    "music": null
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET config_json = EXCLUDED.config_json;
