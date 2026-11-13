import type { Metadata } from "next";
import ProjectSettings from "../../../../src/components/dashboard/ProjectSettings";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectSettingsPage() {
  return <ProjectSettings />;
}
