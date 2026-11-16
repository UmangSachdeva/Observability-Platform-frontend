import type { NextRequest } from "next/server";
import { proxyTraces } from "../../../../../../src/lib/trace-api";

// One trace as waterfall rows, plus the error events linked to it.
export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ projectId: string; traceId: string }> }>) {
  const { projectId, traceId } = await params;
  return proxyTraces(request, projectId, traceId);
}
