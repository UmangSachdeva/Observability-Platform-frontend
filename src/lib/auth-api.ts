export const API_BASE_URL = (process.env.OBSERVABILITY_API_URL || "http://localhost:8080").replace(/\/+$/, "");

export async function callAuthApi(endpoint: "signup" | "login", payload: unknown) {
  return fetch(API_BASE_URL + "/v1/auth/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}

export function apiUnavailableResponse() {
  return Response.json(
    { error: { code: "api_unavailable", message: "The authentication service is temporarily unavailable. Please try again." } },
    { status: 502 },
  );
}

export async function callUserApi(
  path: string,
  accessToken: string,
  options: { method?: "GET" | "POST" | "PATCH" | "DELETE"; payload?: unknown } = {},
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: "Bearer " + accessToken,
  };
  const hasBody = options.method === "POST" || options.method === "PATCH";
  if (hasBody) headers["Content-Type"] = "application/json";

  return fetch(API_BASE_URL + path, {
    method: options.method || "GET",
    headers,
    body: hasBody ? JSON.stringify(options.payload ?? {}) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
}
