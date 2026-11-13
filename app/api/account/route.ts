import type { NextRequest } from "next/server"
import { apiUnavailableResponse, callUserApi } from "../../../src/lib/auth-api";

export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("tracewell_access_token")?.value;
  const accountId = request.cookies.get("tracewell_account_id")?.value;

  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to load account information." } }, { status: 401 });
  }
  if (!accountId) {
    return Response.json({ error: { code: "account_id_unavailable", message: "You are not a member of any account yet. Open an invite link from an account admin to join one." } }, { status: 409 });
  }

  try {
    const upstream = await callUserApi("/v1/accounts/" + encodeURIComponent(accountId), accessToken);
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid account response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
