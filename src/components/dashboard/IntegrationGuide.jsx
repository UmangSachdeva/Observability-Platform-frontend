"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import { useDashboardData } from "./DashboardDataProvider";
import { CopyButton, NewKeyCredentials, ProjectRequired, createApiKey, maskSecret } from "./apiKeys";

const LANGUAGES = [
  { id: "node", label: "Node.js" },
  { id: "python", label: "Python" },
  { id: "go", label: "Go" },
  { id: "curl", label: "cURL" },
];

export default function IntegrationGuide({ endpoint }) {
  const { selectedProject, loading } = useDashboardData();
  // Credentials created on this page. Kept in memory only: the secret is gone on reload.
  const [createdCredentials, setCredentials] = useState(null);
  // Keys belong to a project: only show the key made for the project that is selected now.
  const credentials = createdCredentials && createdCredentials.projectId === selectedProject?.id ? createdCredentials : null;
  const [language, setLanguage] = useState("node");
  const serviceName = slugify(selectedProject?.name) || "my-service";

  return (
    <div className="integrate-page">
      <div className="page-heading">
        <div><div className="page-eyebrow">SETUP</div><h1>Send errors to Tracewell</h1><p>{selectedProject ? <>Set up error reporting for <b className="integrate-project-name">{selectedProject.name}</b>. Errors sent with this project’s keys appear under it.</> : "Create an API key for a project, add a few lines to your service, and confirm your first event arrives."}</p></div>
      </div>

      <ol className="integrate-steps">
        <Step number={1} title="Create an API key" description={selectedProject ? `Keys belong to a project. This key sends errors to “${selectedProject.name}”. Use one key per service or environment.` : "Keys belong to a project, so errors are grouped by project."}>
          {selectedProject
            ? <CreateKeyForm key={selectedProject.id} project={selectedProject} defaultName={serviceName + "-production"} credentials={credentials} onCreated={setCredentials} />
            : loading ? <p className="integrate-hint">Loading projects…</p> : <ProjectRequired what="API keys" />}
        </Step>

        <Step number={2} title="Add the credentials to your service" description="Store them as environment variables or in your secrets manager. Never commit them or ship them to browsers or mobile apps.">
          <CodeBlock code={envBlock(endpoint, credentials, true)} copyValue={envBlock(endpoint, credentials, false)} label=".env" />
          <p className="integrate-hint">{credentials ? "The secret is hidden here, but Copy includes the real value. You can copy it only until you leave this page." : "Create a key in step 1 to fill in your values. A secret key can be copied only once, right after the key is created."}</p>
        </Step>

        <Step number={3} title="Report errors from your code" description="Every request is signed with your secret key. You don’t send a project ID: the key decides which project the event belongs to. These snippets have no dependencies; copy one into your service and call it wherever you handle errors.">
          <div className="integrate-tabs" role="tablist" aria-label="Language">
            {LANGUAGES.map(option => <button key={option.id} type="button" role="tab" aria-selected={language === option.id} className={language === option.id ? "selected" : ""} onClick={() => setLanguage(option.id)}>{option.label}</button>)}
          </div>
          <CodeBlock code={SNIPPETS[language](serviceName)} label={LANGUAGES.find(option => option.id === language).label} />
          <details className="integrate-details">
            <summary>How request signing works</summary>
            <p>Send three headers with each <code>POST /v1/errors</code> request:</p>
            <ul>
              <li><code>X-Access-Key</code>: your access key.</li>
              <li><code>X-Timestamp</code>: current Unix time in seconds. It must be within 5 minutes of the server’s clock.</li>
              <li><code>X-Signature</code>: lowercase hex HMAC-SHA256 of the string below, keyed with your secret key.</li>
            </ul>
            <CodeBlock code={"<timestamp>\\n<HTTP method>\\n<path and query>\\n<hex SHA-256 of the exact body bytes>"} label="String to sign" />
            <p>Hash the exact bytes you send. If you serialize the JSON again after signing, the signature won’t match and the API returns <code>401</code>.</p>
          </details>
        </Step>

        <Step number={4} title="Send a test event" description="Check that your key works end to end before deploying.">
          <TestEvent credentials={credentials} serviceName={serviceName} />
        </Step>
      </ol>

      <section className="panel integrate-reference">
        <div className="settings-card-heading"><div><h2>Event fields</h2><p>JSON body of <code>POST {endpoint}/v1/errors</code>. Maximum size is 1 MiB.</p></div></div>
        <table>
          <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td><code>service</code><span className="required">required</span></td><td>string</td><td>Name of the service that raised the error, such as <code>checkout-api</code>.</td></tr>
            <tr><td><code>message</code><span className="required">required</span></td><td>string</td><td>Short description of the error.</td></tr>
            <tr><td><code>level</code></td><td>string</td><td>Severity, such as <code>error</code> or <code>warning</code>. Defaults to <code>error</code>.</td></tr>
            <tr><td><code>environment</code></td><td>string</td><td>Where it happened, such as <code>production</code> or <code>staging</code>.</td></tr>
            <tr><td><code>timestamp</code></td><td>RFC 3339</td><td>When the error occurred. Defaults to the time it was received.</td></tr>
            <tr><td><code>stack_trace</code></td><td>string</td><td>Full stack trace.</td></tr>
            <tr><td><code>attributes</code></td><td>object</td><td>Extra context as string key/value pairs, such as a request ID. Values must be strings.</td></tr>
          </tbody>
        </table>
        <p className="integrate-hint">A successful request returns <code>202 Accepted</code> with the event <code>id</code>. A <code>401</code> means the key, timestamp, or signature is wrong. A <code>403</code> with <code>key_not_scoped</code> means the key was created before keys belonged to projects; create a new one. A <code>400</code> means <code>service</code> or <code>message</code> is missing.</p>
      </section>
    </div>
  );
}

