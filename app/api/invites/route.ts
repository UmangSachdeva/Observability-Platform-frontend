import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE } from "../../../src/lib/session";

// Pending invitations addressed to the signed-in user's email.
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to see your invitations." } }, { status: 401 });
  }

  const includeSnoozed = request.nextUrl.searchParams.get("include_snoozed") === "true";
  try {
    const upstream = await callUserApi("/v1/invites" + (includeSnoozed ? "?include_snoozed=true" : ""), accessToken);
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid invitations response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
