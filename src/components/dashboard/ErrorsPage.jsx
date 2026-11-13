"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { ProjectRequired } from "./apiKeys";
import { errorDetailHref } from "./ErrorDetailPage";
import { SORT_OPTIONS, TIME_RANGES, timeAgo, useErrorSearch } from "./useProjectErrors";

const PAGE_SIZE = 50;
const COMMON_LEVELS = ["fatal", "error", "warning", "info", "debug"];
const EMPTY_FILTERS = { q: "", levels: [], environments: [], services: [], projectIds: [], attributes: {}, range: "all", sort: "-received_at" };

/**
 * Reads an initial search from the URL, so global search (⌘K) and shared links can open the
 * page pre-filtered: ?scope=account&q=timeout&level=error,fatal&event=<id>.
 * A new URL remounts the view with that search.
 */
export default function ErrorsPage() {
  const searchParams = useSearchParams();
  return <ErrorsView key={searchParams.toString()} initial={initialFromUrl(searchParams)} />;
}

function initialFromUrl(params) {
  const list = name => (params.get(name) || "").split(",").map(value => value.trim()).filter(Boolean);
  const range = params.get("range");
  const attributes = {};
  for (const [key, value] of params) {
    const name = key.startsWith("attr.") ? key.slice(5) : "";
    if (/^[A-Za-z0-9_-]{1,64}$/.test(name) && Object.keys(attributes).length < 10) attributes[name] = value.slice(0, 100);
  }
  const sort = params.get("sort");
  return {
    scope: params.get("scope") === "account" ? "account" : "project",
    filters: {
      ...EMPTY_FILTERS,
      q: (params.get("q") || "").trim().slice(0, 200),
      levels: list("level").map(value => value.toLowerCase()),
      environments: list("environment"),
      services: list("service"),
      projectIds: list("project_id"),
      attributes,
      range: TIME_RANGES.some(option => option.value === range) ? range : "all",
      sort: SORT_OPTIONS.some(option => option.value === sort) ? sort : EMPTY_FILTERS.sort,
    },
  };
}

