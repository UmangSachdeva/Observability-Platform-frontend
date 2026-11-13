import type { NextResponse } from "next/server";

export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  accessExpiresAt: Date,
  refreshToken: string,
  refreshExpiresAt: Date,
  accountId?: string,
) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  response.headers.set("Cache-Control", "no-store");
  response.cookies.set({ ...cookieOptions, name: "tracewell_access_token", value: accessToken, expires: accessExpiresAt });
  response.cookies.set({ ...cookieOptions, name: "tracewell_refresh_token", value: refreshToken, expires: refreshExpiresAt });
  if (accountId) {
    response.cookies.set({ ...cookieOptions, name: "tracewell_account_id", value: accountId, expires: refreshExpiresAt });
  }
  return response;
}
