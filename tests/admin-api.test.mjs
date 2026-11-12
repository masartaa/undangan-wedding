import assert from "node:assert/strict";
import { pbkdf2Sync } from "node:crypto";
import test from "node:test";
import login from "../api/admin/login.js";
import adminConfig from "../api/admin/config.js";
import session from "../api/admin/session.js";
import publicConfig from "../api/config.js";

const invoke = async (handler, request) => {
  const response = { headers: {}, statusCode: 200 };
  response.setHeader = function (name, value) {
    this.headers[name.toLowerCase()] = value;
  };
  response.status = function (code) {
    this.statusCode = code;
    return this;
  };
  response.json = function (body) {
    this.body = body;
    return this;
  };
  await handler(request, response);
  return response;
};

test("admin login, session, and event configuration are protected and validated", async () => {
  const previousEnvironment = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SESSION_SECRET: process.env.SESSION_SECRET,
    APP_ORIGIN: process.env.APP_ORIGIN,
    VERCEL_URL: process.env.VERCEL_URL
  };
  const originalFetch = globalThis.fetch;
  const username = "adminuser";
  const password = "A-strong-password-123";
  const salt = Buffer.alloc(16, 7);
  const passwordHash = pbkdf2Sync(password, salt, 600000, 32, "sha256").toString("base64");
  let eventConfig = {
    event: {
      start: "2027-01-03T09:00:00+07:00",
      end: "2027-01-03T14:00:00+07:00",
      time_zone: "Asia/Jakarta",
      venue_name: "Koffie Goen Tuntang",
      venue_address: "Koffie Goen Tuntang",
      maps_url: "https://maps.app.goo.gl/E8JC392ENFyyGNjJA"
    },
    couple: {
      groom: { name: "Groom", parents: "Parents" },
      bride: { name: "Bride", parents: "Parents" }
    },
    welcome_message: "Welcome",
    gallery: [],
    music: null,
    seo: {
      title: "Title",
      description: "Description",
      url: "https://example.com/",
      image: "https://example.com/image.png"
    },
    internal_secret: "must-not-be-returned"
  };
  let patchCount = 0;
  let loginFailureCount = 0;

  Object.assign(process.env, {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "test-secret-key",
    SESSION_SECRET: "0123456789abcdef0123456789abcdef",
    APP_ORIGIN: "http://localhost:3000"
  });
  delete process.env.VERCEL_URL;
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input);
    if (url.pathname.endsWith("/rpc/consume_rate_limit")) {
      loginFailureCount += 1;
      return new Response(String(loginFailureCount <= 5));
    }
    if (url.pathname.endsWith("/rate_limit")) {
      return new Response(JSON.stringify([{ count: loginFailureCount }]));
    }
    if (url.pathname.endsWith("/admin")) {
      return new Response(
        JSON.stringify([
          { username, password_hash: passwordHash, salt: salt.toString("base64") }
        ])
      );
    }
    if (url.pathname.endsWith("/event_config") && options.method === "PATCH") {
      eventConfig = JSON.parse(options.body).config_json;
      patchCount += 1;
      return new Response(null, { status: 204 });
    }
    if (url.pathname.endsWith("/event_config")) {
      return new Response(JSON.stringify([{ config_json: eventConfig }]));
    }
    throw new Error(`Unexpected Supabase request: ${url}`);
  };

  try {
    const unauthenticated = await invoke(adminConfig, { method: "GET", headers: {} });
    assert.equal(unauthenticated.statusCode, 401);

    const crossOrigin = await invoke(login, {
      method: "POST",
      headers: { origin: "https://attacker.example" },
      body: { username, password }
    });
    assert.equal(crossOrigin.statusCode, 403);

    const wrongPassword = await invoke(login, {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.10" },
      body: { username, password: "A-different-password-123" }
    });
    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(loginFailureCount, 1);

    const loggedIn = await invoke(login, {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.10" },
      body: { username, password }
    });
    assert.equal(loggedIn.statusCode, 200);
    assert.equal(loginFailureCount, 1);
    assert.match(loggedIn.headers["set-cookie"], /HttpOnly; Secure; SameSite=Strict/);
    const cookie = loggedIn.headers["set-cookie"].split(";", 1)[0];

    const sessionResponse = await invoke(session, { method: "GET", headers: { cookie } });
    assert.equal(sessionResponse.statusCode, 200);
    assert.equal(sessionResponse.body.username, username);

    loginFailureCount = 5;
    const lockedOut = await invoke(login, {
      method: "POST",
      headers: { origin: "http://localhost:3000", "x-forwarded-for": "203.0.113.10" },
      body: { username, password }
    });
    assert.equal(lockedOut.statusCode, 429);

    const publicResponse = await invoke(publicConfig, { method: "GET", headers: {} });
    assert.equal(publicResponse.statusCode, 200);
    assert.equal("internal_secret" in publicResponse.body, false);

    const saved = await invoke(adminConfig, {
      method: "PUT",
      headers: {
        origin: "http://localhost:3000",
        "x-forwarded-for": "203.0.113.10",
        cookie
      },
      body: {
        date: "2027-02-04",
        startTime: "10:00",
        endTime: "14:00",
        venueName: "Venue Baru",
        venueAddress: "Alamat Baru",
        mapsUrl: "https://maps.app.goo.gl/abc"
      }
    });
    assert.equal(saved.statusCode, 200);
    assert.equal(saved.body.config.event.start, "2027-02-04T10:00:00+07:00");
    assert.equal(patchCount, 1);

    const invalidDate = await invoke(adminConfig, {
      method: "PUT",
      headers: {
        origin: "http://localhost:3000",
        "x-forwarded-for": "203.0.113.10",
        cookie
      },
      body: {
        date: "2027-02-30",
        startTime: "10:00",
        endTime: "14:00",
        venueName: "Venue",
        venueAddress: "Alamat",
        mapsUrl: "https://maps.app.goo.gl/abc"
      }
    });
    assert.equal(invalidDate.statusCode, 400);
    assert.equal(patchCount, 1);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of Object.entries(previousEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});
