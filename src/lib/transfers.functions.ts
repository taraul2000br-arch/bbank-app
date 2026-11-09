import crypto from "crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth as requireSupabaseAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import { assertAdmin, assertCanSee, assertNotReadOnlyAdmin, assertAccountNotBlocked, getAdminLevel, reviewTransferAsAdmin } from "./admin.functions";

export type TransferStatus = "solicitado" | "aprovado" | "recusado" | "bloqueado";

export type TransferRow = {
  id: string;
  protocol: string | null;
  user_id: string;
  full_name: string | null;
  email: string | null;
  beneficiary_name: string;
  beneficiary_doc: string;
  beneficiary_email: string;
  bank_name: string;
  swift: string;
  account_number: string;
  to_country: string;
  currency_from: string;
  currency_to: string;
  amount: number;
  fx_rate: number;
  converted_amount: number;
  purpose: string;
  reference: string;
  hmrc_doc_path: string | null;
  hmrc_doc_url: string | null;
  status: TransferStatus;
  rejection_reason: string | null;
  created_at: string;
};

export type TransferReceiptData = {
  protocol: string | null;
  id: string;
  status: TransferStatus;
  created_at: string;

  // Source Account
  source_holder_name: string | null;
  source_iban: string | null;
  source_swift: string | null;
  source_account_number: string | null;
  source_currency: string;

  // Beneficiary / Destination
  beneficiary_name: string;
  destination_bank: string;
  destination_swift: string;
  destination_account_number: string;
  destination_country: string;

  // Amounts & Exchange
  amount: number;
  currency_from: string;
  currency_to: string;
  fx_rate: number;
  converted_amount: number;

  // Details
  reference: string | null;
  rejection_reason: string | null;
};

/**
 * Generates an unambiguous, cryptographically secure persistent protocol identifier
 * Format: BB-XXXX-XXXX-XXXX (12 chars from 32 unambiguous base32 symbols)
 * Entropy: 32^12 = ~1.15e18 combinations (~60 bits of entropy)
 */
export function generateTransferProtocol(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(12);
  let res = "";
  for (let i = 0; i < 12; i++) {
    res += chars[bytes[i] % chars.length];
  }
  return `BB-${res.slice(0, 4)}-${res.slice(4, 8)}-${res.slice(8, 12)}`;
}

export type AdminTransferDetail = {
  // Identification
  id: string;
  protocol: string | null;
  reference: string;
  user_id: string;
  client_name: string | null;
  client_email: string | null;
  client_phone: string | null;
  created_at: string;
  updated_at: string | null;
  status: TransferStatus;

  // Source Account (aggregated from accounts table)
  source_holder_name: string | null;
  source_iban: string | null;
  source_swift: string | null;
  source_account_number: string | null;
  source_currency: string;
  source_current_balance: number;

  // Beneficiary / Destination
  beneficiary_name: string;
  beneficiary_doc: string;
  beneficiary_email: string;
  destination_bank: string;
  destination_swift: string;
  destination_account_number: string;
  destination_country: string;

  // Amounts & Exchange
  amount: number;
  currency_from: string;
  currency_to: string;
  fx_rate: number;
  converted_amount: number;

  // Transfer Details
  purpose: string;
  rejection_reason: string | null;

  // Audit Information
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;

  // Documents
  hmrc_doc_path: string | null;
  hmrc_doc_url: string | null;
};

