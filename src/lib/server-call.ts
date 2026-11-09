import { supabase } from "@/integrations/supabase/client";

const AUTH_HINTS = ["unauthorized", "jwt", "token", "authorization"];
const TRANSIENT_HINTS = ["failed to fetch", "network", "load failed", "timeout", "502", "503", "504"];

function match(error: unknown, hints: string[]): boolean {
  const msg = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return hints.some((h) => msg.includes(h));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Chama uma server function protegida com recuperação automática.
 * - Sessão expirada / token ausente: renova a sessão e tenta de novo.
 * - Falha momentânea de rede/servidor: tenta de novo com um pequeno intervalo.
 * Isso evita o comportamento "às vezes abre, às vezes não" no CRM.
 */
export async function callWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isAuth = match(error, AUTH_HINTS);
      const isTransient = match(error, TRANSIENT_HINTS);
      if (!isAuth && !isTransient) throw error;
      if (i === attempts - 1) break;
      if (isAuth) {
        try {
          await supabase.auth.refreshSession();
        } catch {
          /* segue para nova tentativa */
        }
      }
      await sleep(300 * (i + 1));
    }
  }
  throw lastError;
}
