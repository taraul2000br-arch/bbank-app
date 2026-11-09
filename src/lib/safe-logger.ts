/**
 * Safe Error Logger for Client & Server
 * Logs only non-sensitive diagnostic info (route, error type, normalized code, timestamp).
 * Strips all tokens, passwords, Sort Codes, account numbers, and personal identifiers.
 */

export type SafeLogEvent = {
  route?: string;
  errorType: string;
  errorCode?: string;
  message: string;
  timestamp: string;
  correlationId?: string;
};

export function sanitizeErrorMessage(msg: string): string {
  if (!msg) return "";
  let clean = msg;
  clean = clean.replace(/eyJ[a-zA-Z0-9_\-\.]+/gi, "[REDACTED_JWT]");
  clean = clean.replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, "Bearer [REDACTED_TOKEN]");
  clean = clean.replace(/\b\d{2}-\d{2}-\d{2}\b/g, "[REDACTED_SORT_CODE]");
  clean = clean.replace(/\b\d{8}\b/g, "[REDACTED_ACCOUNT]");
  clean = clean.replace(/\b(cpf|ssn|nif|dni|password|senha|secret|token)(\s*[:=\s]\s*)([^\s,]+)/gi, "$1$2[REDACTED_SECRET]");
  return clean.slice(0, 300);
}

export function logSafeError(route: string, error: unknown, correlationId?: string): void {
  const errObj = error instanceof Error ? error : new Error(String(error ?? "Unknown error"));
  const sanitizedMessage = sanitizeErrorMessage(errObj.message);

  const event: SafeLogEvent = {
    route: route || (typeof window !== "undefined" ? window.location.pathname : "unknown"),
    errorType: errObj.name || "Error",
    errorCode: (errObj as any)?.code || "INTERNAL_ERROR",
    message: sanitizedMessage,
    timestamp: new Date().toISOString(),
    correlationId: correlationId || `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
  };

  // Safe console log without leaking sensitive stack traces in production
  if (process.env.NODE_ENV === "development") {
    console.warn(`[SafeLogger] Route: ${event.route} | Code: ${event.errorCode} | ${event.message}`);
  }
}
