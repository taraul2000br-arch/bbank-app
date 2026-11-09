import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cleanSupabaseUrl, cleanSupabaseKey } from "./supabase-url";
import { supabaseAdmin } from "./supabase-admin.server";

class ServerOnlyRealtimeTransport {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;
  readyState = 3;
  url = "";
  protocol = "";
  onopen: ((this: unknown, ev: Event) => unknown) | null = null;
  onmessage: ((this: unknown, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: unknown, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: unknown, ev: Event) => unknown) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

const realtimeTransport =
  (typeof globalThis !== "undefined" && globalThis.WebSocket) ||
  (ServerOnlyRealtimeTransport as unknown as typeof globalThis.WebSocket);

/**
 * Basic authenticated user middleware: verifies valid Supabase JWT Bearer token.
 * Used for identity, profile consultation, and KYC onboarding operations
 * where Sort Code 2FA is not applicable or not yet granted.
 */
export const requireUserAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const SUPABASE_PUBLISHABLE_KEY = cleanSupabaseKey(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase backend configuration.");
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized: No token provided");

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: { transport: realtimeTransport },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

    const userId = data.claims.sub as string;

    return next({
      context: {
        supabase,
        userId,
        claims: data.claims,
      },
    });
  },
);

/**
 * Privileged financial backend middleware:
 * Requires valid Supabase JWT Bearer token and authenticates active user session
 * for all banking operations (balance, transfers, statements).
 * Validates token signature, expiration, and user claims via Supabase Auth.
 */
export const requireBackendAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const SUPABASE_PUBLISHABLE_KEY = cleanSupabaseKey(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      const missing = [
        ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
        ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
      ];
      throw new Error(`Missing backend environment variable(s): ${missing.join(", ")}.`);
    }

    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized: No token provided");

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: { transport: realtimeTransport },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims?.sub) throw new Error("Unauthorized: Invalid token");

    const userId = data.claims.sub as string;

    return next({
      context: {
        supabase,
        userId,
        claims: data.claims,
      },
    });
  },
);