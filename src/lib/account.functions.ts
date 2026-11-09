import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireUserAuth as requireSupabaseAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import { getAdminLevel, assertCanSee, assertNotReadOnlyAdmin } from "./admin.functions";

type Tx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

type Profile = {
  full_name: string | null;
  document_type: string | null;
  document_number: string | null;
  phone: string | null;
  birth_date: string | null;
  country: string;
  avatar_url: string | null;
  kyc_status: string;
  created_at: string;
  account_blocked: boolean;
  account_blocked_at: string | null;
  transfer_locked: boolean;
};

type PendingTransfer = {
  id: string;
  amount: number;
  beneficiary_name: string | null;
  to_country: string | null;
  purpose: string | null;
  reference: string | null;
  created_at: string;
};

export type AccountDashboard = {
  account: {
    balance: number;
    currency: string;
    accountNumber: string;
    iban: string;
  };
  profile: Profile | null;
  transactions: Tx[];
  pendingTransfers: PendingTransfer[];
};

export const getMyAccountDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountDashboard> => {
    const uid = context.userId;

    const [{ data: account }, { data: profile }, { data: transactions }, { data: pendingTransfers }] =
      await Promise.all([
        supabaseAdmin
          .from("accounts")
          .select("balance, currency, account_number, iban")
          .eq("user_id", uid)
          .maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("full_name, document_type, document_number, phone, birth_date, country, avatar_url, kyc_status, created_at, account_blocked, account_blocked_at, transfer_locked")
          .eq("user_id", uid)
          .maybeSingle(),
        supabaseAdmin
          .from("transactions")
          .select("id, type, amount, description, created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("transfer_requests")
          .select("id, protocol, amount, beneficiary_name, to_country, purpose, reference, created_at")
          .eq("user_id", uid)
          .eq("status", "solicitado")
          .order("created_at", { ascending: false }),
      ]);

    const isApproved = (profile as any)?.kyc_status === "approved";

    return {
      account: {
        balance: isApproved ? Number((account as any)?.balance ?? 0) : 0,
        currency: (account as any)?.currency ?? "GBP",
        accountNumber: isApproved ? ((account as any)?.account_number ?? "") : "",
        iban: isApproved ? ((account as any)?.iban ?? "") : "",
      },
      profile: profile
        ? ({ ...(profile as any), transfer_locked: (profile as any).transfer_locked === true } as Profile)
        : null,
      transactions: isApproved
        ? ((transactions ?? []) as Tx[]).map((tx) => ({ ...tx, amount: Number(tx.amount) }))
        : [],
      pendingTransfers: isApproved
        ? ((pendingTransfers ?? []) as any[]).map((transfer) => ({
            ...transfer,
            protocol: transfer.protocol ?? null,
            amount: Number(transfer.amount),
          }))
        : [],
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      full_name: z.string().trim().min(2, "Full name must be at least 2 characters").max(160).optional(),
      phone: z.string().trim().max(40).optional().nullable(),
      country: z.string().trim().min(2).max(60).optional().nullable(),
      birth_date: z.string().trim().max(10).optional().nullable(),
      document_type: z.string().trim().max(30).optional().nullable(),
      document_number: z.string().trim().max(40).optional().nullable(),
      target_user_id: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const adminLevel = await getAdminLevel(actorId);

    // Regular customers are strictly prohibited from modifying registration data after signup
    if (!adminLevel) {
      throw new Error(
        "A alteração de dados cadastrais pelo cliente está desabilitada após a criação da conta. Entre em contato com o suporte ou seu gerente de relacionamento."
      );
    }

    // Authorized administrator updating client profile (respecting portfolio scope & read-only restrictions)
    const targetUserId = data.target_user_id || actorId;
    await assertCanSee(actorId, targetUserId);
    await assertNotReadOnlyAdmin(actorId, targetUserId);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.full_name !== undefined) updatePayload.full_name = data.full_name;
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.country !== undefined) updatePayload.country = data.country?.trim() || "GB";
    if (data.birth_date !== undefined) updatePayload.birth_date = data.birth_date?.trim() || null;
    if (data.document_type !== undefined) updatePayload.document_type = data.document_type?.trim() || null;
    if (data.document_number !== undefined) updatePayload.document_number = data.document_number?.trim() || null;

    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload as any)
      .eq("user_id", targetUserId);

    if (updateErr) {
      console.error("Error updating profile in Supabase:", updateErr);
      throw new Error("Falha ao atualizar dados cadastrais.");
    }

    return { ok: true };
  });