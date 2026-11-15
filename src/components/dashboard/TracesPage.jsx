"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { ProjectRequired } from "./apiKeys";
import { TIME_RANGES, timeAgo } from "./useProjectErrors";
import { formatDuration, serviceColor, traceDetailHref } from "./traceUtils";

const PAGE_SIZE = 50;

/** Reads ?q=, ?service= and ?status=error so links can open the list pre-filtered. */
export default function TracesPage() {
  const searchParams = useSearchParams();
  return <TracesView key={searchParams.toString()} initial={{
    q: (searchParams.get("q") || "").slice(0, 200),
    service: searchParams.get("service") || "",
    errorsOnly: searchParams.get("status") === "error",
    range: TIME_RANGES.some(option => option.value === searchParams.get("range")) ? searchParams.get("range") : "all",
  }} />;
}

/** Builds API parameters. Time ranges are resolved now, so "last hour" stays current. */
function buildParams(spec, cursor) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (spec.q) params.set("q", spec.q);
  if (spec.service) params.set("service", spec.service);
  if (spec.errorsOnly) params.set("status", "error");
  const range = TIME_RANGES.find(option => option.value === spec.range);
  if (range?.ms) params.set("from", new Date(Date.now() - range.ms).toISOString().replace(/\.\d{3}Z$/, "Z"));
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

