import type { NextRequest } from "next/server";
import { apiUnavailableResponse, callUserApi } from "./auth-api";
import { ACCESS_TOKEN_COOKIE, ACCOUNT_ID_COOKIE } from "./session";

const FORWARDED = new Set(["q", "service", "environment", "level", "project_id", "from", "to", "sort", "limit", "cursor"]);

/** Forwards the supported search parameters (and attr.<key> filters); the Go API validates them. */
function searchQuery(request: NextRequest) {
  const forwarded = new URLSearchParams();
  for (const [key, value] of request.nextUrl.searchParams) {
    if (FORWARDED.has(key) || key.startsWith("attr.")) forwarded.append(key, value);
  }
  const query = forwarded.toString();
  return query ? "?" + query : "";
}

/** Proxies an error search, either for one project or across the current account. */
export async function proxyErrorSearch(request: NextRequest, projectId?: string) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const accountId = request.cookies.get(ACCOUNT_ID_COOKIE)?.value;
  if (!accessToken) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to see errors." } }, { status: 401 });
  }
  if (!accountId) {
    return Response.json({ error: { code: "account_id_unavailable", message: "Join or select an account to see errors." } }, { status: 409 });
  }

  const base = "/v1/accounts/" + encodeURIComponent(accountId)
    + (projectId ? "/projects/" + encodeURIComponent(projectId) : "") + "/errors";
  try {
    const upstream = await callUserApi(base + searchQuery(request), accessToken);
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid errors response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
