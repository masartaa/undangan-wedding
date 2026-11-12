import {
  requireAdminSession,
  sendJson,
  sendMethodNotAllowed
} from "../../lib/admin-auth.js";

export default function handler(request, response) {
  if (request.method !== "GET") {
    return sendMethodNotAllowed(response, "GET");
  }

  const session = requireAdminSession(request, response);
  if (!session) {
    return;
  }

  return sendJson(response, { ok: true, username: session.sub });
}
