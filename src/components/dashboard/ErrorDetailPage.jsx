"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { CopyButton } from "./apiKeys";
import { timeAgo } from "./useProjectErrors";
import { parseStackTrace } from "../../lib/stack-trace";

const OCCURRENCE_LIMIT = 500;
// Attributes that usually carry the most useful context are listed first.
const PRIORITY_ATTRIBUTES = ["request_id", "trace_id", "user_id", "url", "path", "route", "method", "status", "status_code", "release", "version", "host", "hostname", "region"];

export function errorDetailHref(event) {
  return "/dashboard/errors/" + encodeURIComponent(event.project_id) + "/" + encodeURIComponent(event.id);
}

export default function ErrorDetailPage({ projectId, errorId }) {
  const { projects, selectedProjectId, selectProject } = useDashboardData();
  const [result, setResult] = useState({ key: "", event: null, error: "", code: "" });
  const key = projectId + "/" + errorId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/errors/" + encodeURIComponent(errorId), { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) setResult({ key, event: null, error: data?.error?.message || "Could not load this error.", code: data?.error?.code || "" });
        else setResult({ key, event: data, error: "", code: "" });
      } catch {
        if (!cancelled) setResult({ key, event: null, error: "Could not connect to the Observability Platform API.", code: "" });
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, errorId, key]);

  const project = projects.find(item => item.id === projectId);
  const loading = result.key !== key;
  const event = loading ? null : result.event;

  return (
    <div className="error-detail-page">
      <nav className="error-detail-breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard/errors"><DashboardIcon name="alert" size={13}/> Errors</Link>
        <DashboardIcon name="chevron" size={12}/>
        <span>{project?.name || "Project"}</span>
        <DashboardIcon name="chevron" size={12}/>
        <span className="error-detail-crumb-id">{errorId}</span>
      </nav>

      {loading ? <section className="panel"><div className="projects-empty">Loading error…</div></section>
        : !event ? (
          <section className="panel telemetry-empty-page">
            <span className="empty-icon"><DashboardIcon name="alert" size={22}/></span>
            <h2>{result.code === "error_not_found" ? "Error not found" : "Couldn’t load this error"}</h2>
            <p>{result.code === "error_not_found" ? "This event doesn’t exist in this project, or it belongs to another account. If someone shared this link, make sure you’re in the same account." : result.error}</p>
            <Link href="/dashboard/errors">Back to errors <DashboardIcon name="arrow" size={14}/></Link>
          </section>
        ) : <>
          {project && project.id !== selectedProjectId && <div className="api-banner" role="note"><span>This error belongs to <b>{project.name}</b>, which isn’t your selected project.</span><button type="button" onClick={() => selectProject(project.id)}>Switch to {project.name}</button></div>}
          <ErrorHeader event={event} projectName={project?.name} />
          <div className="error-detail-grid">
            <div className="error-detail-main">
              <StackTraceSection key={event.id} event={event} />
              <AttributesSection event={event} />
              <RawEventSection event={event} />
            </div>
            <aside className="error-detail-side">
              <DetailsSection event={event} projectName={project?.name} />
              <OccurrencesSection event={event} />
            </aside>
          </div>
        </>}
    </div>
  );
}

function ErrorHeader({ event, projectName }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { const timer = setTimeout(() => setOrigin(window.location.origin), 0); return () => clearTimeout(timer); }, []);
  const similarHref = "/dashboard/errors?" + new URLSearchParams({ q: event.message.slice(0, 200), service: event.service }).toString();
  const exceptionType = parseStackTrace(event.stack_trace).headers.find(line => /^[\w.$]+(Error|Exception|Panic)\b|^panic:/.test(line))?.split(":")[0];

  return (
    <header className="panel error-detail-header">
      <div className="error-detail-tags">
        <span className={"error-level " + levelClass(event.level)}>{event.level}</span>
        {exceptionType && <span className="error-detail-chip mono">{exceptionType}</span>}
        <span className="error-detail-chip"><DashboardIcon name="grid" size={11}/>{event.service}</span>
        {event.environment && <span className="error-detail-chip"><DashboardIcon name="globe" size={11}/>{event.environment}</span>}
        {projectName && <span className="error-detail-chip"><DashboardIcon name="sliders" size={11}/>{projectName}</span>}
      </div>
      <h1>{event.message}</h1>
      <p className="error-detail-when">Occurred {timeAgo(event.timestamp)} · {new Date(event.timestamp).toLocaleString(undefined, { dateStyle: "full", timeStyle: "medium" })}</p>
      <div className="error-detail-actions">
        <CopyButton value={origin + errorDetailHref(event)} label="Copy link" />
        <CopyButton value={event.message} label="Copy message" />
        <CopyButton value={JSON.stringify(event, null, 2)} label="Copy JSON" />
        <Link className="integrate-copy" href={similarHref}><DashboardIcon name="search" size={13}/>Find similar errors</Link>
      </div>
    </header>
  );
}

