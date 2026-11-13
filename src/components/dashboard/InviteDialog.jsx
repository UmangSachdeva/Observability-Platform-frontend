"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Invitation popups on the dashboard. Two sources, one at a time:
 *  1. ?invite=<token>: the user just opened an invite link (/invite/[token] redirects here).
 *  2. Pending invites for the user's email from GET /v1/invites, polled by the data provider.
 *     The user accepts one or snoozes it; snoozed invites come back when the snooze ends.
 */
export default function InviteDialog() {
  const linkToken = useSearchParams().get("invite");
  const { pendingInvites, showSnoozedInvites, closeAllInvites } = useDashboardData();
  const [accepted, setAccepted] = useState(null); // { accountName } after accepting from the list
  // Declining an invite link must not immediately re-show the same invite from the pending
  // list, so pending popups pause until the next page load.
  const [pendingPaused, setPendingPaused] = useState(false);

  if (linkToken) {
    return <LinkInviteDialog key={linkToken} inviteToken={linkToken} onDeclined={() => setPendingPaused(true)} />;
  }
  if (accepted) {
    return <AcceptedDialog accountName={accepted.accountName} onClose={() => setAccepted(null)} />;
  }
  if (pendingPaused && !showSnoozedInvites) return null;
  if (pendingInvites.length) {
    const invite = pendingInvites[0];
    return <PendingInviteDialog key={invite.id} invite={invite} position={1} total={pendingInvites.length} onAccepted={setAccepted} />;
  }
  if (showSnoozedInvites) return <NoInvitesDialog onClose={closeAllInvites} />;
  return null;
}

function PendingInviteDialog({ invite, position, total, onAccepted }) {
  const router = useRouter();
  const { user, acceptInvite, snoozeInvite, showSnoozedInvites, closeAllInvites } = useDashboardData();
  const [busy, setBusy] = useState(""); // "" | "accepting" | "snoozing"
  // Snooze choices are computed when the user clicks Snooze, relative to that moment.
  const [snoozeOptions, setSnoozeOptions] = useState(null);
  const [error, setError] = useState("");
  const [openedAt] = useState(() => Date.now());
  const accountName = invite.account_name || "an account";
  const isSnoozed = invite.snoozed_until && new Date(invite.snoozed_until).getTime() > openedAt;
  const canSnooze = new Date(invite.expires_at).getTime() - openedAt > 2 * 60 * 1000;

  function startSnooze() {
    setError("");
    setSnoozeOptions(getSnoozeOptions(invite.expires_at));
  }

  async function handleAccept() {
    setError("");
    setBusy("accepting");
    try {
      await acceptInvite({ invite_id: invite.id });
      onAccepted({ accountName: invite.account_name });
    } catch (cause) {
      if (cause?.status === 401) {
        router.replace("/login");
        return;
      }
      setBusy("");
      setError(cause instanceof Error ? cause.message : "We couldn’t accept this invitation.");
    }
  }

  async function handleSnooze(until) {
    setError("");
    setBusy("snoozing");
    try {
      await snoozeInvite(invite.id, until.toISOString());
      // On success the invite leaves the list and this dialog unmounts.
    } catch (cause) {
      setBusy("");
      setSnoozeOptions(null);
      setError(cause instanceof Error ? cause.message : "Could not snooze this invitation.");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="create-project-modal invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" aria-describedby="invite-dialog-description">
        {showSnoozedInvites && <button className="modal-close invite-dialog-close" type="button" onClick={closeAllInvites} disabled={Boolean(busy)} aria-label="Close invitations">×</button>}
        <div className="invite-dialog-hero"><DashboardIcon name="users" size={20}/></div>
        <span className="invite-dialog-kicker">ACCOUNT INVITATION{total > 1 ? ` · ${position} OF ${total}` : ""}</span>
        <h2 id="invite-dialog-title">Join {accountName}?</h2>
        <p id="invite-dialog-description">You’ve been invited as {articleFor(invite.role)} <b>{invite.role}</b>. Accepting adds you to the account and switches your dashboard to it. You can leave it later from Account settings.</p>
        <dl className="invite-dialog-details">
          {user?.email && <div><dt>Signed in as</dt><dd>{user.email}</dd></div>}
          <div><dt>Expires</dt><dd>{formatDateTime(invite.expires_at)}</dd></div>
          {isSnoozed && <div><dt>Snoozed until</dt><dd>{formatDateTime(invite.snoozed_until)}</dd></div>}
        </dl>
        {error && <p className="form-error" role="alert">{error}</p>}
        {snoozeOptions ? <div className="invite-snooze-options" role="group" aria-label="Snooze this invitation">
          <p>Hide this invitation until…</p>
          <div>{snoozeOptions.map(option => <button type="button" key={option.label} onClick={() => handleSnooze(option.until)} disabled={Boolean(busy)}>{option.label}<small>{formatDateTime(option.until)}</small></button>)}</div>
          <button className="invite-snooze-back" type="button" onClick={() => setSnoozeOptions(null)} disabled={Boolean(busy)}>{busy === "snoozing" ? "Snoozing…" : "Back"}</button>
        </div> : <div className="modal-actions">
          <button className="modal-cancel" type="button" onClick={startSnooze} disabled={Boolean(busy) || !canSnooze}><DashboardIcon name="bell" size={13}/> Snooze</button>
          <button className="submit-button modal-submit" type="button" onClick={handleAccept} disabled={Boolean(busy)} autoFocus>{busy === "accepting" ? "Accepting…" : "Accept invitation"}<DashboardIcon name="check" size={15}/></button>
        </div>}
      </section>
    </div>
  );
}

function AcceptedDialog({ accountName, onClose }) {
  const { account } = useDashboardData();
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="create-project-modal invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
        <div className="invite-dialog-hero success"><DashboardIcon name="check" size={20}/></div>
        <h2 id="invite-dialog-title">Invitation accepted</h2>
        <p>You’re now a member of <b>{accountName || account?.name || "the account"}</b>. Your dashboard has switched to this account.</p>
        <div className="modal-actions"><button className="submit-button modal-submit" type="button" onClick={onClose} autoFocus>Continue<DashboardIcon name="arrow" size={15}/></button></div>
      </section>
    </div>
  );
}

