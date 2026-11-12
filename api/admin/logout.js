import {
  clearSessionCookie,
  requireAdminSession,
  requireAllowedOrigin,
  sendJson,
  sendMethodNotAllowed
} from "../../lib/admin-auth.js";

export default function handler(request, response) {
  if (request.method !== "POST") {
    return sendMethodNotAllowed(response, "POST");
  }
  if (!requireAllowedOrigin(request, response)) {
    return;
  }

  response.setHeader("Set-Cookie", clearSessionCookie());
  const session = requireAdminSession(request, response);
  if (!session) {
    return;
  }

  return sendJson(response, { ok: true });
}
