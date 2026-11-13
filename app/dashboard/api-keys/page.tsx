import type { Metadata } from "next";
import ApiKeysPage from "../../../src/components/dashboard/ApiKeysPage";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysRoute() {
  return <ApiKeysPage />;
}