function NoInvitesDialog({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="create-project-modal invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title">
        <div className="invite-dialog-hero muted"><DashboardIcon name="bell" size={19}/></div>
        <h2 id="invite-dialog-title">No invitations</h2>
        <p>You don’t have any pending or snoozed invitations right now.</p>
        <div className="modal-actions"><button className="submit-button modal-submit" type="button" onClick={onClose} autoFocus>Close</button></div>
      </section>
    </div>
  );
}

// Invite link flow: the token comes from /invite/[token]. Accepting uses the token directly.
function LinkInviteDialog({ inviteToken, onDeclined }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, account, acceptInvite } = useDashboardData();
  const [status, setStatus] = useState("idle"); // idle | accepting | accepted | declined
  const [error, setError] = useState("");

  function closeDialog() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("invite");
    const query = params.toString();
    router.replace(pathname + (query ? "?" + query : ""), { scroll: false });
  }

  async function handleAccept() {
    setError("");
    setStatus("accepting");
    try {
      await acceptInvite({ invite_token: inviteToken });
      setStatus("accepted");
    } catch (cause) {
      if (cause?.status === 401) {
        router.replace("/login?next=" + encodeURIComponent("/invite/" + encodeURIComponent(inviteToken)));
        return;
      }
      setStatus("idle");
      setError(cause instanceof Error ? cause.message : "We couldn’t accept this invitation.");
    }
  }

  function handleDecline() {
    setError("");
    setStatus("declined");
    onDeclined();
  }

  useEffect(() => {
    if (status === "accepting") return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") {
        if (status === "idle") handleDecline();
        else closeDialog();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const busy = status === "accepting";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="create-project-modal invite-dialog" role="dialog" aria-modal="true" aria-labelledby="invite-dialog-title" aria-describedby="invite-dialog-description">
        {status === "accepted" ? <>
          <div className="invite-dialog-hero success"><DashboardIcon name="check" size={20}/></div>
          <h2 id="invite-dialog-title">Invitation accepted</h2>
          <p id="invite-dialog-description">You’re now a member of <b>{account?.name || "the account"}</b>. Your dashboard has switched to this account.</p>
          <div className="modal-actions"><button className="submit-button modal-submit" type="button" onClick={closeDialog} autoFocus>Go to dashboard<DashboardIcon name="arrow" size={15}/></button></div>
        </> : status === "declined" ? <>
          <div className="invite-dialog-hero muted"><DashboardIcon name="logout" size={19}/></div>
          <h2 id="invite-dialog-title">Invitation declined</h2>
          <p id="invite-dialog-description">You didn’t join the account. You can still find this invitation under the bell icon until it expires.</p>
          <div className="modal-actions"><button className="submit-button modal-submit" type="button" onClick={closeDialog} autoFocus>Close</button></div>
        </> : <>
          <div className="invite-dialog-hero"><DashboardIcon name="users" size={20}/></div>
          <span className="invite-dialog-kicker">ACCOUNT INVITATION</span>
          <h2 id="invite-dialog-title">You’ve been invited to join an account</h2>
          <p id="invite-dialog-description">Accepting adds you as a member and switches your dashboard to that account. You can leave it later from Account settings.</p>
          {user?.email && <div className="invite-dialog-identity"><span>Signed in as</span><b>{user.email}</b></div>}
          <p className="invite-dialog-note">The invitation only works for the email address it was sent to.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions">
            <button className="modal-cancel" type="button" onClick={handleDecline} disabled={busy}>Decline</button>
            <button className="submit-button modal-submit" type="button" onClick={handleAccept} disabled={busy} autoFocus>{busy ? "Accepting…" : "Accept invitation"}<DashboardIcon name="check" size={15}/></button>
          </div>
        </>}
      </section>
    </div>
  );
}

/** Snooze choices, never past the invitation's expiry (the API rejects that). */
function getSnoozeOptions(expiresAt) {
  const now = Date.now();
  const expires = new Date(expiresAt).getTime();
  const tomorrowMorning = new Date(now + DAY);
  tomorrowMorning.setHours(9, 0, 0, 0);
  const candidates = [
    { label: "1 hour", until: new Date(now + HOUR) },
    { label: "Tomorrow morning", until: tomorrowMorning },
    { label: "3 days", until: new Date(now + 3 * DAY) },
  ].filter(option => option.until.getTime() < expires);
  // A minute of margin so the request still lands before the expiry.
  if (expires - now > 2 * 60 * 1000) candidates.push({ label: "Until it expires", until: new Date(expires - 60 * 1000) });
  return candidates;
}

function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function articleFor(role) {
  return /^[aeiou]/i.test(role || "") ? "an" : "a";
}