function Step({ number, title, description, children }) {
  return (
    <li className="panel integrate-step">
      <span className="integrate-step-number">{number}</span>
      <div className="integrate-step-body">
        <h2>{title}</h2>
        <p className="integrate-step-description">{description}</p>
        {children}
      </div>
    </li>
  );
}

function CreateKeyForm({ project, defaultName, credentials, onCreated }) {
  const [clientName, setClientName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const name = clientName || defaultName;

  async function handleSubmit(event) {
    event.preventDefault();
    if (credentials && !window.confirm("Create another key? You won’t be able to copy the current secret key again. Make sure you’ve saved it.")) return;
    setError("");
    setSubmitting(true);
    try {
      onCreated(await createApiKey(name, project));
      setClientName("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create the API key.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form className="integrate-key-form" onSubmit={handleSubmit}>
        <label className="settings-field"><span>Key name</span><input value={name} onChange={event => setClientName(event.target.value)} maxLength={100} required placeholder="checkout-api-production" /></label>
        <button className="submit-button integrate-key-submit" type="submit" disabled={submitting || !name.trim()}>{submitting ? "Creating…" : credentials ? "Create another key" : "Create API key"}<DashboardIcon name="plus" size={15}/></button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {credentials && <NewKeyCredentials credentials={credentials} />}
      <p className="integrate-hint">Already have keys? <Link href="/dashboard/api-keys">View this project’s API keys</Link>.</p>
    </>
  );
}

function TestEvent({ credentials, serviceName }) {
  const [status, setStatus] = useState("idle"); // idle | sending | sent | failed
  const [result, setResult] = useState("");

  async function sendTestEvent() {
    setStatus("sending");
    setResult("");
    try {
      const response = await fetch("/api/keys/test-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: credentials.accessKey, secret_key: credentials.secretKey, service: serviceName }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message || "The test event was rejected.");
      setStatus("sent");
      setResult(data.id);
    } catch (cause) {
      setStatus("failed");
      setResult(cause instanceof Error ? cause.message : "The test event was rejected.");
    }
  }

  if (!credentials) {
    return <p className="integrate-hint">Create a key in step 1 first. To test a key created earlier, run the cURL snippet from step 3 with your saved secret.</p>;
  }

  return (
    <div className="integrate-test">
      <button className="submit-button integrate-key-submit" type="button" onClick={sendTestEvent} disabled={status === "sending"}>{status === "sending" ? "Sending…" : "Send test event"}<DashboardIcon name="activity" size={15}/></button>
      {status === "sent" && <p className="integrate-test-result success" role="status"><DashboardIcon name="check" size={14}/> Event received. ID <code>{result}</code>. Your key and signing are working. <Link href="/dashboard/errors">View it in Errors</Link></p>}
      {status === "failed" && <p className="form-error" role="alert">{result}</p>}
    </div>
  );
}

function CodeBlock({ code, label, copyValue = code }) {
  return (
    <div className="integrate-code">
      <div className="integrate-code-header"><span>{label}</span><CopyButton value={copyValue} /></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

/** With `hideSecret`, the secret is masked for display; the copied text holds the real value. */
function envBlock(endpoint, credentials, hideSecret) {
  const secret = credentials?.secretKey ? (hideSecret ? maskSecret() : credentials.secretKey) : "<your secret key>";
  return [
    `TRACEWELL_ENDPOINT=${endpoint}`,
    `TRACEWELL_ACCESS_KEY=${credentials?.accessKey || "<your access key>"}`,
    `TRACEWELL_SECRET_KEY=${secret}`,
  ].join("\n");
}

function slugify(value) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

const SNIPPETS = {
  node: (service) => `// tracewell.js: Node.js 18+ (uses built-in fetch and crypto)
import { createHash, createHmac } from "node:crypto";

const PATH = "/v1/errors";

export async function reportError(error, { level = "error", attributes = {} } = {}) {
  const body = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: "${service}",
    environment: process.env.NODE_ENV ?? "production",
    level,
    message: error?.message ?? String(error),
    stack_trace: error?.stack ?? "",
    attributes, // string values only
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", process.env.TRACEWELL_SECRET_KEY)
    .update(\`\${timestamp}\\nPOST\\n\${PATH}\\n\${bodyHash}\`)
    .digest("hex");

  try {
    const response = await fetch(process.env.TRACEWELL_ENDPOINT + PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Access-Key": process.env.TRACEWELL_ACCESS_KEY,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body, // send the exact string that was hashed
    });
    if (!response.ok) console.warn("Tracewell rejected the event:", response.status, await response.text());
  } catch (reportFailure) {
    console.warn("Could not reach Tracewell:", reportFailure); // never crash because reporting failed
  }
}

// Capture anything that would otherwise crash the process.
process.on("uncaughtException", (error) => { void reportError(error, { level: "fatal" }); });
process.on("unhandledRejection", (reason) => { void reportError(reason); });

// Usage:
// try { await chargeCard(order); }
// catch (error) { await reportError(error, { attributes: { order_id: order.id } }); throw error; }
`,
  python: (service) => `# tracewell.py: Python 3.8+, standard library only
import hashlib, hmac, json, os, time, traceback, urllib.request
from datetime import datetime, timezone

PATH = "/v1/errors"

def report_error(error, level="error", attributes=None):
    body = json.dumps({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": "${service}",
        "environment": os.getenv("APP_ENV", "production"),
        "level": level,
        "message": str(error),
        "stack_trace": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
        "attributes": {k: str(v) for k, v in (attributes or {}).items()},
    }).encode("utf-8")
    timestamp = str(int(time.time()))
    body_hash = hashlib.sha256(body).hexdigest()
    to_sign = f"{timestamp}\\nPOST\\n{PATH}\\n{body_hash}".encode("utf-8")
    signature = hmac.new(os.environ["TRACEWELL_SECRET_KEY"].encode("utf-8"), to_sign, hashlib.sha256).hexdigest()

    request = urllib.request.Request(
        os.environ["TRACEWELL_ENDPOINT"] + PATH,
        data=body,  # send the exact bytes that were hashed
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Access-Key": os.environ["TRACEWELL_ACCESS_KEY"],
            "X-Timestamp": timestamp,
            "X-Signature": signature,
        },
    )
    try:
        urllib.request.urlopen(request, timeout=5).close()
    except Exception as report_failure:  # never crash because reporting failed
        print("Could not report error to Tracewell:", report_failure)

# Usage:
# try:
#     charge_card(order)
# except Exception as error:
#     report_error(error, attributes={"order_id": order.id})
#     raise
`,
  go: (service) => `// tracewell.go: standard library only
package tracewell

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime/debug"
	"strconv"
	"time"
)

const path = "/v1/errors"

var client = &http.Client{Timeout: 5 * time.Second}

func ReportError(err error, attributes map[string]string) {
	body, _ := json.Marshal(map[string]any{
		"timestamp":   time.Now().UTC().Format(time.RFC3339Nano),
		"service":     "${service}",
		"environment": os.Getenv("APP_ENV"),
		"level":       "error",
		"message":     err.Error(),
		"stack_trace": string(debug.Stack()),
		"attributes":  attributes,
	})
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	bodyHash := sha256.Sum256(body)
	mac := hmac.New(sha256.New, []byte(os.Getenv("TRACEWELL_SECRET_KEY")))
	fmt.Fprintf(mac, "%s\\nPOST\\n%s\\n%s", timestamp, path, hex.EncodeToString(bodyHash[:]))

	req, _ := http.NewRequest(http.MethodPost, os.Getenv("TRACEWELL_ENDPOINT")+path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Access-Key", os.Getenv("TRACEWELL_ACCESS_KEY"))
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", hex.EncodeToString(mac.Sum(nil)))

	resp, reqErr := client.Do(req)
	if reqErr != nil {
		log.Printf("tracewell: could not report error: %v", reqErr)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		log.Printf("tracewell: event rejected with status %d", resp.StatusCode)
	}
}

// Usage:
// if err := chargeCard(order); err != nil {
//     tracewell.ReportError(err, map[string]string{"order_id": order.ID})
// }
`,
  curl: (service) => `# Requires: openssl, curl. Reads TRACEWELL_* from your environment.
BODY='{"service":"${service}","environment":"production","level":"error","message":"payment request failed"}'
TS=$(date +%s)
BODY_HASH=$(printf '%s' "$BODY" | openssl dgst -sha256 -hex | sed 's/^.* //')
SIGNATURE=$(printf '%s\\n%s\\n%s\\n%s' "$TS" "POST" "/v1/errors" "$BODY_HASH" \\
  | openssl dgst -sha256 -hmac "$TRACEWELL_SECRET_KEY" -hex | sed 's/^.* //')

curl -X POST "$TRACEWELL_ENDPOINT/v1/errors" \\
  -H "Content-Type: application/json" \\
  -H "X-Access-Key: $TRACEWELL_ACCESS_KEY" \\
  -H "X-Timestamp: $TS" \\
  -H "X-Signature: $SIGNATURE" \\
  --data-binary "$BODY"
`,
};
