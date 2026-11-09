import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { cleanSupabaseUrl, cleanSupabaseKey } from "./supabase-url";

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

function createAdminClient() {
  const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const SUPABASE_SERVICE_ROLE_KEY = cleanSupabaseKey(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_SERVICE_ROLE_KEY ? ["SUPABASE_SERVICE_ROLE_KEY"] : []),
    ];
    throw new Error(`Missing backend environment variable(s): ${missing.join(", ")}.`);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: realtimeTransport,
    },
  });
}

let adminClient: ReturnType<typeof createAdminClient> | undefined;

export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_, prop, receiver) {
    if (!adminClient) adminClient = createAdminClient();
    return Reflect.get(adminClient, prop, receiver);
  },
});