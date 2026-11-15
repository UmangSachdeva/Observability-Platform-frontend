import type { NextRequest } from "next/server";
import { proxyTraces } from "../../../../../src/lib/trace-api";

// Lists one project's traces (search, status and time filters, cursor pagination).
export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  return proxyTraces(request, projectId);
}
