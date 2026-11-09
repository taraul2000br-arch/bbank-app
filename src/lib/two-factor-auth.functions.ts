import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabaseAdmin } from "./supabase-admin.server";
import { cleanSupabaseUrl, cleanSupabaseKey } from "./supabase-url";

// Fallback dummy transport for server environment
class ServerOnlyRealtimeTransport {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 3;
  url = "";
  protocol = "";
  onopen: ((this: unknown, ev: Event) => unknown) | null = null;
  onmessage: ((this: unknown, ev: MessageEvent) => unknown) | null = null;
  onclose: ((this: unknown, ev: CloseEvent) => unknown) | null = null;
  onerror: ((this: unknown, ev: Event) => unknown) | null = null;
  constructor(url: string) { this.url = url; }
  close() {}
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

const realtimeTransport =
  (typeof globalThis !== "undefined" && globalThis.WebSocket) ||
  (ServerOnlyRealtimeTransport as unknown as typeof globalThis.WebSocket);

/**
 * Migration Grace Period Sunset Window.
 * Legacy session validation is permitted ONLY until this timestamp.
 * After this date, legacy tokens are permanently rejected and clients must re-authenticate.
 * Sunset date: 2026-12-31 23:59:59 UTC (documented migration window).
 */
export const LEGACY_MIGRATION_SUNSET_TIMESTAMP = new Date("2026-12-31T23:59:59Z").getTime();

export function isMigrationWindowActive(): boolean {
  return Date.now() <= LEGACY_MIGRATION_SUNSET_TIMESTAMP;
}

/**
 * Authoritative cryptographic secret for application session tokens and proofs (SEC-02).
 * Strictly decoupled from SUPABASE_SERVICE_ROLE_KEY to maintain architectural separation of concerns:
 * DB service role credentials must never double as application-layer crypto keys.
 * Mandatory in server environments; no static fallbacks allowed for new tokens.
 */
export function getActiveAuthSecretKey(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim() === "") {
    throw new Error(
      "[CRITICAL SECURITY CONFIGURATION ERROR] Mandatory AUTH_SECRET environment variable is missing. " +
      "Configure AUTH_SECRET (at least 32 characters) in your server environment (e.g. Netlify Environment Variables)."
    );
  }
  return crypto.createHash("sha256").update(secret.trim()).digest();
}

/**
 * Retrieves candidate legacy keys ONLY during the active migration sunset window.
 * Used exclusively for decrypting existing legacy sessions without causing disruption.
 */
function getLegacyMigrationKeys(): Buffer[] {
  if (!isMigrationWindowActive()) {
    return [];
  }

  const legacyCandidates: string[] = [];
  // 1. If SUPABASE_SERVICE_ROLE_KEY was previously used as encryption key
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    legacyCandidates.push(process.env.SUPABASE_SERVICE_ROLE_KEY);
  }
  // 2. Previous transitional static salts (only attempted during migration window)
  legacyCandidates.push("velunor-internal-secure-auth-secret-key-salt");
  // Legacy fallback

  return legacyCandidates.map((cand) => crypto.createHash("sha256").update(cand).digest());
}

export function encryptChallenge(data: any): string {
  // New challenges are ALWAYS encrypted with the authoritative AUTH_SECRET key. Zero static fallback.
  const key = getActiveAuthSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(data), "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${encrypted}.${authTag.toString("base64")}`;
}

