import { NextResponse } from "next/server";
import { apiUnavailableResponse, callAuthApi } from "../../../../src/lib/auth-api";
import { setSessionCookies } from "../../../../src/lib/session-cookie";
import { clearAccountCookie } from "../../../../src/lib/session";

export async function POST(request: Request) {
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
    const upstream = await callAuthApi("login", payload);
    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return Response.json(
        data || { error: { code: "invalid_response", message: "The authentication service returned an invalid response." } },
        { status: upstream.status },
      );
    }

    const accessExpiresAt = new Date(data?.expires_at);
    const refreshExpiresAt = new Date(data?.refresh_expires_at);
    if (
      typeof data?.access_token !== "string" ||
      typeof data?.refresh_token !== "string" ||
      Number.isNaN(accessExpiresAt.getTime()) ||
      Number.isNaN(refreshExpiresAt.getTime()) ||
      accessExpiresAt.getTime() <= Date.now() ||
      refreshExpiresAt.getTime() <= accessExpiresAt.getTime()
    ) {
      return Response.json(
        { error: { code: "invalid_response", message: "The authentication service returned an invalid token pair." } },
        { status: 502 },
      );
    }

    const response = NextResponse.json({
      expires_at: data.expires_at,
      refresh_expires_at: data.refresh_expires_at,
    });
    // A user who has left every account logs in without an account_id. Never fall back to
    // an account cookie from a previous session: it may belong to an account they left.
    const accountId = typeof data.account_id === "string" && data.account_id ? data.account_id : undefined;

    setSessionCookies(
      response,
      data.access_token,
      accessExpiresAt,
      data.refresh_token,
      refreshExpiresAt,
      accountId,
    );
    return accountId ? response : clearAccountCookie(response);
  } catch {
    return apiUnavailableResponse();
  }
}
