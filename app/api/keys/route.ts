import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE, ACCOUNT_ID_COOKIE } from "../../../src/lib/session";

// Lists the signed-in user's API keys. The API never returns secrets here.
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to see your API keys." } }, { status: 401 });
  }
  try {
    const upstream = await callUserApi("/v1/auth/keys", accessToken);
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid API keys response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}

// Creates client credentials for one project of the current account. Events signed with the
// key are stored under that project. The secret is returned once and never stored here.
export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const accountId = request.cookies.get(ACCOUNT_ID_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to create API keys." } }, { status: 401 });
  }
  if (!accountId) {
    return Response.json({ error: { code: "account_id_unavailable", message: "Join or select an account before creating API keys." } }, { status: 409 });
  }

  let payload: { client_name?: unknown; project_id?: unknown };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const projectId = typeof payload?.project_id === "string" ? payload.project_id.trim() : "";
  if (!projectId) {
    return Response.json({ error: { code: "validation_error", message: "Select a project for this API key." } }, { status: 400 });
  }

  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/projects/" + encodeURIComponent(projectId) + "/keys",
      accessToken,
      { method: "POST", payload: { client_name: typeof payload?.client_name === "string" ? payload.client_name.trim() : "" } },
    );
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid API key response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