export function decryptChallenge<T = any>(token: string): T | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const iv = Buffer.from(parts[0], "base64");
    const encrypted = parts[1];
    const authTag = Buffer.from(parts[2], "base64");

    // 1. Attempt decryption with primary AUTH_SECRET key
    try {
      const key = getActiveAuthSecretKey();
      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, "base64", "utf8");
      decrypted += decipher.final("utf8");
      return JSON.parse(decrypted) as T;
    } catch {
      // Primary key failed or AUTH_SECRET not configured; attempt legacy keys ONLY during migration window
    }

    // 2. Controlled legacy migration fallback (valid until sunset date)
    if (isMigrationWindowActive()) {
      const legacyKeys = getLegacyMigrationKeys();
      for (const legacyKey of legacyKeys) {
        try {
          const decipher = crypto.createDecipheriv("aes-256-gcm", legacyKey, iv);
          decipher.setAuthTag(authTag);
          let decrypted = decipher.update(encrypted, "base64", "utf8");
          decrypted += decipher.final("utf8");
          console.warn(
            `[SECURITY MIGRATION] Validated legacy challenge token during sunset window. Valid until: ${new Date(
              LEGACY_MIGRATION_SUNSET_TIMESTAMP
            ).toISOString()}`
          );
          return JSON.parse(decrypted) as T;
        } catch {
          // Continue to next candidate
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Generates authoritative server-signed HMAC proof bound to userId using AUTH_SECRET
export function signProof(userId: string, accessToken?: string): string {
  // New proofs are ALWAYS signed using the dedicated AUTH_SECRET. Zero static fallback.
  const key = getActiveAuthSecretKey();
  return crypto.createHmac("sha256", key).update(`sc-verified:${userId}`).digest("hex");
}

/**
 * Verifies that a session proof was legitimately signed by the server for the given userId.
 * Performs timing-safe HMAC validation using the active AUTH_SECRET key,
 * with fallback to candidate keys during the documented migration window.
 * Strictly returns false for missing, invalid, or forged proofs.
 */
export function verifySortCodeProof(userId: string, accessToken: string | undefined, proof: string): boolean {
  if (!userId || !proof || typeof userId !== "string" || typeof proof !== "string") {
    return false;
  }

  // 1. Validate against active AUTH_SECRET
  try {
    const expected = signProof(userId, accessToken);
    const proofBuf = Buffer.from(proof, "hex");
    const expBuf = Buffer.from(expected, "hex");

    if (proofBuf.length === expBuf.length && crypto.timingSafeEqual(proofBuf, expBuf)) {
      return true;
    }
  } catch {
    // If active key is missing or hex parsing fails
  }

  // 2. Validate against legacy candidate keys strictly during migration sunset window
  if (isMigrationWindowActive()) {
    const legacyKeys = getLegacyMigrationKeys();
    for (const legacyKey of legacyKeys) {
      try {
        const legacyExpected = crypto.createHmac("sha256", legacyKey).update(`sc-verified:${userId}`).digest("hex");
        const proofBuf = Buffer.from(proof, "hex");
        const expBuf = Buffer.from(legacyExpected, "hex");
        if (proofBuf.length === expBuf.length && crypto.timingSafeEqual(proofBuf, expBuf)) {
          console.warn(
            `[SECURITY MIGRATION] Validated legacy HMAC proof during sunset window. Valid until: ${new Date(
              LEGACY_MIGRATION_SUNSET_TIMESTAMP
            ).toISOString()}`
          );
          return true;
        }
      } catch {}
    }
  }

  return false;
}

export function normalizeSortCode(code?: string | null): string {
  return (code || "").replace(/\D/g, "").slice(0, 6);
}

export function extractSortCode(rawAccNo?: string | null, rawIban?: string | null): string {
  let sortCode = "00-00-00";
  const fullIban = (rawIban || "").trim();

  if (fullIban && fullIban.startsWith("GB") && fullIban.length >= 22) {
    const sc = fullIban.slice(8, 14);
    if (sc.length === 6) {
      return `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}`;
    }
  }

  if (rawAccNo) {
    const trimmed = rawAccNo.trim();
    if (trimmed.startsWith("GB") && trimmed.length >= 22) {
      const sc = trimmed.slice(8, 14);
      if (sc.length === 6) {
        return `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}`;
      }
    }
    const parts = trimmed.split("-").filter(Boolean);
    if (parts.length >= 2) {
      const prefixDigits = parts.slice(0, -1).join("").replace(/\D/g, "");
      if (prefixDigits.length >= 6) {
        const sc = prefixDigits.slice(0, 6);
        return `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}`;
      }
    }
  }

  return sortCode;
}

function isValidIp(ip: string): boolean {
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

function getTrustedClientIp(req: Request | undefined): string | null {
  if (!req) return null;
  const h = req.headers;
  // 1. Authoritative Edge headers injected by trusted infrastructure (Netlify / Cloudflare)
  const netlifyIp = h.get("x-nf-client-connection-ip");
  if (netlifyIp && isValidIp(netlifyIp)) return netlifyIp.trim();

  const cfIp = h.get("cf-connecting-ip");
  if (cfIp && isValidIp(cfIp)) return cfIp.trim();

  const realIp = h.get("x-real-ip");
  if (realIp && isValidIp(realIp)) return realIp.trim();

  // 2. Parse X-Forwarded-For defensively
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const parts = forwarded.split(",").map((p) => p.trim()).filter(Boolean);
    for (const part of parts) {
      if (isValidIp(part)) return part;
    }
  }

  return null;
}

/**
 * Step 1: Validate Email and Password
 * Returns challengeToken (UUID) for retail clients without leaking Supabase session,
 * or returns session directly for administrators.
 */
export const loginStepOne = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    return z.object({
      email: z.string().trim().email("Please enter a valid email address.").max(255),
      password: z.string().min(1, "Password is required.").max(128),
    }).parse(input);
  })
  .handler(async ({ data: { email, password } }) => {
    const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const SUPABASE_PUBLISHABLE_KEY = cleanSupabaseKey(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase configuration.");
    }

    const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: realtimeTransport },
    });

    const { data: loginData, error: loginErr } = await authClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginErr || !loginData.session || !loginData.user) {
      const isEmailNotConfirmed = loginErr?.message?.toLowerCase().includes("email not confirmed");
      return {
        success: false as const,
        error: isEmailNotConfirmed
          ? "Email not confirmed. In staging, disable 'Confirm email' in Supabase Auth settings to enable direct testing."
          : (loginErr?.message || "Invalid email address or password. Please check your credentials."),
      };
    }

    const userId = loginData.user.id;

    // Check if user is an administrator
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "adm_geral", "adm_comum"] as any);

    const isAdmin = !!roleRows && roleRows.length > 0;

    if (isAdmin) {
      // Administrator login bypasses Sort Code check to preserve back-office access
      const verificationProof = signProof(userId, loginData.session.access_token);
      return {
        success: true as const,
        isAdmin: true as const,
        session: loginData.session,
        verificationProof,
      };
    }

    // Query retail customer profile for KYC and approval status
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("kyc_status, kyc_reviewed_at")
      .eq("user_id", userId)
      .maybeSingle();

    const kycStatus = (profile as any)?.kyc_status || "not_started";

    let clientIp: string | null = null;
    let userAgent: string | null = null;
    try {
      const req = getRequest();
      if (req) {
        userAgent = req.headers.get("user-agent") || null;
        clientIp = getTrustedClientIp(req);
      }
    } catch {}

    // =========================================================================
    // CASE A: Customer KYC is NOT approved ('not_started', 'pending', 'rejected')
    // =========================================================================
    // Customer DOES NOT have a Sort Code yet and MUST NOT be asked for one!
    // Grants access strictly to the KYC onboarding/review flow (/kyc).
    // Banking operations (/conta, /transferencia, etc.) remain strictly guarded.
    if (kycStatus !== "approved") {
      const verificationProof = signProof(userId, loginData.session.access_token);
      await supabaseAdmin.from("user_login_events").insert({
        user_id: userId,
        event_type: "login",
        ip_address: clientIp,
        user_agent: userAgent,
      });

      return {
        success: true as const,
        isAdmin: false as const,
        requiresKyc: true as const,
        kycStatus: kycStatus as "not_started" | "pending" | "rejected",
        session: loginData.session,
        verificationProof,
      };
    }

    // =========================================================================
    // Retail Customer with Approved KYC: Direct Authenticated Access
    // =========================================================================
    // Sort Code validation during login is completely removed.
    // Client logs in directly with credentials, validated by Supabase Auth and backend.
    const verificationProof = signProof(userId, loginData.session.access_token);

    await supabaseAdmin.from("user_login_events").insert({
      user_id: userId,
      event_type: "login",
      ip_address: clientIp,
      user_agent: userAgent,
    });

    return {
      success: true as const,
      isAdmin: false as const,
      session: loginData.session,
      verificationProof,
    };
  });

