import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserAuth as requireSupabaseAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import { assertAdmin, assertCanSee, assertNotReadOnlyAdmin, getAdminLevel } from "./admin.functions";
import { extractSortCode } from "./two-factor-auth.functions";

export type KycStatus = "not_started" | "pending" | "approved" | "rejected";
export type KycPart = "statement1" | "statement2" | "document" | "liveness" | "profile";
export const ALL_KYC_PARTS: KycPart[] = ["statement1", "statement2", "document", "liveness"];

export const getMyKycStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    status: KycStatus;
    sortCode: string | null;
    rejection_reason: string | null;
    rejected_parts: KycPart[];
    prev_paths: { statement1: string | null; statement2: string | null; document: string | null; documentBack: string | null; video: string | null };
  }> => {
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("kyc_status")
      .eq("user_id", context.userId)
      .maybeSingle();
    const status = ((prof as any)?.kyc_status ?? "not_started") as KycStatus;

    let sortCode: string | null = null;
    if (status === "approved") {
      const { data: acc } = await supabaseAdmin
        .from("accounts")
        .select("account_number, iban")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (acc) {
        sortCode = extractSortCode((acc as any).account_number, (acc as any).iban);
      }
    }

    const { data: latest } = await supabaseAdmin
      .from("kyc_submissions")
      .select("rejection_reason, rejected_parts, statement1_path, statement2_path, liveness_paths")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const s: any = latest ?? {};
    const liveness = (s.liveness_paths ?? []) as string[];
    // Layout: [docFront, docBack?, video] — video is always the last entry.
    const video = liveness.length > 0 ? liveness[liveness.length - 1] : null;
    const docFront = liveness.length >= 2 ? liveness[0] : null;
    const docBack = liveness.length >= 3 ? liveness[1] : null;
    return {
      status,
      sortCode,
      rejection_reason: s.rejection_reason ?? null,
      rejected_parts: (s.rejected_parts ?? []) as KycPart[],
      prev_paths: {
        statement1: s.statement1_path ?? null,
        statement2: s.statement2_path ?? null,
        document: docFront,
        documentBack: docBack,
        video,
      },
    };
  });

const ALLOWED_STATEMENT_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "webp", "heic"];
const ALLOWED_DOCUMENT_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "heic", "pdf"];
const ALLOWED_LIVENESS_EXTENSIONS = ["webm", "mp4", "mov"];

export function validateSafeKycFilePath(
  userId: string,
  filePath: string,
  allowedFolder: "statements" | "document" | "liveness",
  allowedExtensions: string[]
): void {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("Invalid document path format");
  }

  // Reject path traversal / directory escaping attempts
  if (
    filePath.includes("..") ||
    filePath.includes("\\") ||
    filePath.includes("\0") ||
    filePath.includes("//") ||
    filePath.includes("%2e") ||
    filePath.includes("%2f")
  ) {
    throw new Error("Path traversal characters not allowed in file path");
  }

  // Must strictly start with `${userId}/${allowedFolder}/`
  const expectedPrefix = `${userId}/${allowedFolder}/`;
  if (!filePath.startsWith(expectedPrefix)) {
    throw new Error(`File path must start with ${expectedPrefix}`);
  }

  // Extract filename
  const filename = filePath.slice(expectedPrefix.length);
  if (!filename || filename.includes("/")) {
    throw new Error("Nested subdirectories are not permitted in file path");
  }

  // Filename characters: only letters, digits, underscores, hyphens, and single dot for extension
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) {
    throw new Error("Filename contains invalid characters or multiple extensions");
  }

  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    throw new Error(`File extension .${ext} is not allowed for ${allowedFolder}`);
  }
}

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      statement1_path: z.string().min(3).max(500),
      statement2_path: z.string().min(3).max(500),
      liveness_paths: z.array(z.string().min(3).max(500)).min(1).max(12),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const uid = context.userId;

    // Rigorous path traversal, folder layout and extension validation
    validateSafeKycFilePath(uid, data.statement1_path, "statements", ALLOWED_STATEMENT_EXTENSIONS);
    validateSafeKycFilePath(uid, data.statement2_path, "statements", ALLOWED_STATEMENT_EXTENSIONS);

    for (const p of data.liveness_paths) {
      if (p.startsWith(`${uid}/document/`)) {
        validateSafeKycFilePath(uid, p, "document", ALLOWED_DOCUMENT_EXTENSIONS);
      } else if (p.startsWith(`${uid}/liveness/`)) {
        validateSafeKycFilePath(uid, p, "liveness", ALLOWED_LIVENESS_EXTENSIONS);
      } else {
        throw new Error("Invalid folder structure in liveness file path");
      }
    }

    const { error: insErr } = await supabaseAdmin.from("kyc_submissions").insert({
      user_id: uid,
      statement1_path: data.statement1_path,
      statement2_path: data.statement2_path,
      liveness_paths: data.liveness_paths,
      status: "pending",
    });
    if (insErr) throw new Error(insErr.message);
    await supabaseAdmin.from("profiles").update({ kyc_status: "pending" }).eq("user_id", uid);
    return { ok: true };
  });

export type KycSubmissionDetail = {
  id: string;
  status: KycStatus;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  statement1_url: string | null;
  statement2_url: string | null;
  liveness_urls: string[];
};