export const submitTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      beneficiary_name: z.string().trim().min(2).max(160),
      beneficiary_doc: z.string().trim().min(2).max(60),
      beneficiary_email: z.string().trim().email().max(160),
      bank_name: z.string().trim().min(2).max(120),
      swift: z.string().trim().min(4).max(40),
      account_number: z.string().trim().min(4).max(60),
      to_country: z.string().trim().min(2).max(4),
      currency_from: z.string().trim().min(3).max(4),
      currency_to: z.string().trim().min(3).max(4),
      amount: z.number().positive().max(999_999_999),
      fx_rate: z.number().positive(),
      converted_amount: z.number().nonnegative(),
      purpose: z.string().trim().min(1).max(40),
      reference: z.string().trim().max(120).optional(),
      hmrc_doc_path: z.string().trim().min(3).max(500).optional(),
      idempotency_key: z.string().trim().max(128).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    await assertAccountNotBlocked(uid);

    // path (if provided) must live under user's folder and be free of traversal
    if (data.hmrc_doc_path) {
      const p = data.hmrc_doc_path;
      if (
        p.includes("..") ||
        p.includes("\\") ||
        p.includes("\0") ||
        p.includes("//") ||
        p.includes("%2e") ||
        p.includes("%2f")
      ) {
        throw new Error("Path traversal characters not allowed in HMRC document path");
      }
      if (!p.startsWith(`${uid}/`)) {
        throw new Error("HMRC document path must belong to authenticated user");
      }
      const filename = p.slice(`${uid}/`.length);
      if (!filename || filename.includes("/")) {
        throw new Error("Invalid HMRC document path structure");
      }
      if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
        throw new Error("Invalid filename in HMRC document path");
      }
      const ext = (filename.split(".").pop() || "").toLowerCase();
      if (!["pdf", "png", "jpg", "jpeg"].includes(ext)) {
        throw new Error(`File extension .${ext} is not allowed for HMRC documents`);
      }
    }

    // Validate client-supplied FX rate / converted amount within plausible
    // bounds so a malicious client cannot record fraudulent FX history.
    if (data.fx_rate <= 0 || data.fx_rate > 1000) {
      throw new Error("Invalid FX rate");
    }

    const cleanAmount = Number((Math.round(data.amount * 100) / 100).toFixed(2));
    const cleanConverted = Number((Math.round(data.converted_amount * 100) / 100).toFixed(2));

    if (cleanAmount <= 0) {
      throw new Error("Invalid transfer amount");
    }
    if (cleanConverted <= 0) {
      throw new Error("Invalid converted amount");
    }

    // Beneficiary receives net (after fees) × fx_rate, so converted_amount
    // must be between 0 and amount × fx_rate (allow 1% slack for rounding).
    const maxConverted = cleanAmount * data.fx_rate * 1.01;
    if (cleanConverted < 0 || cleanConverted > maxConverted) {
      throw new Error("Converted amount out of range");
    }

    // Call atomic PostgreSQL RPC function (all-or-nothing transaction with row lock)
    let finalResult: { id: string; protocol: string; idempotent_replay?: boolean } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const protocolCandidate = generateTransferProtocol();
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
        "submit_transfer_atomic",
        {
          _user_id: uid,
          _protocol: protocolCandidate,
          _beneficiary_name: data.beneficiary_name,
          _beneficiary_doc: data.beneficiary_doc,
          _beneficiary_email: data.beneficiary_email,
          _bank_name: data.bank_name,
          _swift: data.swift,
          _account_number: data.account_number,
          _to_country: data.to_country,
          _currency_from: data.currency_from,
          _currency_to: data.currency_to,
          _amount: cleanAmount,
          _fx_rate: data.fx_rate,
          _converted_amount: cleanConverted,
          _purpose: data.purpose,
          _reference: data.reference || data.purpose,
          _hmrc_doc_path: data.hmrc_doc_path ?? null,
          _idempotency_key: data.idempotency_key ?? null,
        },
      );

      if (!rpcErr && rpcRes) {
        finalResult = {
          id: rpcRes.id,
          protocol: rpcRes.protocol ?? protocolCandidate,
          idempotent_replay: rpcRes.idempotent_replay === true,
        };
        break;
      }

      const errMsg = rpcErr?.message || "";
      const isUniqueErr =
        rpcErr?.code === "23505" ||
        errMsg.toLowerCase().includes("unique") ||
        errMsg.toLowerCase().includes("protocol");

      if (isUniqueErr) {
        if (attempt === 2) {
          throw new Error("Failed to generate unique transfer protocol. Please try again.");
        }
        // Entire transaction was aborted by PostgreSQL; safe to retry with a new protocol candidate
        continue;
      }

      // Mapped domain errors (sanitized for frontend consumption)
      if (/insufficient balance/i.test(errMsg)) {
        throw new Error("Insufficient balance");
      }
      if (/account not found/i.test(errMsg)) {
        throw new Error("Account not found");
      }
      if (/source currency does not match account currency/i.test(errMsg)) {
        throw new Error("Source currency does not match account currency");
      }
      if (/invalid transfer amount/i.test(errMsg)) {
        throw new Error("Invalid transfer amount");
      }
      if (/invalid fx rate/i.test(errMsg)) {
        throw new Error("Invalid FX rate");
      }
      if (/invalid converted amount/i.test(errMsg)) {
        throw new Error("Invalid converted amount");
      }
      if (/account is blocked/i.test(errMsg)) {
        throw new Error("Account is blocked");
      }
      if (/transfers are locked/i.test(errMsg)) {
        throw new Error("Transfers are locked for this account");
      }
      if (/IDEMPOTENCY_CONFLICT/i.test(errMsg)) {
        throw new Error("Transfer parameters conflict with a previous submission with the same key");
      }

      // Log DB failure on server without exposing SQL internals to client
      console.error("[submitTransfer] atomic transaction failed:", rpcErr);
      throw new Error("Transfer could not be submitted. Please try again later.");
    }

    if (!finalResult) {
      throw new Error("Transfer could not be submitted. Please try again later.");
    }

    return { ok: true, id: finalResult.id, protocol: finalResult.protocol, idempotent_replay: finalResult.idempotent_replay };
  });


