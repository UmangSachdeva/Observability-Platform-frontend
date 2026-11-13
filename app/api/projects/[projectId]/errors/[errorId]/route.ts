import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE, ACCOUNT_ID_COOKIE } from "../../../../../../src/lib/session";

// One error event of a project in the current account.
export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ projectId: string; errorId: string }> }>) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const accountId = request.cookies.get(ACCOUNT_ID_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to see this error." } }, { status: 401 });
  }
  if (!accountId) {
    return Response.json({ error: { code: "account_id_unavailable", message: "Join or select an account to see errors." } }, { status: 409 });
  }

  const { projectId, errorId } = await params;
  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/projects/" + encodeURIComponent(projectId) + "/errors/" + encodeURIComponent(errorId),
      accessToken,
    );
    // A non-JSON 404 means the API doesn't have this endpoint (for example, an older build
    // that predates it), which is different from the event not existing.
    const data = await upstream.json().catch(() => (upstream.status === 404
      ? { error: { code: "endpoint_missing", message: "The API doesn't support loading a single error yet. Restart or update the Observability Platform API." } }
      : { error: { code: "invalid_response", message: "The API returned an invalid error response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
