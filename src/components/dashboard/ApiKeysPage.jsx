"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { CopyButton, NewKeyCredentials, ProjectRequired, createApiKey } from "./apiKeys";

export default function ApiKeysPage() {
  const { projects, selectedProject, loading: projectsLoading } = useDashboardData();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [scope, setScope] = useState("project"); // project | all
  const [query, setQuery] = useState("");

  const loadKeys = useCallback(async () => {
    try {
      const response = await fetch("/api/keys", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || "Could not load your API keys.");
      setKeys(Array.isArray(data?.keys) ? data.keys : []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load your API keys.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { void loadKeys(); }, 0);
    return () => clearTimeout(timer);
  }, [loadKeys]);

  const projectNames = new Map(projects.map(project => [project.id, project.name]));
  const legacyCount = keys.filter(key => !key.project_id).length;
  const scopedKeys = scope === "project" ? keys.filter(key => key.project_id && key.project_id === selectedProject?.id) : keys;
  const search = query.trim().toLowerCase();
  const visibleKeys = search
    ? scopedKeys.filter(key => key.client_name.toLowerCase().includes(search) || key.access_key.toLowerCase().includes(search))
    : scopedKeys;
  const showProjectColumn = scope === "all";

  function projectLabel(key) {
    if (!key.project_id) return <span className="api-key-legacy" title="Created before keys belonged to projects. The API refuses events sent with it.">No project · can’t send events</span>;
    return projectNames.get(key.project_id) || <span className="api-key-other" title={key.project_id}>Another account</span>;
  }

  const canCreate = Boolean(selectedProject);

  return (
    <div className="api-keys-page">
      <div className="page-heading">
        <div><div className="page-eyebrow">MANAGE</div><h1>API keys</h1><p>{selectedProject ? <>Keys that send errors to <b className="integrate-project-name">{selectedProject.name}</b>. Secret keys are never shown after creation.</> : "Keys belong to a project. Secret keys are never shown after creation."}</p></div>
        <button className="date-button" type="button" onClick={() => setIsCreateOpen(true)} disabled={!canCreate} title={canCreate ? undefined : "Select a project first"}><DashboardIcon name="plus" size={15}/> Create API key</button>
      </div>

      {legacyCount > 0 && <div className="api-banner" role="note"><span>{legacyCount === 1 ? "1 key was" : legacyCount + " keys were"} created before keys belonged to projects. The API now refuses events sent with {legacyCount === 1 ? "it" : "them"}. Create a new key under a project and update your service.</span><button type="button" onClick={() => setScope("all")}>Show</button></div>}

      <section className="panel api-keys-panel">
        <div className="api-keys-toolbar">
          <div className="integrate-tabs api-keys-scope" role="tablist" aria-label="Which keys to show">
            <button type="button" role="tab" aria-selected={scope === "project"} className={scope === "project" ? "selected" : ""} onClick={() => setScope("project")}>{selectedProject ? selectedProject.name : "This project"}</button>
            <button type="button" role="tab" aria-selected={scope === "all"} className={scope === "all" ? "selected" : ""} onClick={() => setScope("all")}>All my keys</button>
          </div>
          {scopedKeys.length > 5 && <label className="api-keys-search"><DashboardIcon name="search" size={14}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by name or access key" aria-label="Search API keys" /></label>}
        </div>
        {error && <div className="api-banner" role="alert"><span>{error}</span><button type="button" onClick={() => { setLoading(true); void loadKeys(); }}>Retry</button></div>}
        {loading || projectsLoading ? <div className="projects-empty">Loading API keys…</div>
          : scope === "project" && !selectedProject ? <ProjectRequired what="API keys" />
          : scopedKeys.length === 0 && !error ? (
            <div className="empty-state">
              <span className="empty-icon"><DashboardIcon name="key" size={22}/></span>
              <h3>{scope === "project" ? "No keys for this project yet" : "No API keys yet"}</h3>
              <p>Create a key for each service or environment that sends errors{selectedProject ? " to " + selectedProject.name : ""}.</p>
              {canCreate && <button className="date-button" type="button" onClick={() => setIsCreateOpen(true)}><DashboardIcon name="plus" size={15}/> Create API key</button>}
            </div>
          ) : (
            <div className="api-keys-table-wrap">
              <table className="api-keys-table">
                <thead><tr><th>Name</th>{showProjectColumn && <th>Project</th>}<th>Access key</th><th>Secret key</th><th>Created</th></tr></thead>
                <tbody>
                  {visibleKeys.map(key => <tr key={key.access_key} className={key.project_id ? "" : "legacy"}>
                    <td className="api-key-name">{key.client_name}</td>
                    {showProjectColumn && <td className="api-key-project">{projectLabel(key)}</td>}
                    <td><div className="api-key-access"><code title={key.access_key}>{key.access_key}</code><CopyButton value={key.access_key} /></div></td>
                    <td><span className="api-key-secret" title="Secret keys are only shown once, when the key is created">•••••••• Hidden</span></td>
                    <td className="api-key-created" title={new Date(key.created_at).toLocaleString()}>{new Date(key.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</td>
                  </tr>)}
                  {visibleKeys.length === 0 && <tr><td colSpan={showProjectColumn ? 5 : 4} className="api-keys-no-match">No keys match “{query}”.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        <p className="integrate-hint">Lost a secret key? Create a new key and update your service. New to sending errors? <Link href="/dashboard/integrate">Open the setup guide</Link>.</p>
      </section>

      {isCreateOpen && selectedProject && <CreateKeyDialog project={selectedProject} onClose={() => setIsCreateOpen(false)} onCreated={() => { setScope("project"); void loadKeys(); }} />}
    </div>
  );
}

function CreateKeyDialog({ project, onClose, onCreated }) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      setCredentials(await createApiKey(name, project));
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the API key.");
    } finally {
      setSaving(false);
    }
  }

  function requestClose() {
    if (saving) return;
    if (credentials && !window.confirm("Have you copied the secret key? You won’t be able to see or copy it again.")) return;
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <section className="create-project-modal api-key-modal" role="dialog" aria-modal="true" aria-labelledby="create-key-title">
        <div className="modal-heading"><div><span className="modal-icon"><DashboardIcon name="key" size={17}/></span><h2 id="create-key-title">{credentials ? "Save your API key" : "Create an API key"}</h2><p>{credentials ? "Add both values to your service’s environment." : <>Errors sent with this key go to <b>{project.name}</b>.</>}</p></div><button className="modal-close" type="button" onClick={requestClose} aria-label="Close dialog">×</button></div>
        {credentials ? <>
          <NewKeyCredentials credentials={credentials} />
          <div className="modal-actions api-key-modal-actions"><button className="submit-button modal-submit" type="button" onClick={requestClose}>I’ve saved my secret key</button></div>
        </> : <form className="project-create-form" onSubmit={handleSubmit}>
          <label className="settings-field"><span>Key name</span><input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={100} required placeholder="e.g. checkout-api-production" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="modal-cancel" type="button" onClick={onClose} disabled={saving}>Cancel</button><button className="submit-button modal-submit" type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create key"}<DashboardIcon name="arrow" size={15}/></button></div>
        </form>}
      </section>
    </div>
  );
}