async function sign(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from("hmrc-documents").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export const listTransferRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: TransferRow[] }> => {
    const lvl = await assertAdmin(context.userId);

    const [{ data: trs, error }, { data: profiles }, authList] = await Promise.all([
      supabaseAdmin
        .from("transfer_requests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("user_id, full_name, referred_by"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    if (error) throw new Error(error.message);

    const nameMap = new Map<string, string | null>(
      (profiles ?? []).map((p: any) => [p.user_id, p.full_name]),
    );
    const refMap = new Map<string, string | null>(
      (profiles ?? []).map((p: any) => [p.user_id, p.referred_by ?? null]),
    );
    const emailMap = new Map<string, string | null>(
      (authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );

    // role map for "geral" scope
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) {
      const cur = roleMap.get(r.user_id);
      const rk = (x: string) => x === "admin" ? 4 : x === "adm_geral" ? 3 : x === "adm_comum" ? 2 : 1;
      if (!cur || rk(r.role) > rk(cur)) roleMap.set(r.user_id, r.role);
    }

    const allowed = (uid: string): boolean => {
      if (lvl === "master") return true;
      const refId = refMap.get(uid);
      if (!refId) return false;
      if (lvl === "comum") return refId === context.userId;
      // geral: clientes de adm_comum + próprios
      return roleMap.get(refId) === "adm_comum" || refId === context.userId;
    };

    const filtered = (trs ?? []).filter((t: any) => allowed(t.user_id));

    const rows: TransferRow[] = await Promise.all(
      filtered.map(async (t: any) => ({
        id: t.id,
        protocol: t.protocol ?? null,
        user_id: t.user_id,
        full_name: nameMap.get(t.user_id) ?? null,
        email: emailMap.get(t.user_id) ?? null,
        beneficiary_name: t.beneficiary_name,
        beneficiary_doc: t.beneficiary_doc,
        beneficiary_email: t.beneficiary_email,
        bank_name: t.bank_name,
        swift: t.swift,
        account_number: t.account_number,
        to_country: t.to_country,
        currency_from: t.currency_from,
        currency_to: t.currency_to,
        amount: Number(t.amount),
        fx_rate: Number(t.fx_rate),
        converted_amount: Number(t.converted_amount),
        purpose: t.purpose,
        reference: t.reference,
        hmrc_doc_path: t.hmrc_doc_path,
        hmrc_doc_url: await sign(t.hmrc_doc_path),
        status: t.status,
        rejection_reason: t.rejection_reason ?? null,
        created_at: t.created_at,
      })),
    );

    return { rows };
  });

export const listTransferRequestsForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ rows: TransferRow[] }> => {
    const lvl = await assertAdmin(context.userId);
    await assertCanSee(context.userId, data.user_id);

    const [{ data: trs, error }, { data: profile }, userRes] = await Promise.all([
      supabaseAdmin
        .from("transfer_requests")
        .select("*")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("full_name").eq("user_id", data.user_id).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(data.user_id),
    ]);
    if (error) throw new Error(error.message);

    const fullName = (profile as any)?.full_name ?? null;
    const email = userRes.data?.user?.email ?? null;

    const rows: TransferRow[] = await Promise.all(
      (trs ?? []).map(async (t: any) => ({
        id: t.id,
        protocol: t.protocol ?? null,
        user_id: t.user_id,
        full_name: fullName,
        email,
        beneficiary_name: t.beneficiary_name,
        beneficiary_doc: t.beneficiary_doc,
        beneficiary_email: t.beneficiary_email,
        bank_name: t.bank_name,
        swift: t.swift,
        account_number: t.account_number,
        to_country: t.to_country,
        currency_from: t.currency_from,
        currency_to: t.currency_to,
        amount: Number(t.amount),
        fx_rate: Number(t.fx_rate),
        converted_amount: Number(t.converted_amount),
        purpose: t.purpose,
        reference: t.reference,
        hmrc_doc_path: t.hmrc_doc_path,
        hmrc_doc_url: await sign(t.hmrc_doc_path),
        status: t.status,
        rejection_reason: t.rejection_reason ?? null,
        created_at: t.created_at,
      })),
    );
    return { rows };
  });