async function sign(path: string): Promise<string | null> {
  const { data } = await supabaseAdmin.storage.from("kyc-documents").createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

export const getKycSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<KycSubmissionDetail | null> => {
    await assertCanSee(context.userId, data.user_id);
    const { data: sub } = await supabaseAdmin
      .from("kyc_submissions")
      .select("*")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) return null;
    const s: any = sub;
    const [s1, s2, ...rest] = await Promise.all([
      sign(s.statement1_path),
      sign(s.statement2_path),
      ...((s.liveness_paths as string[]) ?? []).map(sign),
    ]);
    return {
      id: s.id,
      status: s.status,
      rejection_reason: s.rejection_reason,
      created_at: s.created_at,
      reviewed_at: s.reviewed_at,
      statement1_url: s1,
      statement2_url: s2,
      liveness_urls: rest.filter((u): u is string => !!u),
    };
  });

export const reviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      decision: z.enum(["approved", "rejected"]),
      reason: z.string().max(500).optional(),
      rejected_parts: z.array(z.enum(["statement1", "statement2", "document", "liveness", "profile"])).optional(),
      holder_name: z.string().trim().min(2).max(160).optional(),
      iban: z.string().trim().max(34).regex(/^[A-Z0-9 ]*$/i).optional(),
      swift: z.string().trim().max(11).regex(/^[A-Z0-9]*$/i).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const lvl = await assertAdmin(context.userId);
    await assertCanSee(context.userId, data.user_id);
    await assertNotReadOnlyAdmin(context.userId, data.user_id);
    if (data.decision === "approved") {
      if (!data.holder_name) throw new Error("Nome do titular é obrigatório para aprovar");
    }
    if (data.decision === "rejected") {
      if (!data.rejected_parts || data.rejected_parts.length === 0) {
        throw new Error("Selecione pelo menos uma parte para o cliente refazer");
      }
      if (data.rejected_parts.includes("profile") && !(data.reason ?? "").trim()) {
        throw new Error("Descreva o motivo da recusa por dados incompletos");
      }
    }
    const { data: sub } = await supabaseAdmin
      .from("kyc_submissions")
      .select("id")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!sub) throw new Error("Sem KYC pendente");
    await supabaseAdmin.from("kyc_submissions").update({
      status: data.decision,
      rejection_reason: data.decision === "rejected" ? (data.reason ?? null) : null,
      rejected_parts: data.decision === "rejected" ? (data.rejected_parts ?? []) : [],
      reviewed_by: context.userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", (sub as any).id);
    await supabaseAdmin.from("profiles").update({
      kyc_status: data.decision,
      kyc_reviewed_by: context.userId,
      kyc_reviewed_at: new Date().toISOString(),
    }).eq("user_id", data.user_id);
    if (data.decision === "approved") {
      const iban = (data.iban ?? "").replace(/\s+/g, "").toUpperCase();
      const swift = (data.swift ?? "").replace(/\s+/g, "").toUpperCase();
      const holder_name = data.holder_name!;
      await supabaseAdmin.from("accounts").update({ iban, swift, holder_name }).eq("user_id", data.user_id);
    }
    return { ok: true };
  });

// Cliente reenvia os dados cadastrais quando o ADM recusou por "dados incompletos".
export const updateMyKycProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      full_name: z.string().trim().min(2).max(160),
      document_type: z.enum(["cpf", "ssn", "nif", "dni", "passport", "other"]),
      document_number: z.string().trim().min(3).max(40),
      phone: z.string().trim().max(40).optional(),
      birth_date: z.string().trim().max(10).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Permitido somente se houver uma recusa formal de KYC com solicitação de reenvio de dados ("profile") ou se for admin
    const { data: latest } = await supabaseAdmin
      .from("kyc_submissions")
      .select("status, rejected_parts")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const isRejectedWithProfile =
      latest?.status === "rejected" &&
      Array.isArray(latest?.rejected_parts) &&
      latest.rejected_parts.includes("profile");

    if (!isRejectedWithProfile) {
      const adminLevel = await getAdminLevel(context.userId);
      if (!adminLevel) {
        throw new Error(
          "A alteração de dados cadastrais pelo cliente está desabilitada após a criação da conta. Entre em contato com o suporte ou seu gerente de relacionamento."
        );
      }
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        document_type: data.document_type as any,
        document_number: data.document_number,
        phone: data.phone || null,
        birth_date: data.birth_date ? data.birth_date : null,
      })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyKycProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("full_name, document_type, document_number, phone, birth_date")
      .eq("user_id", context.userId)
      .maybeSingle();
    const p: any = data ?? {};
    return {
      full_name: (p.full_name ?? "") as string,
      document_type: (p.document_type ?? "nif") as string,
      document_number: (p.document_number ?? "") as string,
      phone: (p.phone ?? "") as string,
      birth_date: (p.birth_date ?? "") as string,
    };
  });

export const getKycStatusByUserId = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data: { userId }, context }): Promise<{ status: KycStatus }> => {
    if (context.userId !== userId) {
      const lvl = await getAdminLevel(context.userId);
      if (!lvl) {
        throw new Error("Forbidden: Cannot access KYC status of another client");
      }
      await assertCanSee(context.userId, userId);
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("kyc_status")
      .eq("user_id", userId)
      .maybeSingle();
    return { status: ((prof as any)?.kyc_status ?? "not_started") as KycStatus };
  });
