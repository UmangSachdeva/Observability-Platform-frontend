import { NextResponse } from "next/server";
import { apiUnavailableResponse, callAuthApi } from "../../../../src/lib/auth-api";
import { setSessionCookies } from "../../../../src/lib/session-cookie";

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
    const upstream = await callAuthApi("signup", payload);
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
      account: { id: data.id, account_id: data.account_id, username: data.username },
      expires_at: data.expires_at,
      refresh_expires_at: data.refresh_expires_at,
    }, { status: upstream.status });
    return setSessionCookies(
      response,
      data.access_token,
      accessExpiresAt,
      data.refresh_token,
      refreshExpiresAt,
      data.account_id,
    );
  } catch {
    return apiUnavailableResponse();
  }
}
