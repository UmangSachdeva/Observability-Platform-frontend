import { NextResponse, type NextRequest } from "next/server";
import { refreshSession } from "./src/lib/refresh-session";
import { setSessionCookies } from "./src/lib/session-cookie";
import {
  ACCESS_TOKEN_COOKIE,
  ACCOUNT_ID_COOKIE,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIES,
  tokenExpiresAt,
} from "./src/lib/session";

// Renew a little before expiry so a request never reaches the API with a token that
// expires mid-flight.
const REFRESH_MARGIN_MS = 60_000;

/**
 * Keeps sessions alive. Before a dashboard page, invite page, or API route runs, an expired or
 * nearly expired access token is exchanged for a new pair using the refresh token. The new
 * tokens are written to the browser and also passed to this request, so the page or route
 * handler already sees them. If the refresh token is no longer valid, the session is cleared
 * and dashboard pages redirect to sign-in.
 */
export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const accessExpiresAt = tokenExpiresAt(accessToken);
  if (accessExpiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const isPage = request.nextUrl.pathname.startsWith("/dashboard");

  if (!refreshToken || tokenExpiresAt(refreshToken) <= Date.now()) {
    // Nothing to renew with. While the access token still works, carry on; once it has
    // expired the session is over: pages go to sign-in, API routes answer 401 themselves.
    if (accessExpiresAt > Date.now()) return NextResponse.next();
    return endSession(request, isPage);
  }

  const refreshed = await refreshSession(refreshToken);

  if (refreshed === "unavailable") {
    // Don't sign the user out because the API had a hiccup; the next request retries.
    return NextResponse.next();
  }

  if (refreshed === "invalid") return endSession(request, isPage);

  // Keep the account the user is working in (it may differ from the API's default after
  // accepting an invite); only fall back to the API's choice when none is set.
  const accountId = request.cookies.get(ACCOUNT_ID_COOKIE)?.value || refreshed.accountId;

  request.cookies.set(ACCESS_TOKEN_COOKIE, refreshed.accessToken);
  request.cookies.set(REFRESH_TOKEN_COOKIE, refreshed.refreshToken);
  if (accountId) request.cookies.set(ACCOUNT_ID_COOKIE, accountId);
  const response = NextResponse.next({ request: { headers: request.headers } });
  return setSessionCookies(
    response,
    refreshed.accessToken,
    refreshed.accessExpiresAt,
    refreshed.refreshToken,
    refreshed.refreshExpiresAt,
    accountId,
  );
}

/** Clears the session cookies; dashboard pages are sent to sign-in. */
function endSession(request: NextRequest, isPage: boolean) {
  const present = SESSION_COOKIES.filter(name => request.cookies.has(name));
  // API routes still run, but without the dead tokens, so they answer 401 themselves.
  for (const name of present) request.cookies.delete(name);
  const response = isPage
    ? redirectToSignIn(request, present.length > 0)
    : NextResponse.next({ request: { headers: request.headers } });
  for (const name of present) response.cookies.delete(name);
  return response;
}

function redirectToSignIn(request: NextRequest, expired: boolean) {
  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", next);
  // Only say "expired" to someone who had a session; first-time visitors just see sign-in.
  if (expired) url.searchParams.set("notice", "session-expired");
  return NextResponse.redirect(url);
}

export const config = {
  // Sign-in, sign-up and sign-out manage the session themselves; static assets need none.
  matcher: ["/dashboard/:path*", "/invite/:path*", "/api/((?!auth/).*)"],
};
