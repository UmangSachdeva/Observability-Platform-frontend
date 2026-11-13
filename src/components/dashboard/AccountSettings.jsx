"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import AccountMembers from "./AccountMembers";

const ADMIN_ROLES = new Set(["admin", "owner"]);

export default function AccountSettings() {
  const { account, user, loading } = useDashboardData();
  const members = Array.isArray(account?.members) ? account.members : [];
  const currentMember = user ? members.find(member => member.user_id === user.id) : null;
  const isAdmin = ADMIN_ROLES.has(currentMember?.role);
  const isLastAdmin = isAdmin && !members.some(member => member.user_id !== user?.id && ADMIN_ROLES.has(member.role));
  const [isLeaveOpen, setIsLeaveOpen] = useState(false);

  return (
    <div className="account-settings-page">
      <div className="page-heading settings-heading"><div><div className="page-eyebrow">MANAGE</div><h1>Account settings</h1><p>Account details, members, and invitations.</p></div></div>
      <div className="settings-content account-settings-content">
          <section className="panel settings-card" id="account">
            <div className="settings-card-heading"><div><h2>Account</h2><p>Organization information.</p></div><span className="settings-mark"><DashboardIcon name="users" size={17}/></span></div>
            {loading ? <div className="projects-empty">Loading account…</div> : account ? <dl className="account-details">
              <div><dt>Account name</dt><dd>{account.name}</dd></div>
              <div><dt>Account ID</dt><dd><code>{account.id}</code></dd></div>
              {currentMember && <div><dt>Your role</dt><dd>{currentMember.role}</dd></div>}
              <div><dt>Created</dt><dd>{new Date(account.created_at).toLocaleString()}</dd></div>
              <div><dt>Last updated</dt><dd>{new Date(account.updated_at).toLocaleString()}</dd></div>
            </dl> : <div className="projects-empty">Account information is unavailable.</div>}
          </section>
          <AccountMembers />
          {account && <div className="leave-account-footer">
            {isLastAdmin && <small>You’re the only admin. Make another member an admin before leaving.</small>}
            <button className="leave-account-button" type="button" onClick={() => setIsLeaveOpen(true)} disabled={loading || isLastAdmin}><DashboardIcon name="logout" size={13}/>Leave account</button>
          </div>}
      </div>
      {isLeaveOpen && account && <LeaveAccountDialog accountName={account.name} onClose={() => setIsLeaveOpen(false)} />}
    </div>
  );
}

function LeaveAccountDialog({ accountName, onClose }) {
  const router = useRouter();
  const { leaveAccount } = useDashboardData();
  const [confirmation, setConfirmation] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");
  const confirmed = confirmation.trim() === accountName;

  async function handleLeave(event) {
    event.preventDefault();
    if (!confirmed) return;
    setError("");
    setLeaving(true);
    try {
      await leaveAccount();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not leave this account.");
      setLeaving(false);
      return;
    }
    // The API picks the account a user lands in when they sign in, so end this session and
    // sign in again to continue in the user's remaining account (if any).
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    router.replace("/login?notice=left-account");
    router.refresh();
  }

  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget && !leaving) onClose(); }}>
      <section className="create-project-modal" role="dialog" aria-modal="true" aria-labelledby="leave-account-title">
        <div className="modal-heading"><div><span className="modal-icon danger"><DashboardIcon name="logout" size={17}/></span><h2 id="leave-account-title">Leave {accountName}?</h2><p>You’ll be signed out after leaving.</p></div><button className="modal-close" type="button" onClick={onClose} disabled={leaving} aria-label="Close dialog">×</button></div>
        <form className="project-create-form" onSubmit={handleLeave}>
          <p className="leave-dialog-copy">You’ll immediately lose access to this account’s projects and telemetry. To rejoin, an admin has to send you a new invitation. When you sign in again, you’ll go to another account you belong to.</p>
          <label className="settings-field"><span>Type <b>{accountName}</b> to confirm</span><input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="modal-cancel" type="button" onClick={onClose} disabled={leaving}>Cancel</button><button className="submit-button modal-submit danger-submit" type="submit" disabled={leaving || !confirmed}>{leaving ? "Leaving…" : "Leave account"}</button></div>
        </form>
      </section>
    </div>
  );
}
