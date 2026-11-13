"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Brand from "../Brand";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import SearchableDropdown from "../ui/SearchableDropdown";
import InviteDialog from "./InviteDialog";
import GlobalSearch, { useGlobalSearchShortcut } from "./GlobalSearch";

const navGroups = [
  { label: "Workspace", items: [{ label: "Overview", href: "/dashboard", icon: "grid" }] },
  { label: "Observability", items: [
    { label: "Errors", href: "/dashboard/errors", icon: "alert" },
    { label: "Traces", href: "/dashboard/traces", icon: "activity" },
    { label: "Integrate", href: "/dashboard/integrate", icon: "code" },
  ] },
  { label: "Manage", items: [
    { label: "Project settings", href: "/dashboard/settings/project", icon: "sliders" },
    { label: "API keys", href: "/dashboard/api-keys", icon: "key" },
    { label: "Account settings", href: "/dashboard/settings/account", icon: "users" },
  ] },
];

export default function DashboardShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { account, user, projects, selectedProjectId, selectProject, loading, error, refresh, pendingInvites, openAllInvites } = useDashboardData();
  const [loggingOut, setLoggingOut] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  useGlobalSearchShortcut(setSearchOpen);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Continue signing out locally if the request fails.
    } finally {
      try { window.localStorage.removeItem("tracewell:selected-project"); } catch {}
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand href="/dashboard" label="Tracewell dashboard" />
          <button className="workspace-switch" type="button">
            <span className="workspace-avatar">{account?.name?.charAt(0)?.toUpperCase() || "W"}</span>
            <span className="workspace-copy"><b>{loading ? "Loading account…" : account?.name || "Workspace"}</b><small>{account ? account.members?.length + " member(s)" : "No account"}</small></span>
            <DashboardIcon name="down" size={15}/>
          </button>
        </div>
        <nav className="side-nav" aria-label="Main navigation">
          {navGroups.map(group => <div className="nav-group" key={group.label}>
            <p className="nav-label">{group.label}</p>
            {group.items.map(item => {
              const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              return <Link className={"nav-item" + (active ? " active" : "")} href={item.href} key={item.href} aria-current={active ? "page" : undefined}>
                <DashboardIcon name={item.icon}/><span>{item.label}</span>
              </Link>;
            })}
          </div>)}
        </nav>
        <div className="sidebar-bottom">
          <Link className="plan-card workspace-project-link" href="/dashboard/settings/project">
            <span className="plan-spark"><DashboardIcon name="activity" size={15}/></span>
            <b>Projects</b><p>{loading ? "Loading projects…" : projects.length + " project(s) in this account"}</p>
            <span className="workspace-card-link">Manage projects <DashboardIcon name="arrow" size={14}/></span>
          </Link>
          <div className="profile-row"><span className="profile-avatar">{(user?.username || "Me").slice(0, 2).toUpperCase()}</span><span className="profile-copy"><b>{user?.username || "Account member"}</b><small title={user?.email}>{user?.email || "Signed in"}</small></span><button className="logout-button sidebar-logout" type="button" aria-label="Log out" title="Log out" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Log out"}<DashboardIcon name="logout" size={14}/></button></div>
        </div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="breadcrumb"><span>{account?.name || "Workspace"}</span><DashboardIcon name="chevron" size={14}/><b>{getSection(pathname)}</b></div>
          <div className="topbar-actions">
            <button className="search-trigger" type="button" onClick={() => setSearchOpen(true)} aria-label="Search this account" aria-keyshortcuts="Meta+K Control+K"><DashboardIcon name="search" size={16}/><span>Search account</span><kbd>⌘ K</kbd></button>
            <button className="icon-button invites-bell" type="button" aria-label={pendingInvites.length ? `Invitations (${pendingInvites.length} pending)` : "Invitations"} title="Invitations" onClick={openAllInvites}><DashboardIcon name="bell"/>{pendingInvites.length > 0 && <span className="invites-bell-badge">{pendingInvites.length > 9 ? "9+" : pendingInvites.length}</span>}</button>
            <span className="topbar-divider"/>
            <SearchableDropdown
              label="Select project"
              className="project-selector"
              leadingIcon={<i/>}
              options={projects.map(project => ({ value: project.id, label: project.name, description: project.description }))}
              value={selectedProjectId}
              onChange={selectProject}
              placeholder={loading ? "Loading projects…" : "No project selected"}
              searchPlaceholder="Search projects…"
              disabled={loading || projects.length === 0}
            />
            <button className="logout-button topbar-logout" type="button" aria-label="Log out" onClick={handleLogout} disabled={loggingOut}>{loggingOut ? "Signing out…" : "Log out"}<DashboardIcon name="logout" size={15}/></button>
          </div>
        </header>
        <main className="dashboard-content">
          {error && <div className="api-banner" role="alert"><span>{error}</span><button type="button" onClick={() => void refresh()}>Retry</button></div>}
          {children}
        </main>
        <Suspense fallback={null}><InviteDialog /></Suspense>
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
      </div>
    </div>
  );
}

function getSection(pathname) {
  if (pathname.includes("/errors")) return "Errors";
  if (pathname.includes("/traces")) return "Traces";
  if (pathname.includes("/integrate")) return "Integrate";
  if (pathname.includes("/api-keys")) return "API keys";
  if (pathname.includes("/settings/project")) return "Project settings";
  if (pathname.includes("/settings/account")) return "Account settings";
  return "Overview";
}
