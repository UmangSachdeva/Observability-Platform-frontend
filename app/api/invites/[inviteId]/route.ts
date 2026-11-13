import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE } from "../../../../src/lib/session";

// Snoozes ({ snoozed_until: ISO time }) or un-snoozes ({ snoozed_until: null }) an invitation.
export async function PATCH(request: NextRequest, { params }: Readonly<{ params: Promise<{ inviteId: string }> }>) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to manage your invitations." } }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const { inviteId } = await params;
  try {
    const upstream = await callUserApi("/v1/invites/" + encodeURIComponent(inviteId), accessToken, { method: "PATCH", payload });
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid invitation response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
