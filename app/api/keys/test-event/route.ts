import { createHash, createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { API_BASE_URL, apiUnavailableResponse } from "../../../../src/lib/auth-api";
import { ACCESS_TOKEN_COOKIE } from "../../../../src/lib/session";

const INGEST_PATH = "/v1/errors";

/**
 * Sends one signed test error with the credentials the user just created, so they can confirm
 * ingestion works before wiring up their service. Uses the exact signing scheme from the guide.
 * The secret is used for this request only and is not stored or logged.
 */
export async function POST(request: NextRequest) {
  if (!request.cookies.get(ACCESS_TOKEN_COOKIE)?.value) {
    return Response.json({ error: { code: "unauthorized", message: "Please sign in to send a test event." } }, { status: 401 });
  }

  let input: { access_key?: unknown; secret_key?: unknown; service?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "Request body must be valid JSON." } }, { status: 400 });
  }
  const accessKey = typeof input?.access_key === "string" ? input.access_key.trim() : "";
  const secretKey = typeof input?.secret_key === "string" ? input.secret_key.trim() : "";
  const service = typeof input?.service === "string" && input.service.trim() ? input.service.trim().slice(0, 100) : "tracewell-test";
  if (!accessKey || !secretKey || accessKey.length > 200 || secretKey.length > 200) {
    return Response.json({ error: { code: "validation_error", message: "An access key and secret key are required." } }, { status: 400 });
  }

  const body = JSON.stringify({
    timestamp: new Date().toISOString(),
    service,
    environment: "test",
    level: "error",
    message: "Test event from the Tracewell setup guide",
    stack_trace: "Error: Test event from the Tracewell setup guide\n    at setupGuide (tracewell)",
    attributes: { source: "setup-guide" },
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyHash = createHash("sha256").update(body).digest("hex");
  const signature = createHmac("sha256", secretKey).update(`${timestamp}\nPOST\n${INGEST_PATH}\n${bodyHash}`).digest("hex");

  try {
    const upstream = await fetch(API_BASE_URL + INGEST_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Access-Key": accessKey,
        "X-Timestamp": timestamp,
        "X-Signature": signature,
      },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = await upstream.json().catch(() => ({ error: { code: "invalid_response", message: "The API returned an invalid response." } }));
    const response = Response.json(data, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return apiUnavailableResponse();
  }
}
