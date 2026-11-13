import AuthPanel from "./AuthPanel";
import ObservabilityPanel from "./ObservabilityPanel";

export default function AuthLayout({ mode, notice = "", children = null }) {
  return <main className="auth-shell"><ObservabilityPanel />{children ? <section className="auth-panel">{children}</section> : <AuthPanel mode={mode} notice={notice} />}</main>;
}
