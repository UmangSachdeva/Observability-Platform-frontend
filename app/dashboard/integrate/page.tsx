import type { Metadata } from "next";
import IntegrationGuide from "../../../src/components/dashboard/IntegrationGuide";
import { API_BASE_URL } from "../../../src/lib/auth-api";

export const metadata: Metadata = { title: "Integrate" };

export default function IntegratePage() {
  // The URL services send events to. Set OBSERVABILITY_INGEST_URL when the API is reachable
  // from your services at a different address than the one this frontend uses internally.
  const endpoint = (process.env.OBSERVABILITY_INGEST_URL || API_BASE_URL).replace(/\/+$/, "");
  return <IntegrationGuide endpoint={endpoint} />;
}
