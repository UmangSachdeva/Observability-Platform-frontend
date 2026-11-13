import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../../src/lib/auth-api";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("tracewell_access_token")?.value;
  const accountId = request.cookies.get("tracewell_account_id")?.value;

  if (!accessToken) {
    return Response.json(
      { error: { code: "unauthorized", message: "Please sign in to invite account members." } },
      { status: 401 },
    );
  }
  if (!accountId) {
    return Response.json(
      { error: { code: "account_id_unavailable", message: "Your account ID is not available for this login." } },
      { status: 409 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: { code: "invalid_json", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }

  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/invites",
      accessToken,
      { method: "POST", payload },
    );
    const data = await upstream.json().catch(() => ({
      error: { code: "invalid_response", message: "The API returned an invalid invitation response." },
    }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
