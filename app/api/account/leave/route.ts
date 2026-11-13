import { NextResponse, type NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE, ACCOUNT_ID_COOKIE, clearAccountCookie } from "../../../../src/lib/session";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const accountId = request.cookies.get(ACCOUNT_ID_COOKIE)?.value;

  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to leave this account." } }, { status: 401 });
  }
  if (!accountId) {
    return Response.json({ error: { code: "account_id_unavailable", message: "No account is selected for this session." } }, { status: 409 });
  }

  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/members/me",
      accessToken,
      { method: "DELETE" },
    );
    const data = await upstream.json().catch(() => null);
    const response = NextResponse.json(
      data || { error: { code: "invalid_response", message: "The API returned an invalid response." } },
      { status: upstream.status },
    );
    response.headers.set("Cache-Control", "no-store");
    // The session no longer has access to this account, so stop scoping requests to it.
    if (upstream.ok) clearAccountCookie(response);
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
