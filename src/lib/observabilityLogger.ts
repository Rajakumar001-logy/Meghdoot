export interface StructuredLogEntry {
  request_id: string;
  timestamp: string;
  endpoint: string;
  duration_ms: number;
  status: number;
  error_category:
    | "NONE"
    | "DATA_SOURCE_ERROR"
    | "GIS_ERROR"
    | "AI_SERVICE_ERROR"
    | "SUPABASE_ERROR"
    | "MESSAGE_PROVIDER_ERROR"
    | "VALIDATION_ERROR";
  note?: string;
}

const recentStructuredLogs: StructuredLogEntry[] = [];

const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g,
  /\+?91[6-9]\d{9}/g,
];

function redactSensitiveText(input: string): string {
  let out = input;
  for (const regex of SENSITIVE_PATTERNS) {
    out = out.replace(regex, "[REDACTED]");
  }
  return out;
}

/**
 * Section 36: Lightweight Structured Observability Logger.
 * Logs request_id, timestamp, endpoint, duration_ms, status, and error_category.
 * Strictly redacts any API tokens, service_role secrets, or unmasked phone numbers.
 */
export function logSystemEvent(params: {
  endpoint: string;
  durationMs: number;
  status: number;
  errorCategory?: StructuredLogEntry["error_category"];
  note?: string;
}): StructuredLogEntry {
  const entry: StructuredLogEntry = {
    request_id: `req-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toISOString(),
    endpoint: params.endpoint,
    duration_ms: Math.max(0, Math.round(params.durationMs)),
    status: params.status,
    error_category: params.errorCategory || "NONE",
    note: params.note ? redactSensitiveText(params.note) : undefined,
  };

  recentStructuredLogs.unshift(entry);
  if (recentStructuredLogs.length > 100) {
    recentStructuredLogs.pop();
  }
  return entry;
}

export function getRecentStructuredLogs(limit = 20): StructuredLogEntry[] {
  return recentStructuredLogs.slice(0, limit);
}
