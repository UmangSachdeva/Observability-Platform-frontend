"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { CopyButton } from "./apiKeys";
import { errorDetailHref } from "./ErrorDetailPage";
import { timeAgo } from "./useProjectErrors";
import { formatDuration, serviceColor } from "./traceUtils";

const TICKS = [0, 0.25, 0.5, 0.75, 1];

export default function TraceDetailPage({ projectId, traceId }) {
  const { projects } = useDashboardData();
  const searchParams = useSearchParams();
  const [result, setResult] = useState({ key: "", trace: null, error: "", code: "" });
  const key = projectId + "/" + traceId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/projects/" + encodeURIComponent(projectId) + "/traces/" + encodeURIComponent(traceId), { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;
        if (!response.ok) setResult({ key, trace: null, error: data?.error?.message || "Could not load this trace.", code: data?.error?.code || "" });
        else setResult({ key, trace: data, error: "", code: "" });
      } catch {
        if (!cancelled) setResult({ key, trace: null, error: "Could not reach the dashboard server.", code: "" });
      }
    })();
    return () => { cancelled = true; };
  }, [key, projectId, traceId]);

  const loading = result.key !== key;
  const projectName = projects.find(project => project.id === projectId)?.name;

  return (
    <div className="error-detail-page trace-detail-page">
      <nav className="error-detail-breadcrumb" aria-label="Breadcrumb">
        <Link href="/dashboard/traces"><DashboardIcon name="activity" size={12}/>Traces</Link>
        <DashboardIcon name="chevron" size={11}/>
        {projectName && <><span>{projectName}</span><DashboardIcon name="chevron" size={11}/></>}
        <span className="error-detail-crumb-id">{traceId}</span>
      </nav>
      {loading ? <div className="projects-loading">Loading trace…</div>
        : result.error ? <section className="panel telemetry-empty-page">
          <span className="empty-icon"><DashboardIcon name="alert" size={22}/></span>
          <h2>{result.code === "trace_not_found" ? "Trace not found" : "Couldn’t load this trace"}</h2>
          <p>{result.code === "trace_not_found" ? "No spans with this trace ID have reached this project. Spans are sent in batches, so a very recent trace can take a few seconds to appear." : result.error}</p>
          <Link href="/dashboard/traces">Back to traces <DashboardIcon name="arrow" size={14}/></Link>
        </section>
        : <TraceView trace={result.trace} projectId={projectId} initialSpan={searchParams.get("span") || ""} />}
    </div>
  );
}

