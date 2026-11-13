import { NextResponse, type NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../../src/lib/auth-api";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("tracewell_access_token")?.value;
  if (!accessToken) {
    return Response.json(
      { error: { code: "unauthorized", message: "Sign in with the email address that received this invitation." } },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  try {
    const upstream = await callUserApi("/v1/invites/accept", accessToken, { method: "POST", payload });
    const data = await upstream.json().catch(() => null);
    const response = NextResponse.json(
      data || { error: { code: "invalid_response", message: "The API returned an invalid invitation response." } },
      { status: upstream.status },
    );
    response.headers.set("Cache-Control", "no-store");

    if (upstream.ok && typeof data?.account_id === "string" && data.account_id) {
      response.cookies.set({
        name: "tracewell_account_id",
        value: data.account_id,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