function TracesView({ initial }) {
  const { selectedProject, loading: projectsLoading } = useDashboardData();
  const projectId = selectedProject?.id || "";
  const [queryInput, setQueryInput] = useState(initial.q);
  const [filters, setFilters] = useState(initial);
  const key = JSON.stringify({ projectId, ...filters });
  const spec = useMemo(() => JSON.parse(key), [key]);
  const [state, setState] = useState({ key: "", traces: [], cursor: "", hasMore: false, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [seenServices, setSeenServices] = useState([]);
  const latestKey = useRef(key);

  useEffect(() => { latestKey.current = key; }, [key]);

  useEffect(() => {
    const timer = setTimeout(() => setFilters(current => current.q === queryInput.trim() ? current : { ...current, q: queryInput.trim() }), 350);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const fetchPage = useCallback(async (cursor) => {
    const response = await fetch("/api/projects/" + encodeURIComponent(spec.projectId) + "/traces?" + buildParams(spec, cursor), { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Could not load traces.");
      error.code = data?.error?.code;
      throw error;
    }
    const traces = Array.isArray(data?.traces) ? data.traces : [];
    setSeenServices(current => [...new Set([...current, ...traces.flatMap(trace => trace.services || [])])].sort());
    return { traces, cursor: data?.next_cursor || "", hasMore: Boolean(data?.has_more) };
  }, [spec]);

  const loadFirst = useCallback(async () => {
    if (!spec.projectId) return;
    try {
      const page = await fetchPage("");
      if (latestKey.current === key) setState({ key, ...page, error: "" });
    } catch (cause) {
      if (latestKey.current !== key) return;
      setState(current => current.key === key
        ? { ...current, error: cause.message }
        : { key, traces: [], cursor: "", hasMore: false, error: cause.message });
    }
  }, [spec.projectId, fetchPage, key]);

  const loadMore = useCallback(async () => {
    if (state.key !== key || !state.cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(state.cursor);
      setState(current => {
        if (current.key !== key) return current;
        const seen = new Set(current.traces.map(trace => trace.trace_id));
        return { ...current, traces: [...current.traces, ...page.traces.filter(trace => !seen.has(trace.trace_id))], cursor: page.cursor, hasMore: page.hasMore, error: "" };
      });
    } catch (cause) {
      // A cursor only works with the exact query it came from; start over if it was rejected.
      if (cause.code === "invalid_cursor") void loadFirst();
      else setState(current => ({ ...current, error: cause.message }));
    } finally {
      setLoadingMore(false);
    }
  }, [state.key, state.cursor, key, fetchPage, loadFirst]);

  useEffect(() => {
    if (!spec.projectId) return undefined;
    const timer = setTimeout(loadFirst, 0);
    return () => clearTimeout(timer);
  }, [spec.projectId, loadFirst]);

  const current = state.key === key;
  const traces = current ? state.traces : [];
  const loading = Boolean(projectId) && !current;
  const hasMore = current && state.hasMore;
  const error = current ? state.error : "";

  const maxDuration = Math.max(1, ...traces.map(trace => trace.duration_ms || 0));
  const activeFilters = (filters.q ? 1 : 0) + (filters.service ? 1 : 0) + (filters.errorsOnly ? 1 : 0) + (filters.range !== "all" ? 1 : 0);

  function clearFilters() {
    setQueryInput("");
    setFilters({ q: "", service: "", errorsOnly: false, range: "all" });
  }

  return (
    <div className="traces-page">
      <div className="page-heading">
        <div><div className="page-eyebrow">OBSERVABILITY</div><h1>Traces</h1><p>{selectedProject ? <>Requests traced through <b className="integrate-project-name">{selectedProject.name}</b>, newest first. Open one to see its waterfall.</> : "Follow requests across services from a single trace view."}</p></div>
        {projectId && <button className="date-button" type="button" onClick={() => void loadFirst()} disabled={loading}><DashboardIcon name="activity" size={15}/> Refresh</button>}
      </div>

      {projectsLoading ? <div className="projects-loading">Loading projects…</div>
        : !selectedProject ? <section className="panel"><ProjectRequired what="Traces" /></section>
        : <section className="panel errors-panel">
          <div className="errors-toolbar">
            <label className="api-keys-search errors-search"><DashboardIcon name="search" size={14}/><input value={queryInput} onChange={event => setQueryInput(event.target.value)} maxLength={200} placeholder="Search by root span, e.g. GET /checkout" aria-label="Search traces" /></label>
            <div className="errors-filters">
              <select value={filters.service} onChange={event => setFilters(current => ({ ...current, service: event.target.value }))} aria-label="Service">
                <option value="">All services</option>
                {[...new Set([...seenServices, ...(filters.service ? [filters.service] : [])])].map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <div className="integrate-tabs traces-status-toggle" role="tablist" aria-label="Which traces to show">
                <button type="button" role="tab" aria-selected={!filters.errorsOnly} className={!filters.errorsOnly ? "selected" : ""} onClick={() => setFilters(current => ({ ...current, errorsOnly: false }))}>All</button>
                <button type="button" role="tab" aria-selected={filters.errorsOnly} className={filters.errorsOnly ? "selected" : ""} onClick={() => setFilters(current => ({ ...current, errorsOnly: true }))}>With errors</button>
              </div>
              <select value={filters.range} onChange={event => setFilters(current => ({ ...current, range: event.target.value }))} aria-label="Time range">{TIME_RANGES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              {activeFilters > 0 && <button className="errors-clear" type="button" onClick={clearFilters}>Clear filters</button>}
            </div>
          </div>
          <div className="errors-status"><span>{loading ? "Loading…" : `${traces.length}${hasMore ? "+" : ""} trace${traces.length === 1 ? "" : "s"}`}</span></div>

          {error && <div className="api-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void loadFirst()}>Retry</button></div>}

          {loading ? <div className="projects-empty">Loading traces…</div>
            : traces.length === 0 ? (activeFilters > 0
              ? <div className="errors-no-match">No traces match these filters. <button type="button" className="errors-clear" onClick={clearFilters}>Clear filters</button></div>
              : !error && <div className="telemetry-empty-page errors-empty">
                <span className="empty-icon"><DashboardIcon name="activity" size={22}/></span>
                <h2>No traces yet for {selectedProject.name}</h2>
                <p>Send OpenTelemetry spans with this project&apos;s API key: point an OTLP/HTTP exporter at <code>/v1/traces</code> with the <code>x-access-key</code> and <code>x-secret-key</code> headers, or call <code>observability.StartTracing</code> from the Go client.</p>
                <Link href="/dashboard/integrate">Open the setup guide <DashboardIcon name="arrow" size={14}/></Link>
              </div>)
            : <>
              <ul className="trace-list">
                <li className="trace-list-head" aria-hidden="true"><span/><span>Root span</span><span>Duration</span><span>Spans</span><span>When</span><span/></li>
                {traces.map(trace => <li key={trace.trace_id}>
                  <Link className="trace-row" href={traceDetailHref(projectId, trace.trace_id)}>
                    <span className={"trace-status" + (trace.error_count > 0 ? " error" : "")} title={trace.error_count > 0 ? `${trace.error_count} span${trace.error_count === 1 ? "" : "s"} with errors` : "No errors"} />
                    <span className="trace-main">
                      <b>{trace.root_name}{trace.http_status_code && <span className={"trace-http" + (Number(trace.http_status_code) >= 500 ? " error" : Number(trace.http_status_code) >= 400 ? " warn" : "")}>{trace.http_status_code}</span>}</b>
                      <small>
                        {(trace.services || []).map(name => <span key={name} className="trace-service"><i style={{ background: serviceColor(name) }} />{name}</span>)}
                        {trace.partial && <span className="trace-partial" title="The root span is not in this project yet (still arriving, or sent to another project).">partial</span>}
                        <code className="trace-id">{trace.trace_id.slice(0, 12)}…</code>
                      </small>
                    </span>
                    <span className="trace-duration">
                      <span className="trace-duration-bar"><i style={{ width: Math.max(2, (trace.duration_ms / maxDuration) * 100) + "%" }} className={trace.error_count > 0 ? "error" : ""} /></span>
                      {formatDuration(trace.duration_ms)}
                    </span>
                    <span className="trace-spans">{trace.span_count}{trace.error_count > 0 && <em>{trace.error_count} err</em>}</span>
                    <span className="error-time" title={new Date(trace.start_time).toLocaleString()}>{timeAgo(trace.start_time)}</span>
                    <DashboardIcon name="chevron" size={14}/>
                  </Link>
                </li>)}
              </ul>
              {hasMore && <div className="errors-load-more"><button className="subtle-button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : `Load ${PAGE_SIZE} more`}</button></div>}
            </>}
        </section>}
    </div>
  );
}
