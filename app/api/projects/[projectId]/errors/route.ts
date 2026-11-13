import type { NextRequest } from "next/server";
import { proxyErrorSearch } from "../../../../../src/lib/error-search";

// Searches one project's error events (filters, sorting, cursor pagination).
export async function GET(request: NextRequest, { params }: Readonly<{ params: Promise<{ projectId: string }> }>) {
  const { projectId } = await params;
  return proxyErrorSearch(request, projectId);
}
