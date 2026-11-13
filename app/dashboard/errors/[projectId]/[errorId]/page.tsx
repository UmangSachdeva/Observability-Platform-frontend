import type { Metadata } from "next";
import ErrorDetailPage from "../../../../../src/components/dashboard/ErrorDetailPage";

export const metadata: Metadata = { title: "Error details" };

export default async function ErrorDetailRoute({ params }: Readonly<{ params: Promise<{ projectId: string; errorId: string }> }>) {
  const { projectId, errorId } = await params;
  return <ErrorDetailPage projectId={projectId} errorId={errorId} />;
}
