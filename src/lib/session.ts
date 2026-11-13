import type { NextResponse } from "next/server";

export const ACCESS_TOKEN_COOKIE = "tracewell_access_token";
export const ACCOUNT_ID_COOKIE = "tracewell_account_id";
export const REFRESH_TOKEN_COOKIE = "tracewell_refresh_token";
export const SESSION_COOKIES = [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, ACCOUNT_ID_COOKIE];

/** Expiry (ms since epoch) from a JWT's `exp` claim, without verifying it; 0 if unreadable. */
export function tokenExpiresAt(token: string | undefined): number {
  const payload = token?.split(".")[1];
  if (!payload) return 0;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof claims?.exp === "number" ? claims.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export type SessionUser = { id: string; username: string; email: string };

/**
 * Reads the identity claims from the API-issued access token so the UI can show who is
 * signed in. This does NOT verify the signature: the token never leaves the HttpOnly
 * cookie, and every authorization decision is still made by the Go API.
 */
export function readAccessTokenUser(accessToken: string | undefined): SessionUser | null {
  if (!accessToken) return null;
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (typeof claims?.sub !== "string" || !claims.sub) return null;
    if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) return null;
    return {
      id: claims.sub,
      username: typeof claims.username === "string" ? claims.username : "",
      email: typeof claims.email === "string" ? claims.email : "",
    };
  } catch {
    return null;
  }
}

export function clearAccountCookie(response: NextResponse) {
  response.cookies.set({
    name: ACCOUNT_ID_COOKIE,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