function TraceView({ trace, projectId, initialSpan }) {
  const spans = trace.spans;
  const root = spans[0];
  const [selectedId, setSelectedId] = useState(spans.some(span => span.span_id === initialSpan) ? initialSpan : (spans.find(span => span.status_code === "ERROR") || root).span_id);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const total = Math.max(trace.duration_ms, 0.001);

  // Rows come parent-first, so a span's descendants are the rows right after it with a
  // greater depth. hasChildren and visibility are derived from that order.
  const rows = useMemo(() => {
    const visible = [];
    let hideBelow = Infinity;
    spans.forEach((span, index) => {
      if (span.depth <= hideBelow) hideBelow = Infinity;
      const hasChildren = index + 1 < spans.length && spans[index + 1].depth > span.depth;
      if (hideBelow === Infinity) {
        visible.push({ span, hasChildren });
        if (hasChildren && collapsed.has(span.span_id)) hideBelow = span.depth;
      }
    });
    return visible;
  }, [spans, collapsed]);

  const selected = spans.find(span => span.span_id === selectedId) || root;

  function toggle(spanId) {
    setCollapsed(current => {
      const next = new Set(current);
      if (next.has(spanId)) next.delete(spanId); else next.add(spanId);
      return next;
    });
  }

  return (
    <>
      <header className="panel error-detail-header trace-header">
        <div className="error-detail-tags">
          <span className={"error-level " + (trace.error_count > 0 ? "error" : "info")}>{trace.error_count > 0 ? `${trace.error_count} error span${trace.error_count === 1 ? "" : "s"}` : "OK"}</span>
          {trace.services.map(name => <span key={name} className="error-detail-chip"><i className="trace-dot" style={{ background: serviceColor(name) }} />{name}</span>)}
        </div>
        <h1>{root.name}</h1>
        <p className="error-detail-when">
          {formatDuration(trace.duration_ms)} · {trace.span_count} span{trace.span_count === 1 ? "" : "s"} · started {timeAgo(trace.start_time)} ({new Date(trace.start_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })})
        </p>
        <p className="trace-id-row"><code>trace_id {trace.trace_id}</code><CopyButton value={trace.trace_id} /></p>
        {trace.truncated && <p className="trace-note">This trace has more spans than can be shown; the first {spans.length} are displayed.</p>}
      </header>

      <div className="trace-layout">
        <section className="panel error-detail-section trace-waterfall-panel">
          <div className="error-detail-section-heading"><div><h2>Waterfall</h2><p>Each row is a span. Bar position and length show when it ran and for how long. Click a row for details.</p></div></div>
          <div className="waterfall" role="tree" aria-label="Spans">
            <div className="waterfall-axis" aria-hidden="true">
              <span className="waterfall-label-col">Span</span>
              <span className="waterfall-ticks">{TICKS.map(tick => <span key={tick} style={{ left: tick * 100 + "%" }}>{formatDuration(total * tick)}</span>)}</span>
            </div>
            {rows.map(({ span, hasChildren }) => {
              const left = (span.offset_ms / total) * 100;
              const width = Math.max(0.4, (span.duration_ms / total) * 100);
              const labelOnLeft = left + width > 78;
              const color = serviceColor(span.service_name);
              return (
                <div key={span.span_id} role="treeitem" aria-level={span.depth + 1} aria-selected={span.span_id === selected.span_id} aria-expanded={hasChildren ? !collapsed.has(span.span_id) : undefined}
                  className={"waterfall-row" + (span.span_id === selected.span_id ? " selected" : "")} onClick={() => setSelectedId(span.span_id)}>
                  <span className="waterfall-label-col" style={{ paddingLeft: span.depth * 14 }}>
                    {hasChildren
                      ? <button type="button" className="waterfall-toggle" onClick={event => { event.stopPropagation(); toggle(span.span_id); }} aria-label={collapsed.has(span.span_id) ? "Expand" : "Collapse"}>{collapsed.has(span.span_id) ? "▸" : "▾"}</button>
                      : <span className="waterfall-toggle-space" />}
                    <i className="trace-dot" style={{ background: color }} />
                    <span className="waterfall-name" title={span.name}>{span.name}</span>
                    <span className="waterfall-kind">{span.kind}</span>
                    {span.orphan && <span className="waterfall-orphan" title="Its parent span is in another project or hasn't arrived.">↳ remote parent</span>}
                  </span>
                  <span className="waterfall-track">
                    <span className={"waterfall-bar" + (span.status_code === "ERROR" ? " error" : "")} style={{ left: left + "%", width: width + "%", "--bar": color }}>
                      {(span.events || []).map((event, index) => <i key={index} className={"waterfall-event" + (event.name === "exception" ? " exception" : "")} title={event.name}
                        style={{ left: Math.min(100, Math.max(0, ((event.offset_ms - span.offset_ms) / Math.max(span.duration_ms, 0.001)) * 100)) + "%" }} />)}
                    </span>
                    <span className="waterfall-duration" style={labelOnLeft ? { right: (100 - left) + 1 + "%" } : { left: left + width + 1 + "%" }}>{formatDuration(span.duration_ms)}</span>
                  </span>
                </div>
              );
            })}
          </div>
          <div className="waterfall-legend">
            {trace.services.map(name => <span key={name}><i className="trace-dot" style={{ background: serviceColor(name) }} />{name}</span>)}
            <span><i className="trace-dot error-swatch" />error status</span>
            <span><i className="waterfall-event exception legend" />exception</span>
            <span><i className="waterfall-event legend" />span event</span>
          </div>
        </section>

        <SpanDetails span={selected} />
      </div>

      <section className="panel error-detail-section">
        <div className="error-detail-section-heading"><div><h2>Errors in this trace</h2><p>{trace.errors.length ? "Error events reported with this trace_id." : "No error events were reported with this trace_id."}</p></div></div>
        {trace.errors.length > 0 && <ul className="occurrence-list">
          {trace.errors.map(event => <li key={event.id}><Link href={errorDetailHref({ ...event, project_id: event.project_id || projectId })}>
            <span><span className={"error-level " + (event.level === "fatal" ? "fatal" : event.level === "warning" ? "warning" : "error")}>{event.level}</span> {event.message}</span>
            <small>{event.span_id ? "span " + event.span_id.slice(0, 8) + " · " : ""}{timeAgo(event.timestamp)}</small>
          </Link></li>)}
        </ul>}
      </section>
    </>
  );
}

function SpanDetails({ span }) {
  const attributes = Object.entries(span.attributes || {}).sort(([a], [b]) => a.localeCompare(b));
  const resource = Object.entries(span.resource || {}).sort(([a], [b]) => a.localeCompare(b));
  const rows = [
    ["Service", span.service_name],
    ["Kind", span.kind],
    ["Status", <span key="status" className={"span-status " + span.status_code.toLowerCase()}>{span.status_code}{span.status_message ? ": " + span.status_message : ""}</span>],
    ["Duration", formatDuration(span.duration_ms)],
    ["Starts at", "+" + formatDuration(span.offset_ms)],
    ["Span ID", <span key="sid" className="error-detail-copy-row"><code>{span.span_id}</code><CopyButton value={span.span_id} /></span>],
    ["Parent span", span.parent_span_id ? <code key="pid">{span.parent_span_id}</code> : "None (root)"],
  ];
  return (
    <aside className="panel error-detail-section span-details" aria-live="polite">
      <div className="error-detail-section-heading"><div><h2 title={span.name}>{span.name}</h2><p>Span details</p></div></div>
      <dl className="error-detail-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>

      <h3 className="span-subheading">Attributes</h3>
      {attributes.length ? <table className="error-attributes"><tbody>{attributes.map(([name, value]) => <tr key={name}><th><code>{name}</code></th><td><code>{value}</code></td></tr>)}</tbody></table>
        : <p className="span-empty">No attributes.</p>}

      {(span.events || []).length > 0 && <>
        <h3 className="span-subheading">Events</h3>
        <ul className="span-events">{span.events.map((event, index) => <li key={index}>
          <div><b className={event.name === "exception" ? "exception" : ""}>{event.name}</b><small>+{formatDuration(event.offset_ms)}</small></div>
          {Object.entries(event.attributes || {}).map(([name, value]) => name === "exception.stacktrace"
            ? <pre key={name} className="span-stack">{value}</pre>
            : <p key={name}><code>{name}</code> {value}</p>)}
        </li>)}</ul>
      </>}

      {resource.length > 0 && <details className="span-resource">
        <summary>Resource ({resource.length})</summary>
        <table className="error-attributes"><tbody>{resource.map(([name, value]) => <tr key={name}><th><code>{name}</code></th><td><code>{value}</code></td></tr>)}</tbody></table>
      </details>}
    </aside>
  );
}