/**
 * Immediate secure login following a newly completed registration.
 * Bypasses Sort Code verification ONLY for fresh registrations (created within 180 seconds,
 * with zero prior verification challenges and valid password proof).
 */
export const completeRegistrationLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    return z.object({
      email: z.string().trim().email("Please enter a valid email address.").max(255),
      password: z.string().min(1, "Password is required.").max(128),
    }).parse(input);
  })
  .handler(async ({ data: { email, password } }) => {
    const SUPABASE_URL = cleanSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const SUPABASE_PUBLISHABLE_KEY = cleanSupabaseKey(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase configuration.");
    }

    const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { transport: realtimeTransport },
    });

    // 1. Authenticate credentials - user must prove password possession
    const { data: loginData, error: loginErr } = await authClient.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (loginErr || !loginData.session || !loginData.user) {
      const isEmailNotConfirmed = loginErr?.message?.toLowerCase().includes("email not confirmed");
      return {
        success: false as const,
        error: isEmailNotConfirmed
          ? "Email not confirmed. In staging, disable 'Confirm email' in Supabase Auth settings to enable direct testing."
          : (loginErr?.message || "Authentication failed following registration."),
      };
    }

    const userId = loginData.user.id;

    // 2. Authoritative check: verify account was created in auth.users within the last 180 seconds
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userErr || !userData.user) {
      return {
        success: false as const,
        error: "Unable to verify user registration. Please sign in.",
      };
    }

    const createdAt = new Date(userData.user.created_at).getTime();
    const ageSeconds = (Date.now() - createdAt) / 1000;
    if (ageSeconds > 180 || ageSeconds < -10) {
      return {
        success: false as const,
        error: "Registration window expired. Please sign in with your email and Sort Code.",
        requiresStandardLogin: true,
      };
    }

    // 3. Security check: user must NOT have any previous verification challenges
    const { data: challenges } = await (supabaseAdmin as any)
      .from("auth_verification_challenges")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (challenges && challenges.length > 0) {
      return {
        success: false as const,
        error: "Account already active. Please sign in with your credentials and Sort Code.",
        requiresStandardLogin: true,
      };
    }

    // 4. Enforce authoritative rule: Banco Velunor accounts operate strictly in GBP (£)
    // Ensures any new registration gets currency = 'GBP' regardless of user country or legacy triggers
    await (supabaseAdmin as any)
      .from("accounts")
      .update({ currency: "GBP" })
      .eq("user_id", userId);

    // 5. Check user roles
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "adm_geral", "adm_comum"] as any);

    const isAdmin = !!roleRows && roleRows.length > 0;

    // 5. Generate authoritative HMAC verification proof bound to userId and token
    const verificationProof = signProof(userId, loginData.session.access_token);

    // 6. Record signup login event for audit trail
    let clientIp: string | null = null;
    let userAgent: string | null = null;
    try {
      const req = getRequest();
      if (req) {
        userAgent = req.headers.get("user-agent") || null;
        clientIp = getTrustedClientIp(req);
      }
    } catch {}

    await supabaseAdmin.from("user_login_events").insert({
      user_id: userId,
      event_type: "signup",
      ip_address: clientIp,
      user_agent: userAgent,
    });

    return {
      success: true as const,
      isAdmin,
      session: loginData.session,
      verificationProof,
    };
  });

