import type { Metadata } from "next";
import DashboardIcon from "../../../src/components/dashboard/DashboardIcon";

export const metadata: Metadata = { title: "Traces" };

export default function TracesPage() {
  return (
    <>
      <div className="page-heading"><div><div className="page-eyebrow">OBSERVABILITY</div><h1>Traces</h1><p>Follow requests across services from a single trace view.</p></div></div>
      <section className="panel telemetry-empty-page">
        <span className="empty-icon"><DashboardIcon name="activity" size={22}/></span>
        <h2>Trace search isn’t available yet</h2>
        <p>The current Observability Platform API does not expose a trace query endpoint. Once one is available, traces will appear here.</p>
      </section>
    </>
  );
}
