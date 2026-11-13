"use client";

import { useState } from "react";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import SearchableDropdown from "../ui/SearchableDropdown";

// Member list and invite form, rendered inside Account settings.
export default function AccountMembers() {
  const { account, user, loading, refresh } = useDashboardData();
  const members = Array.isArray(account?.members) ? account.members : [];
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [invitation, setInvitation] = useState(null);
  const [copied, setCopied] = useState(false);

  const inviteUrl = invitation?.invite_token && typeof window !== "undefined"
    ? window.location.origin + "/invite/" + encodeURIComponent(invitation.invite_token)
    : "";

  async function handleInvite(event) {
    event.preventDefault();
    setError("");
    setInvitation(null);
    setCopied(false);
    setSubmitting(true);

    try {
      const response = await fetch("/api/account/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error?.message || "Could not invite this user.");
      }
      setInvitation(data);
      setEmail("");
      void refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not invite this user.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteToken() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError("Could not copy automatically. Select and copy the invite link.");
    }
  }

  return (
    <>
      <section className="panel members-panel" id="members">
        <div className="members-panel-heading"><div><h2>Members</h2><p>{loading ? "Loading members…" : members.length + " member(s) with access to " + (account?.name || "this account") + "."}</p></div><span className="settings-mark"><DashboardIcon name="users" size={17}/></span></div>
        {members.length ? <div className="member-list">
          {members.map(member => <div className="member-row" key={member.user_id}>
            <span className="profile-avatar"><DashboardIcon name="users" size={15}/></span>
            <div><b>{member.user_id}{member.user_id === user?.id && <span className="member-you">You</span>}</b><small>Joined {new Date(member.joined_at).toLocaleDateString()}</small></div>
            <span className={"member-role " + member.role}>{member.role}</span>
          </div>)}
        </div> : <div className="members-empty">{loading ? "Loading account members…" : "No account members were returned by the API."}</div>}
      </section>

      <section className="panel invite-panel" id="invite">
        <div className="members-panel-heading"><div><h2>Invite a user</h2><p>Send an invitation to join this account with a selected role.</p></div><span className="settings-mark"><DashboardIcon name="plus" size={17}/></span></div>
        <form className="invite-form" onSubmit={handleInvite}>
          <label className="settings-field"><span>Email address</span><input type="email" value={email} onChange={event => setEmail(event.target.value)} maxLength={254} placeholder="teammate@company.com" required /></label>
          <div className="settings-field"><span>Role</span><SearchableDropdown label="Invitation role" className="role-dropdown" options={[{ value: "member", label: "Member", description: "Can access the account." }, { value: "admin", label: "Admin", description: "Can manage account membership." }]} value={role} onChange={setRole} searchPlaceholder="Search roles…"/><small>Only admins can create invitations.</small></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="invite-actions"><p>Only account admins can create invitations. The API will check your role.</p><button className="submit-button invite-submit" type="submit" disabled={submitting || loading}>{submitting ? "Creating invitation…" : "Create invitation"}<DashboardIcon name="arrow" size={15}/></button></div>
        </form>
        {invitation && <div className="invite-result" role="status">
          <div className="invite-result-heading"><span className="invite-result-icon"><DashboardIcon name="check" size={16}/></span><div><b>Invitation created</b><small>{invitation.email} · {invitation.role} · expires {new Date(invitation.expires_at).toLocaleString()}</small></div></div>
          <p>Email delivery is not configured in the API. Share this one-time invite link. When the invitee opens it and signs in with the invited email (or creates an account with it), they’ll be asked to accept or decline. The link expires in seven days.</p>
          <div className="invite-token-row"><code>{inviteUrl}</code><button type="button" onClick={copyInviteToken}><DashboardIcon name={copied ? "check" : "copy"} size={15}/>{copied ? "Copied" : "Copy invite link"}</button></div>
        </div>}
      </section>
    </>
  );
}
