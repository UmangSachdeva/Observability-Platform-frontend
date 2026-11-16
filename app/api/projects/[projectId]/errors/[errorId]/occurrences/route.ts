import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "../../../../../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE, ACCOUNT_ID_COOKIE } from "../../../../../../../src/lib/session";

// When one error happened: its occurrences, newest first (limit and cursor are forwarded).
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
  const forwarded = new URLSearchParams();
  for (const name of ["limit", "cursor"]) {
    const value = request.nextUrl.searchParams.get(name);
    if (value) forwarded.set(name, value);
  }
  const query = forwarded.size ? "?" + forwarded.toString() : "";
  try {
    const upstream = await callUserApi(
      "/v1/accounts/" + encodeURIComponent(accountId) + "/projects/" + encodeURIComponent(projectId)
        + "/errors/" + encodeURIComponent(errorId) + "/occurrences" + query,
      accessToken,
    );
    const data = await upstream.json().catch(() => (upstream.status === 404
      ? { error: { code: "endpoint_missing", message: "This API doesn't support occurrences yet. Restart or update the Observability Platform API." } }
      : { error: { code: "invalid_response", message: "The API returned an invalid occurrences response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
