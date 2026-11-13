"use client";

import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { timeAgo, useProjectErrors } from "./useProjectErrors";
import { errorDetailHref } from "./ErrorDetailPage";

export default function DashboardOverview() {
  const { account, projects, selectedProject, loading } = useDashboardData();
  const { events, hasMore, loading: errorsLoading } = useProjectErrors(selectedProject?.id, 100);
  const recentErrors = events.slice(0, 5);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="page-eyebrow">WORKSPACE OVERVIEW</div>
          <h1>{account ? account.name : "Overview"}</h1>
          <p>{account ? "Your account and project activity at a glance." : "Account activity will appear here once it is available."}</p>
        </div>
        <Link className="date-button overview-create-button" href="/dashboard/settings/project"><DashboardIcon name="plus" size={15}/> Add project</Link>
      </div>

      <section className="metric-grid" aria-label="Account information">
        <Metric title="Projects" value={loading ? "—" : projects.length} icon="grid" />
        <Metric title="Account members" value={loading ? "—" : account?.members?.length ?? 0} icon="users" />
        <Metric title="Account created" value={account?.created_at ? new Date(account.created_at).toLocaleDateString() : "—"} icon="calendar" />
        <Metric title={selectedProject ? "Recent errors · " + selectedProject.name : "Recent errors"} value={!selectedProject ? "—" : errorsLoading ? "—" : hasMore ? "100+" : events.length} icon="alert" />
      </section>

      <section className="panel live-data-panel">
        <div className="panel-heading"><div><h2>Recent errors</h2><p>{selectedProject ? "Latest events reported to " + selectedProject.name + "." : "Select a project to see its errors."}</p></div>{recentErrors.length > 0 ? <Link className="subtle-button" href="/dashboard/errors">View all errors <DashboardIcon name="arrow" size={14}/></Link> : <span className="live-state"><i/> Waiting for data</span>}</div>
        {recentErrors.length ? <ul className="error-list overview-error-list">
          {recentErrors.map(event => <li key={event.id}><Link className="error-row" href={errorDetailHref(event)}>
            <span className={"error-level " + (event.level === "warning" ? "warning" : event.level === "fatal" ? "fatal" : "error")}>{event.level}</span>
            <span className="error-main"><b>{event.message}</b><small>{event.service}{event.environment ? " · " + event.environment : ""}</small></span>
            <span className="error-time">{timeAgo(event.timestamp)}</span>
          </Link></li>)}
        </ul> : <div className="empty-state">
          <span className="empty-icon"><DashboardIcon name="activity" size={22}/></span>
          <h3>{selectedProject && errorsLoading ? "Loading errors…" : "No errors yet"}</h3>
          <p>{selectedProject ? "Create an API key for " + selectedProject.name + " and send events from your service to see errors here." : "Create a project, then send events from your service to see errors here."}</p>
          <Link href={selectedProject ? "/dashboard/integrate" : "/dashboard/settings/project"}>{selectedProject ? "Open the setup guide" : "Create a project"} <DashboardIcon name="arrow" size={14}/></Link>
        </div>}
      </section>

      <section className="panel projects-preview">
        <div className="panel-heading"><div><h2>Projects</h2><p>Projects in this account</p></div><Link className="subtle-button" href="/dashboard/settings/project">Manage projects <DashboardIcon name="arrow" size={14}/></Link></div>
        {projects.length ? <div className="overview-project-list">{projects.slice(0, 5).map(project => <div className="overview-project-row" key={project.id}><span className="project-symbol">{project.name.slice(0,1).toUpperCase()}</span><div><b>{project.name}</b><small>{project.description || "No description"}</small></div><span className="project-created">{new Date(project.created_at).toLocaleDateString()}</span></div>)}</div> : <div className="projects-empty">{loading ? "Loading projects…" : "No projects in this account yet."}</div>}
      </section>
    </>
  );
}

function Metric({ title, value, icon }) {
  return <article className="metric-card"><div className="metric-top"><span>{title}</span><span className="metric-icon-box"><DashboardIcon name={icon} size={16}/></span></div><strong>{value}</strong></article>;
}
