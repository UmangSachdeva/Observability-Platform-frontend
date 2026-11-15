import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "./auth-api";
import { ACCESS_TOKEN_COOKIE, ACCOUNT_ID_COOKIE } from "./session";

const FORWARDED = new Set(["q", "service", "status", "from", "to", "limit", "cursor"]);

/**
 * Proxies the trace list of a project (with its search parameters), or one trace when
 * traceId is given. The Go API validates everything it receives.
 */
export async function proxyTraces(request: NextRequest, projectId: string, traceId?: string) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const accountId = request.cookies.get(ACCOUNT_ID_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to see traces." } }, { status: 401 });
  }
  if (!accountId) {
    return Response.json({ error: { code: "account_id_unavailable", message: "Join or select an account to see traces." } }, { status: 409 });
  }

  let path = "/v1/accounts/" + encodeURIComponent(accountId) + "/projects/" + encodeURIComponent(projectId) + "/traces";
  if (traceId) {
    path += "/" + encodeURIComponent(traceId);
  } else {
    const forwarded = new URLSearchParams();
    for (const [key, value] of request.nextUrl.searchParams) {
      if (FORWARDED.has(key)) forwarded.append(key, value);
    }
    if (forwarded.size) path += "?" + forwarded.toString();
  }
  try {
    const upstream = await callUserApi(path, accessToken);
    // A non-JSON 404 means this API build has no trace endpoints yet.
    const data = await upstream.json().catch(() => (upstream.status === 404
      ? { error: { code: "endpoint_missing", message: "This API doesn't support traces yet. Restart or update the Observability Platform API." } }
      : { error: { code: "invalid_response", message: "The API returned an invalid traces response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
