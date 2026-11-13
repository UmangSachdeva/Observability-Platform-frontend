import type { Metadata } from "next";
import AuthLayout from "../../src/components/AuthLayout";
import { getAuthNotice } from "../../src/lib/auth-notice";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Tracewell observability workspace.",
};

export default async function LoginPage({ searchParams }: Readonly<{ searchParams: Promise<Record<string, string | string[] | undefined>> }>) {
  return <AuthLayout mode="login" notice={getAuthNotice(await searchParams)} />;
}
