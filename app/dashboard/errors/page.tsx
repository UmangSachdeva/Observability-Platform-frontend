import type { Metadata } from "next";
import { Suspense } from "react";
import ErrorsPage from "../../../src/components/dashboard/ErrorsPage";

export const metadata: Metadata = { title: "Errors" };

export default function ErrorIssuesPage() {
  // ErrorsPage reads its initial search from the URL.
  return <Suspense fallback={<div className="projects-loading">Loading errors…</div>}><ErrorsPage /></Suspense>;
}
