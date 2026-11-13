"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { timeAgo } from "./useProjectErrors";
import { errorDetailHref } from "./ErrorDetailPage";

const ERROR_RESULTS = 6;

const PAGES = [
  { label: "Overview", href: "/dashboard", icon: "grid" },
  { label: "Errors", href: "/dashboard/errors", icon: "alert" },
  { label: "Traces", href: "/dashboard/traces", icon: "activity" },
  { label: "Integrate", href: "/dashboard/integrate", icon: "code" },
  { label: "Projects", href: "/dashboard/settings/project", icon: "sliders" },
  { label: "API keys", href: "/dashboard/api-keys", icon: "key" },
  { label: "Account settings", href: "/dashboard/settings/account", icon: "users" },
];

/** Opens with ⌘K / Ctrl+K or the top-bar button. Searches the whole account. */
export function useGlobalSearchShortcut(setOpen) {
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(open => !open);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);
}

export function errorsSearchHref(query) {
  const params = new URLSearchParams({ scope: "account" });
  if (query) params.set("q", query);
  return "/dashboard/errors?" + params.toString();
}

export default function GlobalSearch({ onClose }) {
  const router = useRouter();
  const { projects, selectProject } = useDashboardData();
  const [query, setQuery] = useState("");
  const [errorResults, setErrorResults] = useState({ query: "", events: [], hasMore: false, error: "" });
  const [active, setActive] = useState(0);
  const listRef = useRef(null);
  const term = query.trim();

  // Account-wide error search, debounced so typing doesn't send a request per keystroke.
  useEffect(() => {
    if (!term) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: term, limit: String(ERROR_RESULTS), sort: "-received_at" });
        const response = await fetch("/api/errors?" + params, { cache: "no-store", signal: controller.signal });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error?.message || "Could not search errors.");
        setErrorResults({ query: term, events: Array.isArray(data?.errors) ? data.errors : [], hasMore: Boolean(data?.has_more), error: "" });
      } catch (cause) {
        if (cause?.name === "AbortError") return;
        setErrorResults({ query: term, events: [], hasMore: false, error: cause instanceof Error ? cause.message : "Could not search errors." });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const lower = term.toLowerCase();
  const projectNames = new Map(projects.map(project => [project.id, project.name]));
  const matchingProjects = term ? projects.filter(project => project.name.toLowerCase().includes(lower) || (project.description || "").toLowerCase().includes(lower)).slice(0, 5) : projects.slice(0, 5);
  const matchingPages = term ? PAGES.filter(page => page.label.toLowerCase().includes(lower)) : PAGES;
  const errorsCurrent = Boolean(term) && errorResults.query === term;
  const searchingErrors = Boolean(term) && !errorsCurrent;

  // One flat list so arrow keys move through every section in order.
  const items = [
    ...(errorsCurrent ? errorResults.events.map(event => ({
      id: "error:" + event.id,
      section: "Errors",
      run: () => router.push(errorDetailHref(event)),
      render: () => <>
        <span className={"error-level " + levelClass(event.level)}>{event.level}</span>
        <span className="global-search-text"><b>{event.message}</b><small>{projectNames.get(event.project_id) || "Unknown project"} · {event.service}{event.environment ? " · " + event.environment : ""}</small></span>
        <span className="global-search-meta">{timeAgo(event.timestamp)}</span>
      </>,
    })) : []),
    ...(term ? [{
      id: "all-errors",
      section: "Errors",
      run: () => router.push(errorsSearchHref(term)),
      render: () => <><span className="global-search-icon"><DashboardIcon name="search" size={14}/></span><span className="global-search-text"><b>Search all errors for “{term}”</b><small>Every project in this account, with filters and sorting</small></span><DashboardIcon name="arrow" size={13}/></>,
    }] : []),
    ...matchingProjects.map(project => ({
      id: "project:" + project.id,
      section: "Projects",
      run: () => { selectProject(project.id); router.push("/dashboard"); },
      render: () => <><span className="project-symbol global-search-symbol">{project.name.slice(0, 1).toUpperCase()}</span><span className="global-search-text"><b>{project.name}</b><small>{project.description || "Switch to this project"}</small></span></>,
    })),
    ...matchingPages.map(page => ({
      id: "page:" + page.href,
      section: "Pages",
      run: () => router.push(page.href),
      render: () => <><span className="global-search-icon"><DashboardIcon name={page.icon} size={14}/></span><span className="global-search-text"><b>{page.label}</b></span></>,
    })),
  ];
  const activeIndex = Math.min(active, Math.max(items.length - 1, 0));

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function choose(item) {
    onClose();
    item.run();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") { event.preventDefault(); onClose(); }
    else if (event.key === "ArrowDown") { event.preventDefault(); setActive(Math.min(activeIndex + 1, items.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(Math.max(activeIndex - 1, 0)); }
    else if (event.key === "Enter" && items[activeIndex]) { event.preventDefault(); choose(items[activeIndex]); }
  }

  let lastSection = "";

  return (
    <div className="modal-backdrop global-search-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="global-search" role="dialog" aria-modal="true" aria-label="Search this account">
        <label className="global-search-input">
          <DashboardIcon name="search" size={16}/>
          <input autoFocus value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} maxLength={200} placeholder="Search errors, projects, and pages across this account" role="combobox" aria-expanded="true" aria-controls="global-search-results" aria-activedescendant={items[activeIndex] ? "gs-" + activeIndex : undefined} />
          <kbd>Esc</kbd>
        </label>
        <div className="global-search-results" id="global-search-results" role="listbox" ref={listRef}>
          {term && searchingErrors && <p className="global-search-note">Searching errors across all projects…</p>}
          {errorsCurrent && errorResults.error && <p className="global-search-note error">{errorResults.error}</p>}
          {errorsCurrent && !errorResults.error && errorResults.events.length === 0 && <p className="global-search-note">No errors match “{term}” in this account.</p>}
          {items.map((item, index) => {
            const header = item.section !== lastSection ? item.section : "";
            lastSection = item.section;
            return <div key={item.id}>
              {header && <p className="global-search-section">{header}</p>}
              <button id={"gs-" + index} type="button" role="option" aria-selected={index === activeIndex} data-active={index === activeIndex} className={"global-search-item" + (index === activeIndex ? " active" : "")} onMouseMove={() => { if (index !== activeIndex) setActive(index); }} onClick={() => choose(item)}>
                {item.render()}
              </button>
            </div>;
          })}
          {term && items.length === 0 && !searchingErrors && <p className="global-search-note">Nothing matches “{term}”.</p>}
        </div>
        <footer className="global-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> to move</span><span><kbd>↵</kbd> to open</span>{errorsCurrent && errorResults.hasMore && <span>More errors match. Choose “Search all errors” to see them</span>}</footer>
      </section>
    </div>
  );
}

function levelClass(level) {
  if (level === "fatal" || level === "critical") return "fatal";
  if (level === "warning" || level === "warn") return "warning";
  if (level === "info" || level === "debug") return "info";
  return "error";
}