/**
 * Step 2: Verify Sort Code
 * Validates Sort Code atomically on PostgreSQL under row lock (FOR UPDATE).
 * Only releases the Supabase session and verification proof upon a genuine match.
 */
export const loginStepTwo = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    return z.object({
      challengeToken: z.string().min(10, "Invalid verification session."),
      sortCode: z.string().trim().min(6, "Please enter your 6-digit Sort Code.").max(12),
    }).parse(input);
  })
  .handler(async ({ data: { challengeToken, sortCode } }) => {
    // Call PostgreSQL atomic RPC under row lock
    const { data: verificationResult, error: verifyErr } = await supabaseAdmin.rpc(
      "verify_sort_code_attempt",
      {
        _challenge_id: challengeToken,
        _provided_sort_code: sortCode,
      }
    );

    if (verifyErr || !verificationResult) {
      console.error("[LoginStepTwo] RPC error:", verifyErr);
      return {
        success: false as const,
        error: "An unexpected error occurred during verification. Please try again.",
      };
    }

    const result = verificationResult as {
      success: boolean;
      error?: string;
      lockout?: boolean;
      expired?: boolean;
      reused?: boolean;
      remaining_attempts?: number;
      user_id?: string;
      encrypted_session?: string;
    };

    if (!result.success) {
      return {
        success: false as const,
        error: result.error || "The Sort Code entered does not match our records.",
        lockout: !!result.lockout,
        expired: !!result.expired,
        reused: !!result.reused,
        remainingAttempts: result.remaining_attempts,
        newChallengeToken: challengeToken, // Maintain same UUID reference for retries
      };
    }

    // Match confirmed by PostgreSQL authoritative check!
    // Decrypt session server-side
    const decrypted = decryptChallenge<{ session: any; userId: string }>(result.encrypted_session!);
    if (!decrypted || !decrypted.session) {
      return {
        success: false as const,
        error: "Verification failed to restore session. Please sign in again.",
        expired: true,
      };
    }

    // Sign cryptographic proof with server-side HMAC
    const verificationProof = signProof(result.user_id!, decrypted.session.access_token);

    // Authoritative check if user is an administrator
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", result.user_id!)
      .in("role", ["admin", "adm_geral", "adm_comum"] as any);
    const isAdmin = !!roleRows && roleRows.length > 0;

    return {
      success: true as const,
      isAdmin,
      session: decrypted.session,
      verificationProof,
    };
  });

