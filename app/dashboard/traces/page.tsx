import type { Metadata } from "next";
import { Suspense } from "react";
import TracesPage from "../../../src/components/dashboard/TracesPage";

export const metadata: Metadata = { title: "Traces" };

export default function TracesRoute() {
  // TracesPage reads its initial search from the URL.
  return <Suspense fallback={<div className="projects-loading">Loading traces…</div>}><TracesPage /></Suspense>;
}
