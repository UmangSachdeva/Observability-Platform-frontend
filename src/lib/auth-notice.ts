type SearchParams = Record<string, string | string[] | undefined>;

/** Contextual message shown above the sign-in / sign-up form, derived from the URL. */
export function getAuthNotice(params: SearchParams): string {
  const notice = typeof params.notice === "string" ? params.notice : "";
  const next = typeof params.next === "string" ? params.next : "";
  if (notice === "left-account") {
    return "You left the account and were signed out. Sign in again to continue to another account you belong to.";
  }
  if (notice === "session-expired") {
    return "Your session has expired. Sign in again to continue where you left off.";
  }
  if (next.startsWith("/invite/")) {
    return "Use the email address that received the invitation. You can accept or decline it next.";
  }
  return "";
}
