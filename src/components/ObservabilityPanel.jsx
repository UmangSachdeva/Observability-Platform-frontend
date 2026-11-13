import Brand from "./Brand";

export default function ObservabilityPanel() {
  return (
    <section className="visual-panel" aria-label="Tracewell observability overview">
      <div className="visual-grid" aria-hidden="true" />
      <header className="visual-header">
        <Brand />
        <a className="docs-link" href="https://opentelemetry.io/docs/" target="_blank" rel="noreferrer">Open docs <span aria-hidden="true">↗</span></a>
      </header>
      <div className="visual-content">
        <div className="eyebrow"><span className="pulse-dot" /> ONE CLEAR VIEW OF YOUR SYSTEM</div>
        <h1>Find the signal.<br /><span>Fix what matters.</span></h1>
        <p className="visual-copy">Metrics, logs, and traces in one place, so your team can move from alert to answer with confidence.</p>
        <div className="telemetry-card">
          <div className="telemetry-heading">
            <div className="telemetry-name"><span className="metric-icon">⌁</span><span>REQUEST LATENCY</span><span className="period">· 1 hour</span></div>
            <span className="status-pill"><i /> OPERATIONAL</span>
          </div>
          <div className="chart-area">
            <div className="chart-y"><span>240 ms</span><span>160 ms</span><span>80 ms</span><span>0 ms</span></div>
            <svg className="chart" viewBox="0 0 560 156" preserveAspectRatio="none" role="img" aria-label="Request latency trending steadily around 80 milliseconds">
              <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9487ff" stopOpacity=".28"/><stop offset="1" stopColor="#9487ff" stopOpacity="0"/></linearGradient></defs>
              <path className="chart-grid" d="M0 16H560M0 57H560M0 98H560M0 139H560"/>
              <path d="M0 105 C22 102 33 83 52 90S81 119 101 104 127 86 149 91 175 117 194 101 223 76 243 84 271 122 291 108 320 69 340 77 370 91 389 73 414 63 435 75 460 101 480 82 510 54 529 63 548 83 560 56V156H0Z" fill="url(#fill)"/>
              <path className="chart-stroke" d="M0 105 C22 102 33 83 52 90S81 119 101 104 127 86 149 91 175 117 194 101 223 76 243 84 271 122 291 108 320 69 340 77 370 91 389 73 414 63 435 75 460 101 480 82 510 54 529 63 548 83 560 56"/>
              <circle cx="560" cy="56" r="4" fill="#c5bdff" stroke="#202038" strokeWidth="3"/>
            </svg>
          </div>
          <div className="chart-x"><span>10:00</span><span>10:15</span><span>10:30</span><span>10:45</span><span>11:00</span></div>
          <div className="telemetry-stats">
            <div><strong>82<span>ms</span></strong><small>p50 latency</small></div><div><strong>146<span>ms</span></strong><small>p95 latency</small></div><div><strong>99.98<span>%</span></strong><small>availability</small></div><div className="improvement">↘ 18.2%<small>this week</small></div>
          </div>
        </div>
        <div className="visual-note"><span className="avatar-pile"><i>J</i><i>M</i><i>A</i><i>+</i></span><span>Made for teams that <b>ship with confidence.</b></span></div>
      </div>
      <footer className="visual-footer"><span>© 2026 Tracewell</span><span><i className="pulse-dot" /> ALL SYSTEMS OPERATIONAL</span></footer>
    </section>
  );
}
