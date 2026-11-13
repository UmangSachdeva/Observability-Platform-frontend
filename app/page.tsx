import type { Metadata } from "next";
import AuthLayout from "../src/components/AuthLayout";
import { getAuthNotice } from "../src/lib/auth-notice";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage({ searchParams }: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  return <AuthLayout mode="signup" notice={getAuthNotice(await searchParams)} />;
}
