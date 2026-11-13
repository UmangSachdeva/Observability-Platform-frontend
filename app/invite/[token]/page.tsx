import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import InviteAcceptance from "../../../src/components/InviteAcceptance";
import { ACCESS_TOKEN_COOKIE, readAccessTokenUser } from "../../../src/lib/session";

export const metadata: Metadata = { title: "Account invitation" };

export default async function InvitePage({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  const cookieStore = await cookies();

  // Signed-in users review the invitation in a popup on the dashboard, where they choose to
  // accept or decline it. Everyone else is asked to sign in (or sign up) first.
  if (readAccessTokenUser(cookieStore.get(ACCESS_TOKEN_COOKIE)?.value)) {
    redirect("/dashboard?invite=" + encodeURIComponent(token));
  }

  return <InviteAcceptance token={token} />;
}
