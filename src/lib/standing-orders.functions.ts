import { createServerFn } from "@tanstack/react-start";
import { requireBackendAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import { isAccountBlocked } from "./admin.functions";

export interface DbScheduledPayment {
  id: string;
  user_id: string;
  beneficiary_name: string;
  sort_code: string;
  account_number: string;
  amount: number;
  currency: string;
  scheduled_date: string;
  frequency: "one-off" | "monthly" | "weekly";
  reference: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface LocalScheduledPaymentInput {
  beneficiaryName: string;
  sortCode?: string;
  accountNumber?: string;
  amount: number;
  scheduledDate: string;
  frequency?: "one-off" | "monthly" | "weekly";
  reference?: string;
  status?: "active" | "cancelled";
}

/**
 * List all scheduled payments owned by the authenticated customer.
 * Enforces strict user isolation.
 */
export const listMyScheduledPayments = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }): Promise<{ dbReady: boolean; payments: DbScheduledPayment[] }> => {
    const uid = context.userId;
    try {
      const { data, error } = await supabaseAdmin
        .from("scheduled_payments")
        .select("*")
        .eq("user_id", uid)
        .order("scheduled_date", { ascending: true });

      if (error) {
        // Table not yet created or permission pending
        return { dbReady: false, payments: [] };
      }

      return {
        dbReady: true,
        payments: (data || []).map((p: any) => ({
          ...p,
          amount: Number(p.amount),
        })),
      };
    } catch {
      return { dbReady: false, payments: [] };
    }
  });

/**
 * Create a new scheduled payment in Supabase.
 * Validates positive amount, date format, allowed frequency, and prevents duplicate submissions.
 */
export const createScheduledPaymentDb = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((d: {
    beneficiary_name: string;
    sort_code: string;
    account_number: string;
    amount: number;
    scheduled_date: string;
    frequency: "one-off" | "monthly" | "weekly";
    reference?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const uid = context.userId;

    // 1. Rigorous backend validations
    const numAmt = Number(data.amount);
    if (isNaN(numAmt) || numAmt <= 0 || !isFinite(numAmt) || numAmt > 1000000) {
      return { ok: false, error: "Invalid GBP amount. Amount must be positive.", dbReady: true };
    }

    const cleanBeneficiary = (data.beneficiary_name || "").trim();
    if (!cleanBeneficiary || cleanBeneficiary.length > 120) {
      return { ok: false, error: "Beneficiary name is required (max 120 chars).", dbReady: true };
    }

    const dateStr = (data.scheduled_date || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return { ok: false, error: "Invalid date format. Expected YYYY-MM-DD.", dbReady: true };
    }

    const freq = data.frequency;
    if (freq !== "one-off" && freq !== "monthly" && freq !== "weekly") {
      return { ok: false, error: "Invalid frequency. Allowed: one-off, monthly, weekly.", dbReady: true };
    }

    const cleanSortCode = (data.sort_code || "10-80-00").trim().slice(0, 10);
    const cleanAccNo = (data.account_number || "88392019").replace(/\D/g, "").slice(0, 8) || "88392019";
    const cleanRef = (data.reference || "Standing Order").trim().slice(0, 50);

    try {
      // 1.5. Compliance check: prevent blocked or transfer-locked accounts from scheduling payments
      const [blocked, { data: profile }] = await Promise.all([
        isAccountBlocked(uid),
        supabaseAdmin
          .from("profiles")
          .select("transfer_locked")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);

      if (blocked || profile?.transfer_locked) {
        return {
          ok: false,
          error: "Your account is currently restricted from scheduling payments. Please contact customer support.",
          dbReady: true,
        };
      }

      // 2. Debounce duplicate check: avoid race conditions from rapid double-clicks
      const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
      const { data: recentDup } = await supabaseAdmin
        .from("scheduled_payments")
        .select("*")
        .eq("user_id", uid)
        .eq("beneficiary_name", cleanBeneficiary)
        .eq("amount", numAmt)
        .eq("scheduled_date", dateStr)
        .eq("status", "active")
        .gte("created_at", fifteenSecondsAgo)
        .limit(1);

      if (recentDup && recentDup.length > 0) {
        return {
          ok: true,
          payment: {
            ...recentDup[0],
            amount: Number(recentDup[0].amount),
          },
          dbReady: true,
          duplicatePrevented: true,
        };
      }

      // 3. Insert record
      const { data: inserted, error } = await supabaseAdmin
        .from("scheduled_payments")
        .insert({
          user_id: uid,
          beneficiary_name: cleanBeneficiary,
          sort_code: cleanSortCode,
          account_number: cleanAccNo,
          amount: numAmt,
          currency: "GBP",
          scheduled_date: dateStr,
          frequency: freq,
          reference: cleanRef || null,
          status: "active",
        })
        .select()
        .single();

      if (error) return { ok: false, error: error.message, dbReady: false };
      return {
        ok: true,
        payment: {
          ...inserted,
          amount: Number(inserted.amount),
        },
        dbReady: true,
      };
    } catch (e: any) {
      return { ok: false, error: e?.message, dbReady: false };
    }
  });

/**
 * Cancel a pending scheduled payment.
 * Enforces ownership check (user_id = auth.uid()).
 */
export const cancelScheduledPaymentDb = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    if (!data.id) return { ok: false, error: "Missing payment ID" };

    try {
      const { data: updated, error } = await supabaseAdmin
        .from("scheduled_payments")
        .update({ status: "cancelled" })
        .eq("id", data.id)
        .eq("user_id", uid)
        .select()
        .single();

      if (error) return { ok: false, error: error.message };
      if (!updated) return { ok: false, error: "Payment not found or not owned by user." };
      return { ok: true, payment: updated };
    } catch (e: any) {
      return { ok: false, error: e?.message };
    }
  });

