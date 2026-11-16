// Shared helpers for the traces list and the waterfall.

const SERVICE_COLORS = ["#8f80ff", "#4fc3c9", "#f0a35e", "#6fd08c", "#e879b9", "#7aa7ff", "#d8c35a", "#b98cff"];

/** A stable color per service name, so a service looks the same on every trace. */
export function serviceColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return SERVICE_COLORS[hash % SERVICE_COLORS.length];
}

export function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "—";
  if (ms < 1) return ms.toFixed(2) + " ms";
  if (ms < 100) return ms.toFixed(1) + " ms";
  if (ms < 1000) return Math.round(ms) + " ms";
  if (ms < 60_000) return (ms / 1000).toFixed(2) + " s";
  return (ms / 60_000).toFixed(1) + " min";
}

export function traceDetailHref(projectId, traceId, spanId) {
  return "/dashboard/traces/" + encodeURIComponent(projectId) + "/" + encodeURIComponent(traceId) + (spanId ? "?span=" + encodeURIComponent(spanId) : "");
}
