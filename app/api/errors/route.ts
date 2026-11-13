import type { NextRequest } from "next/server";
import { proxyErrorSearch } from "../../../src/lib/error-search";

// Searches error events across every project in the current account.
export async function GET(request: NextRequest) {
  return proxyErrorSearch(request);
}