function StackTraceSection({ event }) {
  const parsed = parseStackTrace(event.stack_trace);
  const [view, setView] = useState(parsed.frames.length ? "frames" : "raw");
  const [showLibrary, setShowLibrary] = useState(false);
  const appFrames = parsed.frames.filter(frame => frame.inApp).length;
  const libraryFrames = parsed.frames.length - appFrames;
  const visibleFrames = showLibrary || appFrames === 0 ? parsed.frames : parsed.frames.filter(frame => frame.inApp);

  return (
    <section className="panel error-detail-section">
      <div className="error-detail-section-heading">
        <div><h2>Stack trace</h2><p>{!event.stack_trace ? "No stack trace was sent with this event." : parsed.frames.length ? `${parsed.frames.length} frames · ${appFrames} in your code${parsed.language ? " · " + languageLabel(parsed.language) : ""}` : "Shown as sent; the format wasn’t recognized."}</p></div>
        {event.stack_trace && <div className="error-detail-section-actions">
          {parsed.frames.length > 0 && <div className="integrate-tabs" role="tablist" aria-label="Stack trace view">
            <button type="button" role="tab" aria-selected={view === "frames"} className={view === "frames" ? "selected" : ""} onClick={() => setView("frames")}>Frames</button>
            <button type="button" role="tab" aria-selected={view === "raw"} className={view === "raw" ? "selected" : ""} onClick={() => setView("raw")}>Raw</button>
          </div>}
          <CopyButton value={event.stack_trace} />
        </div>}
      </div>
      {!event.stack_trace ? <p className="integrate-hint">Send <code>stack_trace</code> with your events to see where errors happen. The snippets in the <Link href="/dashboard/integrate">setup guide</Link> include it.</p>
        : view === "raw" ? <pre className="error-stack"><code>{event.stack_trace}</code></pre>
        : <>
          {parsed.headers.length > 0 && <div className="stack-headers">{parsed.headers.map((line, index) => <p key={index}>{line}</p>)}</div>}
          <ol className="stack-frames">
            {visibleFrames.map((frame, index) => <li key={index} className={frame.inApp ? "in-app" : "library"}>
              <div className="stack-frame-main">
                <b>{frame.fn || "<anonymous>"}</b>
                {frame.file && <span className="stack-frame-location" title={frame.file}>{shortPath(frame.file)}{frame.line ? `:${frame.line}` : ""}{frame.column ? `:${frame.column}` : ""}</span>}
              </div>
              {frame.code && <pre className="stack-frame-code"><code>{frame.code}</code></pre>}
              <span className="stack-frame-badge">{frame.inApp ? "Your code" : "Library"}</span>
            </li>)}
          </ol>
          {libraryFrames > 0 && appFrames > 0 && <button type="button" className="errors-clear stack-toggle" onClick={() => setShowLibrary(value => !value)}>{showLibrary ? "Hide library frames" : `Show ${libraryFrames} library frame${libraryFrames === 1 ? "" : "s"}`}</button>}
        </>}
    </section>
  );
}

function AttributesSection({ event }) {
  const entries = Object.entries(event.attributes || {}).sort(([a], [b]) => {
    const rank = key => { const index = PRIORITY_ATTRIBUTES.indexOf(key.toLowerCase()); return index === -1 ? PRIORITY_ATTRIBUTES.length : index; };
    return rank(a) - rank(b) || a.localeCompare(b);
  });
  return (
    <section className="panel error-detail-section">
      <div className="error-detail-section-heading"><div><h2>Attributes</h2><p>{entries.length ? `${entries.length} key/value pair${entries.length === 1 ? "" : "s"} sent with this event` : "No attributes were sent with this event."}</p></div></div>
      {entries.length > 0 ? <table className="error-attributes">
        <tbody>{entries.map(([key, value]) => <tr key={key}>
          <th scope="row"><code>{key}</code></th>
          <td><code>{value}</code></td>
          <td className="error-attribute-actions">
            <CopyButton value={value} />
            {/^[A-Za-z0-9_-]{1,64}$/.test(key) && <Link className="integrate-copy" href={"/dashboard/errors?" + new URLSearchParams({ scope: "account", ["attr." + key]: value }).toString()} title={`Find errors where ${key} = ${value}`}><DashboardIcon name="search" size={12}/>Filter</Link>}
          </td>
        </tr>)}</tbody>
      </table> : <p className="integrate-hint">Add context such as <code>request_id</code>, <code>user_id</code>, or <code>release</code> in <code>attributes</code> to make errors easier to investigate.</p>}
    </section>
  );
}

