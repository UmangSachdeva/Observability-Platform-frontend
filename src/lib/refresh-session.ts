import { API_BASE_URL } from "./auth-api";

export type RefreshedSession = {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: Date;
  refreshExpiresAt: Date;
  accountId?: string;
};

/**
 * Exchanges a refresh token for a new token pair (POST /v1/auth/refresh).
 * Returns the new session, "invalid" when the API rejects the refresh token (the user must
 * sign in again), or "unavailable" when the API could not be reached or answered unexpectedly
 * (keep the current session and try again on a later request).
 */
export async function refreshSession(refreshToken: string): Promise<RefreshedSession | "invalid" | "unavailable"> {
  let upstream: Response;
  try {
    upstream = await fetch(API_BASE_URL + "/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    return "unavailable";
  }
  if (upstream.status === 400 || upstream.status === 401) return "invalid";
  if (!upstream.ok) return "unavailable";

  const data = await upstream.json().catch(() => null);
  const accessExpiresAt = new Date(data?.expires_at);
  const refreshExpiresAt = new Date(data?.refresh_expires_at);
  if (
    typeof data?.access_token !== "string" ||
    typeof data?.refresh_token !== "string" ||
    Number.isNaN(accessExpiresAt.getTime()) ||
    Number.isNaN(refreshExpiresAt.getTime()) ||
    accessExpiresAt.getTime() <= Date.now()
  ) {
    return "unavailable";
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessExpiresAt,
    refreshExpiresAt,
    accountId: typeof data.account_id === "string" && data.account_id ? data.account_id : undefined,
  };
}