function ErrorsView({ initial }) {
  const { projects, selectedProject, loading: projectsLoading } = useDashboardData();
  const [scope, setScope] = useState(initial.scope); // project | account
  const [filters, setFilters] = useState(initial.filters);
  const [queryInput, setQueryInput] = useState(initial.filters.q);
  const accountWide = scope === "account";

  // Search as the user types, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setFilters(current => current.q === queryInput.trim() ? current : { ...current, q: queryInput.trim() }), 350);
    return () => clearTimeout(timer);
  }, [queryInput]);

  const searchFilters = { ...filters, projectIds: accountWide ? filters.projectIds : [], limit: PAGE_SIZE };
  const { events, hasMore, loading, loadingMore, error, refresh, loadMore, lastUpdated, facets } = useErrorSearch({
    accountWide,
    projectId: selectedProject?.id || "",
    filters: searchFilters,
  });

  const projectNames = new Map(projects.map(project => [project.id, project.name]));
  const levelOptions = [...new Set([...COMMON_LEVELS, ...facets.levels, ...filters.levels])];
  const serviceOptions = [...new Set([...facets.services, ...filters.services])];
  const environmentOptions = [...new Set([...facets.environments, ...filters.environments])];
  const activeFilterCount = filters.levels.length + filters.environments.length + filters.services.length
    + (accountWide ? filters.projectIds.length : 0) + (filters.range !== "all" ? 1 : 0) + (filters.q ? 1 : 0)
    + Object.keys(filters.attributes).length;
  const attributeFilters = Object.entries(filters.attributes);

  function removeAttribute(name) {
    setFilters(current => {
      const attributes = { ...current.attributes };
      delete attributes[name];
      return { ...current, attributes };
    });
  }

  function update(name, value) {
    setFilters(current => ({ ...current, [name]: value }));
  }

  function clearFilters() {
    setQueryInput("");
    setFilters(current => ({ ...EMPTY_FILTERS, sort: current.sort }));
  }

  const needsProject = !accountWide && !selectedProject;

  return (
    <div className="errors-page">
      <div className="page-heading">
        <div><div className="page-eyebrow">OBSERVABILITY</div><h1>Errors</h1><p>{accountWide ? "Error events across every project in this account." : selectedProject ? <>Error events reported to <b className="integrate-project-name">{selectedProject.name}</b>.</> : "Error events reported by your services, grouped by project."}</p></div>
        <div className="errors-heading-actions">
          <div className="integrate-tabs errors-scope" role="tablist" aria-label="Which errors to show">
            <button type="button" role="tab" aria-selected={!accountWide} className={!accountWide ? "selected" : ""} onClick={() => setScope("project")}>{selectedProject ? selectedProject.name : "This project"}</button>
            <button type="button" role="tab" aria-selected={accountWide} className={accountWide ? "selected" : ""} onClick={() => setScope("account")}>All projects</button>
          </div>
          {!needsProject && <button className="date-button" type="button" onClick={() => void refresh()} disabled={loading}><DashboardIcon name="activity" size={15}/> Refresh</button>}
        </div>
      </div>

      {projectsLoading ? <div className="projects-loading">Loading projects…</div>
        : needsProject ? <section className="panel"><ProjectRequired what="Errors" /></section>
        : <section className="panel errors-panel">
          <div className="errors-toolbar">
            <label className="api-keys-search errors-search"><DashboardIcon name="search" size={14}/><input value={queryInput} onChange={event => setQueryInput(event.target.value)} maxLength={200} placeholder="Search message, service, environment, or stack trace" aria-label="Search errors" /></label>
            <div className="errors-filters">
              <MultiSelect label="Level" options={levelOptions} selected={filters.levels} onChange={value => update("levels", value)} />
              <MultiSelect label="Service" options={serviceOptions} selected={filters.services} onChange={value => update("services", value)} emptyText="No services seen yet" />
              <MultiSelect label="Environment" options={environmentOptions} selected={filters.environments} onChange={value => update("environments", value)} emptyText="No environments seen yet" />
              {accountWide && <MultiSelect label="Project" options={projects.map(project => project.id)} selected={filters.projectIds} onChange={value => update("projectIds", value)} format={id => projectNames.get(id) || id} />}
              <select value={filters.range} onChange={event => update("range", event.target.value)} aria-label="Time range">{TIME_RANGES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <select value={filters.sort} onChange={event => update("sort", event.target.value)} aria-label="Sort by">{SORT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              {activeFilterCount > 0 && <button className="errors-clear" type="button" onClick={clearFilters}>Clear filters</button>}
            </div>
            {attributeFilters.length > 0 && <div className="errors-attribute-chips">{attributeFilters.map(([name, value]) => <span key={name} className="errors-attribute-chip"><code>{name} = {value}</code><button type="button" onClick={() => removeAttribute(name)} aria-label={`Remove filter ${name}`}>×</button></span>)}</div>}
          </div>
          <div className="errors-status">
            <span>{loading ? "Loading…" : `${events.length}${hasMore ? "+" : ""} event${events.length === 1 ? "" : "s"}${activeFilterCount ? " match" : ""}`}</span>
            {lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString(undefined, { timeStyle: "short" })} · refreshes every 30s</span>}
          </div>

          {error && <div className="api-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}>Retry</button></div>}

          {loading ? <div className="projects-empty">Loading errors…</div>
            : events.length === 0 ? (activeFilterCount > 0
              ? <div className="errors-no-match">No errors match these filters. <button type="button" className="errors-clear" onClick={clearFilters}>Clear filters</button></div>
              : !error && <div className="telemetry-empty-page errors-empty">
                <span className="empty-icon"><DashboardIcon name="alert" size={22}/></span>
                <h2>{accountWide ? "No errors in this account yet" : `No errors yet for ${selectedProject.name}`}</h2>
                <p>Create an API key for a project and send error events from your service. New events show up here automatically.</p>
                <Link href="/dashboard/integrate">Open the setup guide <DashboardIcon name="arrow" size={14}/></Link>
              </div>)
            : <>
              <ul className="error-list">
                {events.map(event => {
                  return <li key={event.id}>
                    <Link className="error-row" href={errorDetailHref(event)}>
                      <span className={"error-level " + levelClass(event.level)}>{event.level}</span>
                      <span className="error-main"><b>{event.message}</b><small>{accountWide && <span className="error-project">{projectNames.get(event.project_id) || "Unknown project"}</span>}{event.service}{event.environment ? " · " + event.environment : ""}</small></span>
                      <span className="error-time" title={new Date(event.timestamp).toLocaleString()}>{timeAgo(event.timestamp)}</span>
                      <DashboardIcon name="chevron" size={14}/>
                    </Link>
                  </li>;
                })}
              </ul>
              {hasMore && <div className="errors-load-more"><button className="subtle-button" type="button" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading…" : `Load ${PAGE_SIZE} more`}</button></div>}
            </>}
        </section>}
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange, format = value => value, emptyText = "No options" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) { if (!ref.current?.contains(event.target)) setOpen(false); }
    function onKeyDown(event) { if (event.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(value) {
    onChange(selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value]);
  }

  const summary = selected.length === 0 ? "All" : selected.length === 1 ? format(selected[0]) : `${selected.length} selected`;

  return (
    <div className="multi-select" ref={ref}>
      <button type="button" className={"multi-select-trigger" + (selected.length ? " active" : "")} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-haspopup="listbox">
        <span>{label}:</span> <b>{summary}</b><DashboardIcon name="down" size={13}/>
      </button>
      {open && <div className="multi-select-menu" role="listbox" aria-multiselectable="true" aria-label={label}>
        {options.length === 0 ? <p>{emptyText}</p> : options.map(value => <label key={value} className="multi-select-option">
          <input type="checkbox" checked={selected.includes(value)} onChange={() => toggle(value)} />
          <span>{format(value)}</span>
        </label>)}
        {selected.length > 0 && <button type="button" className="multi-select-clear" onClick={() => onChange([])}>Clear</button>}
      </div>}
    </div>
  );
}

function levelClass(level) {
  if (level === "fatal" || level === "critical") return "fatal";
  if (level === "warning" || level === "warn") return "warning";
  if (level === "info" || level === "debug") return "info";
  return "error";
}
