import DashboardShell from "../../src/components/dashboard/DashboardShell";
import { DashboardDataProvider } from "../../src/components/dashboard/DashboardDataProvider";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DashboardDataProvider>
      <DashboardShell>{children}</DashboardShell>
    </DashboardDataProvider>
  );
}