export const updateTransferStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["aprovado", "recusado", "bloqueado"]),
      reason: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    return reviewTransferAsAdmin({
      adminId: context.userId,
      transferId: data.id,
      status: data.status,
      reason: data.reason,
    });
  });

export const getAdminTransferDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminTransferDetail> => {
    const lvl = await assertAdmin(context.userId);

    const { data: tr, error: trErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (trErr || !tr) throw new Error("Transfer not found");

    // Administrative scope validation: ensures adm_comum/adm_geral cannot access out-of-scope transfers
    await assertCanSee(context.userId, tr.user_id);

    const [
      { data: profile },
      { data: account },
      userRes,
      revProfRes,
      signedUrl,
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("full_name, phone, country")
        .eq("user_id", tr.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("accounts")
        .select("account_number, balance, currency, holder_name, iban, swift")
        .eq("user_id", tr.user_id)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(tr.user_id),
      tr.reviewed_by
        ? supabaseAdmin.from("profiles").select("full_name").eq("user_id", tr.reviewed_by).maybeSingle()
        : Promise.resolve({ data: null }),
      sign(tr.hmrc_doc_path),
    ]);

    let reviewerName = (revProfRes?.data as any)?.full_name ?? null;
    if (tr.reviewed_by && !reviewerName) {
      try {
        const { data: revAuth } = await supabaseAdmin.auth.admin.getUserById(tr.reviewed_by);
        reviewerName = revAuth?.user?.email ?? null;
      } catch {
        // ignore
      }
    }

    return {
      id: tr.id,
      protocol: tr.protocol ?? null,
      reference: tr.reference ?? "",
      user_id: tr.user_id,
      client_name: (profile as any)?.full_name ?? null,
      client_email: userRes.data?.user?.email ?? null,
      client_phone: (profile as any)?.phone ?? null,
      created_at: tr.created_at,
      updated_at: tr.updated_at ?? null,
      status: tr.status as TransferStatus,

      // Source Account
      source_holder_name: (account as any)?.holder_name ?? (profile as any)?.full_name ?? null,
      source_iban: (account as any)?.iban ?? null,
      source_swift: (account as any)?.swift ?? null,
      source_account_number: (account as any)?.account_number ?? null,
      source_currency: (account as any)?.currency ?? tr.currency_from ?? "GBP",
      source_current_balance: Number((account as any)?.balance ?? 0),

      // Beneficiary / Destination
      beneficiary_name: tr.beneficiary_name,
      beneficiary_doc: tr.beneficiary_doc,
      beneficiary_email: tr.beneficiary_email,
      destination_bank: tr.bank_name,
      destination_swift: tr.swift,
      destination_account_number: tr.account_number,
      destination_country: tr.to_country,

      // Amounts & Exchange
      amount: Number(tr.amount),
      currency_from: tr.currency_from,
      currency_to: tr.currency_to,
      fx_rate: Number(tr.fx_rate),
      converted_amount: Number(tr.converted_amount),

      // Transfer Details
      purpose: tr.purpose,
      rejection_reason: tr.rejection_reason ?? null,

      // Audit Information
      reviewed_at: tr.reviewed_at ?? null,
      reviewed_by: tr.reviewed_by ?? null,
      reviewed_by_name: reviewerName,

      // Documents
      hmrc_doc_path: tr.hmrc_doc_path ?? null,
      hmrc_doc_url: signedUrl,
    };
  });

