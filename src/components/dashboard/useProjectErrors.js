"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

export const TIME_RANGES = [
  { value: "all", label: "All time" },
  { value: "1h", label: "Last hour", ms: 60 * 60 * 1000 },
  { value: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

export const SORT_OPTIONS = [
  { value: "-received_at", label: "Newest first" },
  { value: "received_at", label: "Oldest first" },
  { value: "-timestamp", label: "Most recent occurrence" },
  { value: "level", label: "Level (A–Z)" },
  { value: "service", label: "Service (A–Z)" },
  { value: "-service", label: "Service (Z–A)" },
];

/** Builds API search parameters. Time ranges are resolved now, so "last hour" stays current. */
function buildParams(spec, cursor) {
  const params = new URLSearchParams();
  if (spec.q) params.set("q", spec.q);
  for (const [name, values] of [["level", spec.levels], ["environment", spec.environments], ["service", spec.services], ["project_id", spec.projectIds]]) {
    if (values?.length) params.set(name, values.join(","));
  }
  for (const [name, value] of Object.entries(spec.attributes || {})) params.set("attr." + name, value);
  const range = TIME_RANGES.find(option => option.value === spec.range);
  if (range?.ms) params.set("from", new Date(Date.now() - range.ms).toISOString().replace(/\.\d{3}Z$/, "Z"));
  if (spec.sort) params.set("sort", spec.sort);
  params.set("limit", String(spec.limit || 50));
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

/**
 * Server-side error search with filters, sorting and "load more" pagination.
 * `accountWide` searches every project in the account; otherwise `projectId` is required.
 * The first page refreshes every 30 seconds while the tab is visible, unless the user has
 * loaded further pages (refreshing then would throw away what they are reading).
 */
export function useErrorSearch({ accountWide = false, projectId = "", filters = {} }) {
  const key = JSON.stringify({ accountWide, projectId, ...filters });
  const spec = useMemo(() => JSON.parse(key), [key]);
  const enabled = spec.accountWide || Boolean(spec.projectId);
  const facetScope = spec.accountWide ? "account" : spec.projectId;
  const [state, setState] = useState({ key: "", events: [], nextCursor: "", hasMore: false, error: "", pages: 0, lastUpdated: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [facets, setFacets] = useState({ scope: "", services: [], environments: [], levels: [] });
  const pagesRef = useRef(0);

  useEffect(() => { pagesRef.current = state.key === key ? state.pages : 0; }, [state, key]);

  const fetchPage = useCallback(async (cursor) => {
    const url = (spec.accountWide ? "/api/errors" : "/api/projects/" + encodeURIComponent(spec.projectId) + "/errors") + "?" + buildParams(spec, cursor);
    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || "Could not load errors.");
      error.code = data?.error?.code;
      throw error;
    }
    const events = Array.isArray(data?.errors) ? data.errors : [];
    // Remember every service/environment/level seen in this scope so filter menus keep their
    // options even after the list is narrowed.
    setFacets(current => {
      const base = current.scope === facetScope ? current : { scope: facetScope, services: [], environments: [], levels: [] };
      const merge = (list, values) => [...new Set([...list, ...values.filter(Boolean)])].sort();
      return {
        scope: facetScope,
        services: merge(base.services, events.map(event => event.service)),
        environments: merge(base.environments, events.map(event => event.environment)),
        levels: merge(base.levels, events.map(event => event.level)),
      };
    });
    return { events, nextCursor: data?.next_cursor || "", hasMore: Boolean(data?.has_more) };
  }, [spec, facetScope]);

  const loadFirst = useCallback(async () => {
    if (!enabled) return;
    try {
      const page = await fetchPage("");
      setState({ key, ...page, error: "", pages: 1, lastUpdated: new Date() });
    } catch (cause) {
      setState(current => current.key === key
        ? { ...current, error: cause.message }
        : { key, events: [], nextCursor: "", hasMore: false, error: cause.message, pages: 0, lastUpdated: null });
    }
  }, [enabled, fetchPage, key]);

  const loadMore = useCallback(async () => {
    if (state.key !== key || !state.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(state.nextCursor);
      setState(current => {
        if (current.key !== key) return current;
        const seen = new Set(current.events.map(event => event.id));
        return { ...current, events: [...current.events, ...page.events.filter(event => !seen.has(event.id))], nextCursor: page.nextCursor, hasMore: page.hasMore, pages: current.pages + 1, error: "" };
      });
    } catch (cause) {
      // A cursor only works with the exact query it came from; start over if it was rejected.
      if (cause.code === "invalid_cursor") void loadFirst();
      else setState(current => ({ ...current, error: cause.message }));
    } finally {
      setLoadingMore(false);
    }
  }, [state.key, state.nextCursor, key, fetchPage, loadFirst]);

  useEffect(() => {
    if (!enabled) return undefined;
    const initial = setTimeout(loadFirst, 0);
    const poll = () => { if (document.visibilityState === "visible" && pagesRef.current <= 1) void loadFirst(); };
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [enabled, loadFirst]);

  const current = state.key === key;
  return {
    events: current ? state.events : [],
    hasMore: current && state.hasMore,
    error: current ? state.error : "",
    loading: enabled && !current,
    loadingMore,
    lastUpdated: current ? state.lastUpdated : null,
    facets: facets.scope === facetScope ? facets : { services: [], environments: [], levels: [] },
    refresh: loadFirst,
    loadMore,
  };
}

/** Latest events for one project (used by the Overview). */
export function useProjectErrors(projectId, limit = 100) {
  return useErrorSearch({ projectId, filters: { limit, sort: "-received_at" } });
}

export function timeAgo(value) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + "m ago";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.round(hours / 24);
  if (days < 30) return days + "d ago";
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}
