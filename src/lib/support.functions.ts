import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireBackendAuth as requireSupabaseAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";

function generateProtocol(prefix: string): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${dateStr}-${randomSuffix}`;
}

function sanitizeText(str: string): string {
  return String(str || "")
    .replace(/[<>]/g, "")
    .trim();
}

// In-memory rate limiting / flood protection: max 5 requests per 5 minutes per identifier
const submissionRateMap = new Map<string, { count: number; firstSeen: number }>();
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const MAX_SUBMISSIONS_PER_WINDOW = 5;

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const entry = submissionRateMap.get(identifier);

  if (!entry || now - entry.firstSeen > RATE_LIMIT_WINDOW_MS) {
    submissionRateMap.set(identifier, { count: 1, firstSeen: now });
    return true;
  }

  if (entry.count >= MAX_SUBMISSIONS_PER_WINDOW) {
    return false;
  }

  entry.count += 1;
  return true;
}

function getClientIdentifier(): string {
  try {
    const req = getRequest();
    if (!req) return "127.0.0.1:unknown";
    const h = req.headers;
    const ip =
      h.get("cf-connecting-ip") ||
      h.get("x-real-ip") ||
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-client-ip") ||
      "127.0.0.1";
    const userAgent = (h.get("user-agent") || "unknown").slice(0, 30);
    return `${ip}:${userAgent}`;
  } catch {
    return "default-client";
  }
}

async function getOptionalVerifiedUserId(): Promise<string | null> {
  try {
    const request = getRequest();
    const authHeader = request?.headers?.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) return null;
    const { data: userRes, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !userRes?.user) return null;
    return userRes.user.id;
  } catch {
    return null;
  }
}

export const submitContactRequest = createServerFn({ method: "POST" })
  .validator((data: { name: string; email: string; subject: string; message: string; honeypot?: string }) => {
    // 1. Anti-spam honeypot detection
    if (data?.honeypot && String(data.honeypot).trim() !== "") {
      throw new Error("Spam detected. Submission rejected.");
    }

    const name = sanitizeText(data?.name);
    const email = String(data?.email ?? "").trim().toLowerCase();
    const subject = sanitizeText(data?.subject);
    const message = sanitizeText(data?.message);

    if (!name || name.length < 2 || name.length > 100) {
      throw new Error("Please enter your full name (2 to 100 characters).");
    }
    if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please enter a valid email address.");
    }
    if (!subject || subject.length < 3 || subject.length > 150) {
      throw new Error("Please enter a subject (3 to 150 characters).");
    }
    if (!message || message.length < 10 || message.length > 3000) {
      throw new Error("Please enter a detailed message (between 10 and 3,000 characters).");
    }

    return { name, email, subject, message };
  })
  .handler(async ({ data }) => {
    // 2. Rate limiting check
    const clientId = getClientIdentifier();
    if (!checkRateLimit(clientId)) {
      throw new Error("Too many submissions received from this device. Please wait a few minutes before trying again.");
    }

    const protocol = generateProtocol("CT");
    const userId = await getOptionalVerifiedUserId();

    const row = {
      protocol,
      user_id: userId,
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      status: "received",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Strict Real DB persistence (no false success via in-memory storage)
    const { error } = await supabaseAdmin.from("contact_requests").insert(row);

    if (error) {
      console.error("[support] Real DB insert failed for contact_requests:", error.message);
      throw new Error("The database service is currently unavailable to record your request. Please ensure the schema has been executed and try again.");
    }

    return {
      success: true,
      protocol,
      message: "Your inquiry has been stored securely in our database.",
    };
  });

export const submitCustomerComplaint = createServerFn({ method: "POST" })
  .validator((data: { name: string; email: string; category: string; description: string; honeypot?: string }) => {
    // 1. Anti-spam honeypot detection
    if (data?.honeypot && String(data.honeypot).trim() !== "") {
      throw new Error("Spam detected. Submission rejected.");
    }

    const name = sanitizeText(data?.name);
    const email = String(data?.email ?? "").trim().toLowerCase();
    const category = String(data?.category ?? "").trim();
    const description = sanitizeText(data?.description);

    const validCategories = [
      "transfers_payments",
      "account_management",
      "cards",
      "account_access",
      "customer_service",
      "security_fraud",
      "fees_charges",
      "other",
    ];

    if (!name || name.length < 2 || name.length > 100) {
      throw new Error("Please provide your full name (2 to 100 characters).");
    }
    if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Please provide a valid email address.");
    }
    if (!category || !validCategories.includes(category)) {
      throw new Error("Please select a valid complaint category.");
    }
    if (!description || description.length < 15 || description.length > 3000) {
      throw new Error("Please provide a detailed description (between 15 and 3,000 characters).");
    }

    return { name, email, category, description };
  })
  .handler(async ({ data }) => {
    // 2. Rate limiting check
    const clientId = getClientIdentifier();
    if (!checkRateLimit(clientId)) {
      throw new Error("Too many submissions received from this device. Please wait a few minutes before trying again.");
    }

    const protocol = generateProtocol("CMP");
    const userId = await getOptionalVerifiedUserId();

    const row = {
      protocol,
      user_id: userId,
      name: data.name,
      email: data.email,
      category: data.category,
      description: data.description,
      status: "pending",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Strict Real DB persistence
    const { error } = await supabaseAdmin.from("customer_complaints").insert(row);

    if (error) {
      console.error("[support] Real DB insert failed for customer_complaints:", error.message);
      throw new Error("The database service is currently unavailable to record your complaint. Please ensure the schema has been executed and try again.");
    }

    return {
      success: true,
      protocol,
      createdAt: row.created_at,
      message: "Your complaint has been logged securely in the system database.",
    };
  });

export const trackCustomerComplaint = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((params: { protocol: string }) => {
    const protocol = sanitizeText(params?.protocol).toUpperCase();

    if (!protocol || protocol.length < 5) {
      throw new Error("Please enter a valid complaint protocol (e.g. CMP-20261019-XXXX).");
    }

    return { protocol };
  })
  .handler(async ({ context, data }) => {
    const uid = context.userId;
    const { protocol } = data;

    const { getAdminLevel, assertAdmin, assertCanSee } = await import("./admin.functions");
    const adminLvl = await getAdminLevel(uid);

    let complaint: any = null;

    if (adminLvl) {
      // Must be an active, unexpired administrator
      await assertAdmin(uid);
      const { data: c, error } = await supabaseAdmin
        .from("customer_complaints")
        .select("protocol, category, description, status, resolution_notes, created_at, resolved_at, user_id")
        .ilike("protocol", protocol)
        .maybeSingle();

      if (error) {
        throw new Error("Database error while retrieving complaint.");
      }
      if (!c) {
        return {
          found: false,
          complaint: null,
          error: "Complaint protocol not found.",
        };
      }

      // If complaint is associated with a customer, enforce portfolio authorization for non-master
      if (c.user_id && adminLvl !== "master") {
        await assertCanSee(uid, c.user_id);
      }
      complaint = c;
    } else {
      // Regular customer can ONLY view complaints explicitly belonging to their account
      const { data: c, error } = await supabaseAdmin
        .from("customer_complaints")
        .select("protocol, category, description, status, resolution_notes, created_at, resolved_at, user_id")
        .ilike("protocol", protocol)
        .eq("user_id", uid)
        .maybeSingle();

      if (error) {
        throw new Error("Database error while retrieving complaint.");
      }
      if (!c) {
        return {
          found: false,
          complaint: null,
          error: "Complaint protocol not found or does not belong to your authenticated account.",
        };
      }
      complaint = c;
    }

    return {
      found: true,
      complaint: {
        protocol: complaint.protocol,
        category: complaint.category,
        description: complaint.description,
        status: complaint.status,
        resolution_notes: complaint.resolution_notes ?? null,
        created_at: complaint.created_at,
        resolved_at: complaint.resolved_at ?? null,
      },
    };
  });

export const getMyPendingPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;

    const { data, error } = await supabaseAdmin
      .from("transfer_requests")
      .select("id, amount, currency_from, currency_to, converted_amount, beneficiary_name, to_country, created_at, status, reference, purpose, protocol")
      .eq("user_id", uid)
      .eq("status", "solicitado")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[support] fetch pending payments error:", error.message);
      return { authenticated: true, items: [], totalGBP: 0 };
    }

    const items = data ?? [];
    const totalGBP = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return { authenticated: true, items, totalGBP };
  });
