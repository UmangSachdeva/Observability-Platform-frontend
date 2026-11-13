"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const DashboardDataContext = createContext(null);
const PROJECT_STORAGE_KEY = "tracewell:selected-project";
const INVITE_POLL_INTERVAL_MS = 60_000;

function signInHref() {
  const next = window.location.pathname + window.location.search;
  return "/login?next=" + encodeURIComponent(next) + "&notice=session-expired";
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

export function DashboardDataProvider({ children }) {
  const router = useRouter();
  const [account, setAccount] = useState(null);
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingInvites, setPendingInvites] = useState([]);
  // When the user reopens invitations from the bell, snoozed ones are listed too.
  const [showSnoozedInvites, setShowSnoozedInvites] = useState(false);

  const selectProject = useCallback((projectId) => {
    setSelectedProjectId(projectId);
    if (typeof window !== "undefined") {
      if (projectId) window.localStorage.setItem(PROJECT_STORAGE_KEY, projectId);
      else window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [accountResponse, projectsResponse, userResponse] = await Promise.all([
        fetch("/api/account", { cache: "no-store" }),
        fetch("/api/projects", { cache: "no-store" }),
        fetch("/api/me", { cache: "no-store" }),
      ]);
      const [accountData, projectsData, userData] = await Promise.all([
        readJson(accountResponse),
        readJson(projectsResponse),
        readJson(userResponse),
      ]);
      setUser(userResponse.ok ? userData : null);

      if (accountResponse.status === 401) {
        // The session could not be renewed (refresh token expired or revoked): sign in again
        // and come back here afterwards.
        router.replace(signInHref());
        return;
      }
      if (!accountResponse.ok) {
        setAccount(null);
        setProjects([]);
        setSelectedProjectId("");
        setError(accountData?.error?.message || "Could not load your account.");
        return;
      }

      setAccount(accountData);
      if (!projectsResponse.ok) {
        setProjects([]);
        setSelectedProjectId("");
        setError(projectsData?.error?.message || "Could not load projects for this account.");
        return;
      }

      const loadedProjects = Array.isArray(projectsData?.projects) ? projectsData.projects : [];
      setProjects(loadedProjects);
      const savedId = window.localStorage.getItem(PROJECT_STORAGE_KEY);
      const selectedId = loadedProjects.some((project) => project.id === savedId)
        ? savedId
        : loadedProjects[0]?.id || "";
      setSelectedProjectId(selectedId);
      if (selectedId) window.localStorage.setItem(PROJECT_STORAGE_KEY, selectedId);
      else window.localStorage.removeItem(PROJECT_STORAGE_KEY);
    } catch {
      setError("Could not connect to the Observability Platform API.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createProject = useCallback(async (projectInput) => {
    setError("");
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectInput),
    });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data?.error?.message || "Could not create the project.");
    }
    setProjects((current) => [data, ...current.filter((project) => project.id !== data.id)]);
    setSelectedProjectId(data.id);
    window.localStorage.setItem(PROJECT_STORAGE_KEY, data.id);
    return data;
  }, []);

  const loadInvites = useCallback(async (includeSnoozed) => {
    try {
      const response = await fetch("/api/invites" + (includeSnoozed ? "?include_snoozed=true" : ""), { cache: "no-store" });
      if (!response.ok) return;
      const data = await readJson(response);
      setPendingInvites(Array.isArray(data?.invites) ? data.invites : []);
    } catch {
      // Invitations are a background check; keep the last known list on network errors.
    }
  }, []);

  // Check for invitations on load, then keep listening: poll while the tab is visible and
  // re-check whenever the user returns to it. Snoozed invites reappear once their time passes.
  useEffect(() => {
    let timer = null;
    const check = () => { if (document.visibilityState === "visible") void loadInvites(showSnoozedInvites); };
    const initial = setTimeout(check, 0);
    timer = setInterval(check, INVITE_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [loadInvites, showSnoozedInvites]);

  const openAllInvites = useCallback(() => setShowSnoozedInvites(true), []);
  const closeAllInvites = useCallback(() => {
    setShowSnoozedInvites(false);
    const now = Date.now();
    setPendingInvites((current) => current.filter((invite) => !invite.snoozed_until || new Date(invite.snoozed_until).getTime() <= now));
  }, []);

  const removeInvite = useCallback((inviteId) => {
    setPendingInvites((current) => current.filter((invite) => invite.id !== inviteId));
  }, []);

  const snoozeInvite = useCallback(async (inviteId, snoozedUntil) => {
    const response = await fetch("/api/invites/" + encodeURIComponent(inviteId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snoozed_until: snoozedUntil }),
    });
    const data = await readJson(response);
    if (!response.ok) {
      // Accepted or expired meanwhile: it no longer belongs in the list.
      if (response.status === 404 || response.status === 409 || response.status === 410) removeInvite(inviteId);
      throw new Error(data?.error?.message || "Could not snooze this invitation.");
    }
    removeInvite(inviteId);
    return data;
  }, [removeInvite]);

  /** Accepts by `{ invite_token }` (invite link) or `{ invite_id }` (pending list). */
  const acceptInvite = useCallback(async (identifier) => {
    const response = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(identifier),
    });
    const data = await readJson(response);
    if (!response.ok) {
      const error = new Error(data?.error?.message || "We couldn’t accept this invitation.");
      error.status = response.status;
      error.code = data?.error?.code;
      throw error;
    }
    if (identifier.invite_id) removeInvite(identifier.invite_id);
    // The accept route switches the session to the invited account; reload everything for it.
    await refresh();
    return data;
  }, [refresh, removeInvite]);

  const leaveAccount = useCallback(async () => {
    const response = await fetch("/api/account/leave", { method: "POST" });
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(data?.error?.message || "Could not leave this account.");
    }
    // The caller ends the session right after; the saved project belongs to the left account.
    try { window.localStorage.removeItem(PROJECT_STORAGE_KEY); } catch {}
    return data;
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  return (
    <DashboardDataContext.Provider value={{
      account,
      user,
      projects,
      selectedProject,
      selectedProjectId,
      selectProject,
      loading,
      error,
      refresh,
      createProject,
      acceptInvite,
      leaveAccount,
      pendingInvites,
      showSnoozedInvites,
      openAllInvites,
      closeAllInvites,
      snoozeInvite,
      removeInvite,
    }}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData() {
  const context = useContext(DashboardDataContext);
  if (!context) throw new Error("useDashboardData must be used inside DashboardDataProvider");
  return context;
}
