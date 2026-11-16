import type { Metadata } from "next";
import TraceDetailPage from "../../../../../src/components/dashboard/TraceDetailPage";

export const metadata: Metadata = { title: "Trace" };

export default async function TraceDetailRoute({ params }: Readonly<{ params: Promise<{ projectId: string; traceId: string }> }>) {
  const { projectId, traceId } = await params;
  return <TraceDetailPage projectId={projectId} traceId={traceId} />;
}
