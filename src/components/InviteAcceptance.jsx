import Link from "next/link";
import AuthLayout from "./AuthLayout";
import Brand from "./Brand";

// Shown to visitors who open an invite link without being signed in. After signing in or
// creating an account they return to /invite/[token], which opens the accept/decline popup.
export default function InviteAcceptance({ token }) {
  const next = "/invite/" + encodeURIComponent(token);
  const loginHref = "/login?next=" + encodeURIComponent(next);
  const signupHref = "/?next=" + encodeURIComponent(next);

  return (
    <AuthLayout mode="login">
      <section className="invite-accept-card">
        <Brand href={next} label="Return to this invitation" />
        <span className="auth-kicker">ACCOUNT INVITATION</span>
        <h1>You’ve been invited</h1>
        <p>Sign in with the email address that received this invitation to review it. New to Tracewell? Create an account with that same email first. You can accept or decline the invitation once you’re signed in.</p>
        <div className="invite-auth-actions">
          <Link className="submit-button" href={loginHref}>Sign in to review</Link>
          <Link className="invite-secondary-link" href={signupHref}>Create an account</Link>
        </div>
      </section>
    </AuthLayout>
  );
}
