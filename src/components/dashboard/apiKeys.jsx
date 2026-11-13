"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";

// Shared pieces for creating and showing API keys. Secret keys are never displayed: they can
// only be copied, and only right after creation (the API never returns them again).

/** Creates a key for one project; events sent with it are stored under that project. */
export async function createApiKey(clientName, project) {
  const response = await fetch("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: clientName.trim(), project_id: project.id }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Could not create the API key.");
  return {
    clientName: clientName.trim(),
    accessKey: data.access_key,
    secretKey: data.secret_key,
    algorithm: data.algorithm,
    projectId: data.project_id || project.id,
    projectName: project.name,
  };
}

export function maskSecret() {
  return "•".repeat(24);
}

export function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return <button className="integrate-copy" type="button" onClick={copy} aria-label={label + " to clipboard"}><DashboardIcon name={copied ? "check" : "copy"} size={13}/>{copied ? "Copied" : label}</button>;
}

/** Result shown once after a key is created: the access key in full, the secret masked. */
export function NewKeyCredentials({ credentials }) {
  return (
    <div className="integrate-credentials" role="status">
      <div className="invite-result-heading"><span className="invite-result-icon"><DashboardIcon name="check" size={16}/></span><div><b>API key “{credentials.clientName}” created</b><small>Project: {credentials.projectName} · {credentials.algorithm || "HMAC-SHA256"}</small></div></div>
      <p className="integrate-warning"><b>Copy your secret key now.</b> It stays hidden and can only be copied here, once. After you leave, it can’t be recovered; if you lose it, create a new key.</p>
      <div className="integrate-credential-row"><span>Access key</span><code>{credentials.accessKey}</code><CopyButton value={credentials.accessKey} /></div>
      <div className="integrate-credential-row"><span>Secret key</span><code className="masked" aria-label="Hidden secret key">{maskSecret()}</code><CopyButton value={credentials.secretKey} label="Copy secret" /></div>
    </div>
  );
}

/** Shown where a project must be selected first (keys and errors belong to a project). */
export function ProjectRequired({ what }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><DashboardIcon name="grid" size={22}/></span>
      <h3>Select a project first</h3>
      <p>{what} belong to a project. Create one, or pick a project from the selector at the top.</p>
      <Link href="/dashboard/settings/project">Go to projects <DashboardIcon name="arrow" size={14}/></Link>
    </div>
  );
}
