import { redirect } from "next/navigation";

// Members are managed in Account settings; keep old links working.
export default function AccountMembersPage() {
  redirect("/dashboard/settings/account#members");
}
