import type { Metadata } from "next";
import AccountSettings from "../../../../src/components/dashboard/AccountSettings";

export const metadata: Metadata = { title: "Account settings" };

export default function AccountSettingsPage() {
  return <AccountSettings />;
}