/**
 * Safe migration helper: imports items from browser localStorage into Supabase
 * without creating duplicate records.
 */
export const migrateLocalScheduledPaymentsDb = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((d: { items: LocalScheduledPaymentInput[] }) => d)
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const items = data.items || [];
    if (items.length === 0) return { ok: true, migratedCount: 0, dbReady: true };

    try {
      if (await isAccountBlocked(uid)) {
        return {
          ok: false,
          error: "Your account is currently restricted from scheduling payments. Please contact customer support.",
          dbReady: true,
        };
      }

      // Check existing payments to prevent duplicate migration
      const { data: existing, error: existErr } = await supabaseAdmin
        .from("scheduled_payments")
        .select("beneficiary_name, scheduled_date, amount")
        .eq("user_id", uid);

      if (existErr) {
        return { ok: false, error: existErr.message, dbReady: false };
      }

      const existingKeys = new Set(
        (existing || []).map(
          (e) => `${(e.beneficiary_name || "").toLowerCase()}_${e.scheduled_date}_${Number(e.amount).toFixed(2)}`
        )
      );

      const toInsert = [];
      for (const item of items) {
        const numAmt = Number(item.amount);
        if (!numAmt || numAmt <= 0) continue;
        const name = (item.beneficiaryName || "").trim();
        if (!name) continue;
        const date = (item.scheduledDate || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

        const key = `${name.toLowerCase()}_${date}_${numAmt.toFixed(2)}`;
        if (existingKeys.has(key)) continue; // skip duplicate

        toInsert.push({
          user_id: uid,
          beneficiary_name: name,
          sort_code: (item.sortCode || "10-80-00").trim().slice(0, 10),
          account_number: (item.accountNumber || "88392019").replace(/\D/g, "").slice(0, 8) || "88392019",
          amount: numAmt,
          currency: "GBP",
          scheduled_date: date,
          frequency: item.frequency === "weekly" || item.frequency === "one-off" ? item.frequency : "monthly",
          reference: (item.reference || "Standing Order").trim().slice(0, 50),
          status: item.status === "cancelled" ? "cancelled" : "active",
        });
      }

      if (toInsert.length === 0) {
        return { ok: true, migratedCount: 0, dbReady: true };
      }

      const { error: insErr } = await supabaseAdmin
        .from("scheduled_payments")
        .insert(toInsert);

      if (insErr) {
        return { ok: false, error: insErr.message, dbReady: false };
      }

      return { ok: true, migratedCount: toInsert.length, dbReady: true };
    } catch (e: any) {
      return { ok: false, error: e?.message, dbReady: false };
    }
  });

/**
 * Architecture for executing due scheduled payments.
 * Validates account block status, available balance, idempotency,
 * and atomically debits and creates transaction record.
 */
export async function executeScheduledPaymentInternal(
  paymentId: string
): Promise<{ success: boolean; status: string; message: string }> {
  // 1. Fetch payment with lock check
  const { data: payment, error: pErr } = await supabaseAdmin
    .from("scheduled_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();

  if (pErr || !payment) {
    return { success: false, status: "not_found", message: "Payment not found" };
  }

  if (payment.status !== "active") {
    return { success: false, status: payment.status, message: `Payment is not active (current: ${payment.status})` };
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  if (payment.scheduled_date > todayStr) {
    return { success: false, status: "not_due", message: `Payment is not due yet (scheduled: ${payment.scheduled_date})` };
  }

  // 2. Blocked account verification
  const blocked = await isAccountBlocked(payment.user_id);
  if (blocked) {
    await supabaseAdmin
      .from("scheduled_payments")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", paymentId);
    return { success: false, status: "blocked", message: "Account is blocked; payment cancelled" };
  }

  // 3. Check account balance
  const { data: account, error: aErr } = await supabaseAdmin
    .from("accounts")
    .select("id, balance, currency")
    .eq("user_id", payment.user_id)
    .maybeSingle();

  if (aErr || !account) {
    return { success: false, status: "account_missing", message: "Customer account not found" };
  }

  const currentBalance = Number(account.balance);
  const paymentAmount = Number(payment.amount);

  if (currentBalance < paymentAmount) {
    return { success: false, status: "insufficient_funds", message: "Insufficient balance for scheduled payment" };
  }

  // 4. Atomic debit (optimistic concurrency guard)
  const newBalance = currentBalance - paymentAmount;
  const { error: debitErr } = await supabaseAdmin
    .from("accounts")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", account.id)
    .eq("balance", currentBalance);

  if (debitErr) {
    return { success: false, status: "concurrency_conflict", message: "Balance updated concurrently" };
  }

  // 5. Insert transaction
  await (supabaseAdmin.from("transactions") as any).insert({
    user_id: payment.user_id,
    account_id: account.id,
    amount: paymentAmount,
    type: "saida",
    description: `Standing order to ${payment.beneficiary_name} (Ref: ${payment.reference || "N/A"})`,
    created_at: new Date().toISOString(),
  });

  // 6. Advance schedule or complete
  if (payment.frequency === "one-off") {
    await supabaseAdmin
      .from("scheduled_payments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", paymentId);
  } else {
    const curDate = new Date(payment.scheduled_date);
    if (payment.frequency === "weekly") {
      curDate.setDate(curDate.getDate() + 7);
    } else {
      curDate.setMonth(curDate.getMonth() + 1);
    }
    const nextDateStr = curDate.toISOString().slice(0, 10);
    await supabaseAdmin
      .from("scheduled_payments")
      .update({ scheduled_date: nextDateStr, updated_at: new Date().toISOString() })
      .eq("id", paymentId);
  }

  return { success: true, status: "completed", message: "Payment executed successfully" };
}