/**
 * Customer receipt server function.
 * Enforces strict user authorization: tr.user_id === context.userId.
 * Never trusts client-supplied user identifiers.
 */
export const getMyTransferReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<TransferReceiptData> => {
    const uid = context.userId;

    const { data: tr, error: trErr } = await supabaseAdmin
      .from("transfer_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (trErr || !tr) throw new Error("Transfer not found");

    // Strict ownership validation: customer can ONLY consult receipts of their own transfers
    if (tr.user_id !== uid) {
      throw new Error("Access denied. You can only view your own receipts.");
    }

    const { data: acc } = await supabaseAdmin
      .from("accounts")
      .select("holder_name, iban, swift, account_number, currency")
      .eq("user_id", uid)
      .maybeSingle();

    return {
      protocol: tr.protocol ?? null,
      id: tr.id,
      status: tr.status as TransferStatus,
      created_at: tr.created_at,

      // Source Account
      source_holder_name: (acc as any)?.holder_name ?? null,
      source_iban: (acc as any)?.iban ?? null,
      source_swift: (acc as any)?.swift ?? null,
      source_account_number: (acc as any)?.account_number ?? null,
      source_currency: (acc as any)?.currency ?? tr.currency_from ?? "GBP",

      // Beneficiary / Destination
      beneficiary_name: tr.beneficiary_name,
      destination_bank: tr.bank_name,
      destination_swift: tr.swift,
      destination_account_number: tr.account_number,
      destination_country: tr.to_country,

      // Amounts & Exchange
      amount: Number(tr.amount),
      currency_from: tr.currency_from,
      currency_to: tr.currency_to,
      fx_rate: Number(tr.fx_rate),
      converted_amount: Number(tr.converted_amount),

      // Details
      reference: tr.reference ?? null,
      rejection_reason: tr.rejection_reason ?? null,
    };
  });

/**
 * Customer transfers list server function.
 * Used by the customer extrato/comprovantes view to list all transfer operations.
 */
export const listMyTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ transfers: TransferRow[] }> => {
    const uid = context.userId;

    const { data: trs, error } = await supabaseAdmin
      .from("transfer_requests")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const transfers: TransferRow[] = (trs ?? []).map((t: any) => ({
      id: t.id,
      protocol: t.protocol ?? null,
      user_id: t.user_id,
      full_name: null,
      email: null,
      beneficiary_name: t.beneficiary_name,
      beneficiary_doc: t.beneficiary_doc,
      beneficiary_email: t.beneficiary_email,
      bank_name: t.bank_name,
      swift: t.swift,
      account_number: t.account_number,
      to_country: t.to_country,
      currency_from: t.currency_from,
      currency_to: t.currency_to,
      amount: Number(t.amount),
      fx_rate: Number(t.fx_rate),
      converted_amount: Number(t.converted_amount),
      purpose: t.purpose,
      reference: t.reference,
      hmrc_doc_path: t.hmrc_doc_path,
      hmrc_doc_url: null,
      status: t.status as TransferStatus,
      rejection_reason: t.rejection_reason ?? null,
      created_at: t.created_at,
    }));

    return { transfers };
  });

