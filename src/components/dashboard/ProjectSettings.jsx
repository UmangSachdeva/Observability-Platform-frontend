"use client";

import { useState } from "react";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";

export default function ProjectSettings() {
  const { projects, selectedProjectId, selectProject, loading, createProject } = useDashboardData();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const project = await createProject({ name: name.trim(), description: description.trim() });
      selectProject(project.id);
      setName("");
      setDescription("");
      setIsCreateOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading project-page-heading">
        <div><div className="page-eyebrow">MANAGE</div><h1>Projects</h1><p>Select a project or create a new one for this account.</p></div>
        <button className="date-button create-project-trigger" type="button" onClick={() => { setError(""); setIsCreateOpen(true); }}><DashboardIcon name="plus" size={15}/> Create project</button>
      </div>

      {loading ? <div className="projects-loading">Loading projects…</div> : projects.length ? (
        <section className="project-card-grid" aria-label="Projects">
          {projects.map(project => {
            const selected = project.id === selectedProjectId;
            return <article className={"project-card" + (selected ? " selected" : "")} key={project.id}>
              <div className="project-card-top"><span className="project-symbol">{project.name.slice(0, 1).toUpperCase()}</span><span className="project-card-status">{selected ? <><DashboardIcon name="check" size={13}/> Selected</> : "Project"}</span></div>
              <h2>{project.name}</h2>
              <p className="project-card-description">{project.description || "No description provided."}</p>
              <div className="project-card-meta"><span>Project ID</span><code title={project.id}>{project.id}</code></div>
              <div className="project-card-meta"><span>Created</span><span>{new Date(project.created_at).toLocaleDateString()}</span></div>
              <button className={selected ? "project-select-button selected" : "project-select-button"} type="button" onClick={() => selectProject(project.id)} disabled={selected}>{selected ? "Current project" : "Select project"}</button>
            </article>;
          })}
          <button className="project-card add-project-card" type="button" onClick={() => { setError(""); setIsCreateOpen(true); }}>
            <span className="add-project-icon"><DashboardIcon name="plus" size={20}/></span><b>Create a project</b><span>Set up a new project in this account.</span>
          </button>
        </section>
      ) : (
        <section className="project-empty-panel">
          <span className="empty-icon"><DashboardIcon name="grid" size={22}/></span>
          <h2>No projects yet</h2>
          <p>Create your first project to organize telemetry from your services.</p>
          <button className="date-button" type="button" onClick={() => setIsCreateOpen(true)}><DashboardIcon name="plus" size={15}/> Create project</button>
        </section>
      )}

      {isCreateOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !saving) setIsCreateOpen(false); }}>
        <section className="create-project-modal" role="dialog" aria-modal="true" aria-labelledby="create-project-title">
          <div className="modal-heading"><div><span className="modal-icon"><DashboardIcon name="plus" size={17}/></span><h2 id="create-project-title">Create a project</h2><p>Projects help organize services and telemetry.</p></div><button className="modal-close" type="button" onClick={() => setIsCreateOpen(false)} aria-label="Close dialog">×</button></div>
          <form className="project-create-form" onSubmit={handleSubmit}>
            <label className="settings-field"><span>Project name</span><input autoFocus value={name} onChange={event => setName(event.target.value)} maxLength={80} required placeholder="e.g. Checkout API" /></label>
            <label className="settings-field"><span>Description <small>Optional, up to 1000 characters</small></span><textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} rows={3} placeholder="What does this project monitor?" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions"><button className="modal-cancel" type="button" onClick={() => setIsCreateOpen(false)} disabled={saving}>Cancel</button><button className="submit-button modal-submit" type="submit" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create project"}<DashboardIcon name="arrow" size={15}/></button></div>
          </form>
        </section>
      </div>}
    </>
  );
}
