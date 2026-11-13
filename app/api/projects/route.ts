import type { NextRequest } from "next/server"
import { apiUnavailableResponse, callUserApi } from "../../../src/lib/auth-api";

function getSession(request: NextRequest) {
  return {
    accessToken: request.cookies.get("tracewell_access_token")?.value,
    accountId: request.cookies.get("tracewell_account_id")?.value,
  };
}

function sessionError(code: string, message: string, status: number) {
  return Response.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  const { accessToken, accountId } = getSession(request);
  if (!accessToken) return sessionError("unauthorized", "Please sign in to load projects.", 401);
  if (!accountId) return sessionError("account_id_unavailable", "Your account ID is not available for this session. Please sign in again.", 409);

  const limit = request.nextUrl.searchParams.get("limit") || "100";
  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/projects?limit=" + encodeURIComponent(limit),
      accessToken,
    );
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid projects response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}

export async function POST(request: NextRequest) {
  const { accessToken, accountId } = getSession(request);
  if (!accessToken) return sessionError("unauthorized", "Please sign in to create a project.", 401);
  if (!accountId) return sessionError("account_id_unavailable", "Your account ID is not available for this session. Please sign in again.", 409);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return sessionError("invalid_json", "Request body must be valid JSON.", 400);
  }

  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/projects",
      accessToken,
      { method: "POST", payload },
    );
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid project response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