function DetailsSection({ event, projectName }) {
  const occurred = new Date(event.timestamp);
  const received = new Date(event.received_at);
  const delayMs = received.getTime() - occurred.getTime();
  const rows = [
    ["Level", <span key="level" className={"error-level " + levelClass(event.level)}>{event.level}</span>],
    ["Service", event.service],
    ["Environment", event.environment || "Not set"],
    ["Project", projectName || event.project_id],
    ["Occurred (local)", occurred.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })],
    ["Occurred (UTC)", <code key="utc">{event.timestamp}</code>],
    ["Received (UTC)", <code key="received">{event.received_at}</code>],
    ["Delivery delay", formatDelay(delayMs)],
    ["Event ID", <span key="id" className="error-detail-copy-row"><code>{event.id}</code><CopyButton value={event.id} /></span>],
    ["Project ID", <code key="pid">{event.project_id}</code>],
  ];
  return (
    <section className="panel error-detail-section">
      <div className="error-detail-section-heading"><div><h2>Details</h2></div></div>
      <dl className="error-detail-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  );
}

/** Other events with the same message and service in this project, with simple statistics. */
function OccurrencesSection({ event }) {
  const [state, setState] = useState({ id: "", events: [], hasMore: false, error: "" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ q: event.message.slice(0, 200), service: event.service, sort: "-received_at", limit: String(OCCURRENCE_LIMIT) });
        const response = await fetch("/api/projects/" + encodeURIComponent(event.project_id) + "/errors?" + params, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) throw new Error(data?.error?.message || "Could not load occurrences.");
        const matches = (Array.isArray(data?.errors) ? data.errors : []).filter(item => item.message === event.message);
        setState({ id: event.id, events: matches, hasMore: Boolean(data?.has_more), error: "" });
      } catch (cause) {
        if (!cancelled) setState({ id: event.id, events: [], hasMore: false, error: cause instanceof Error ? cause.message : "Could not load occurrences." });
      }
    })();
    return () => { cancelled = true; };
  }, [event]);

  const loading = state.id !== event.id;
  const occurrences = state.events;
  const index = occurrences.findIndex(item => item.id === event.id);
  const newer = index > 0 ? occurrences[index - 1] : null;
  const older = index >= 0 && index < occurrences.length - 1 ? occurrences[index + 1] : null;
  const environments = countBy(occurrences, item => item.environment || "Not set");
  const attributeBreakdown = breakdownAttributes(occurrences);
  const count = occurrences.length;
  const countLabel = `${count}${state.hasMore ? "+" : ""}`;
  const similarHref = "/dashboard/errors?" + new URLSearchParams({ q: event.message.slice(0, 200), service: event.service }).toString();

  return (
    <section className="panel error-detail-section">
      <div className="error-detail-section-heading"><div><h2>Occurrences</h2><p>Same message from {event.service} in this project</p></div></div>
      {loading ? <p className="integrate-hint">Loading occurrences…</p>
        : state.error ? <p className="form-error">{state.error}</p>
        : <>
          <div className="occurrence-stats">
            <div><span>Times seen</span><b>{countLabel}</b></div>
            <div><span>{state.hasMore ? "Earliest loaded" : "First seen"}</span><b title={occurrences.at(-1)?.received_at}>{occurrences.length ? timeAgo(occurrences.at(-1).received_at) : "—"}</b></div>
            <div><span>Last seen</span><b title={occurrences[0]?.received_at}>{occurrences.length ? timeAgo(occurrences[0].received_at) : "—"}</b></div>
          </div>
          {count > 1 && <Histogram events={occurrences} />}
          <div className="occurrence-nav">
            {newer ? <Link className="integrate-copy" href={errorDetailHref(newer)}>← Newer</Link> : <span className="integrate-copy disabled">← Newer</span>}
            <span>{index >= 0 ? `${index + 1} of ${countLabel}` : "This event"}</span>
            {older ? <Link className="integrate-copy" href={errorDetailHref(older)}>Older →</Link> : <span className="integrate-copy disabled">Older →</span>}
          </div>
          {environments.length > 1 && <Breakdown title="Environments" items={environments} total={count} />}
          {attributeBreakdown.map(([key, items]) => <Breakdown key={key} title={key} items={items} total={count} />)}
          {count > 1 && <ul className="occurrence-list">
            {occurrences.slice(0, 8).map(item => <li key={item.id}>
              {item.id === event.id ? <span className="occurrence-current"><span>{new Date(item.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span><small>Viewing</small></span>
                : <Link href={errorDetailHref(item)}><span>{new Date(item.timestamp).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span><small>{item.environment || ""}</small></Link>}
            </li>)}
          </ul>}
          <Link className="subtle-button occurrence-all" href={similarHref}>View all in Errors <DashboardIcon name="arrow" size={13}/></Link>
        </>}
    </section>
  );
}

/** Occurrences over time: hourly buckets for the last day, daily buckets for longer spans. */
function Histogram({ events }) {
  const newest = new Date(events[0].received_at).getTime();
  const oldest = new Date(events.at(-1).received_at).getTime();
  const daily = newest - oldest > 36 * 60 * 60 * 1000;
  const bucketMs = daily ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  const bucketCount = daily ? Math.min(30, Math.ceil((newest - oldest) / bucketMs) + 1) : 24;
  const end = newest;
  const buckets = Array.from({ length: bucketCount }, (_, index) => ({ start: end - (bucketCount - index) * bucketMs, count: 0 }));
  for (const item of events) {
    const time = new Date(item.received_at).getTime();
    const index = bucketCount - 1 - Math.floor((end - time) / bucketMs);
    if (index >= 0 && index < bucketCount) buckets[index].count += 1;
  }
  const max = Math.max(...buckets.map(bucket => bucket.count), 1);
  return (
    <figure className="occurrence-histogram" aria-label={`Occurrences per ${daily ? "day" : "hour"}`}>
      <div className="occurrence-bars">{buckets.map((bucket, index) => <span key={index} style={{ height: `${Math.max((bucket.count / max) * 100, bucket.count ? 8 : 2)}%` }} title={`${bucket.count} · ${new Date(bucket.start + bucketMs).toLocaleString(undefined, daily ? { dateStyle: "medium" } : { timeStyle: "short", dateStyle: "short" })}`} className={bucket.count ? "" : "empty"} />)}</div>
      <figcaption><span>{daily ? `${bucketCount} days ago` : "24h ago"}</span><span>{daily ? "per day" : "per hour"}</span><span>latest</span></figcaption>
    </figure>
  );
}

function Breakdown({ title, items, total }) {
  return (
    <div className="occurrence-breakdown">
      <p>{title}</p>
      {items.slice(0, 5).map(([value, count]) => <div key={value} className="occurrence-breakdown-row">
        <span title={value}>{value}</span>
        <span className="occurrence-breakdown-bar"><i style={{ width: `${(count / total) * 100}%` }} /></span>
        <b>{Math.round((count / total) * 100)}%</b>
      </div>)}
    </div>
  );
}

function RawEventSection({ event }) {
  const json = JSON.stringify(event, null, 2);
  return (
    <section className="panel error-detail-section">
      <details className="error-raw">
        <summary><span><b>Raw event</b><small>The event exactly as stored, as JSON</small></span><CopyButton value={json} /></summary>
        <pre className="error-stack"><code>{json}</code></pre>
      </details>
    </section>
  );
}

function countBy(items, keyOf) {
  const counts = new Map();
  for (const item of items) counts.set(keyOf(item), (counts.get(keyOf(item)) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Attribute keys whose values vary across occurrences (with a few distinct values) are the
 * most telling: e.g. one release or host accounting for most of them. */
function breakdownAttributes(events) {
  if (events.length < 2) return [];
  const keys = new Set(events.flatMap(item => Object.keys(item.attributes || {})));
  return [...keys]
    .map(key => [key, countBy(events.filter(item => item.attributes?.[key] !== undefined), item => item.attributes[key])])
    .filter(([, items]) => items.length > 1 && items.length <= 10)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4);
}

function formatDelay(ms) {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 0) return "Clock ahead by " + formatDuration(-ms);
  if (ms < 1000) return "Under a second";
  return formatDuration(ms);
}

function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return seconds + "s";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + "m";
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours + "h";
  return Math.round(hours / 24) + "d";
}

function shortPath(file) {
  const parts = file.split(/[\\/]/);
  return parts.length > 3 ? "…/" + parts.slice(-3).join("/") : file;
}

function languageLabel(language) {
  return { javascript: "JavaScript", python: "Python", go: "Go", java: "Java", dotnet: ".NET" }[language] || language;
}

function levelClass(level) {
  if (level === "fatal" || level === "critical") return "fatal";
  if (level === "warning" || level === "warn") return "warning";
  if (level === "info" || level === "debug") return "info";
  return "error";
}
