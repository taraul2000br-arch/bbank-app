import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireBackendAuth as requireSupabaseAuth } from "./backend-auth";
import { supabaseAdmin } from "./supabase-admin.server";
import { assertMaster, getAdminLevel } from "./admin.functions";

export type AdminPlanRow = {
  admin_user_id: string;
  email: string | null;
  full_name: string | null;
  level: "master" | "geral" | "comum";
  plan_id: string | null;
  plan_name: string | null;
  expires_at: string | null;
  notes: string | null;
};

export type MyAdminPlan = {
  plan_name: string;
  expires_at: string;
  notes: string | null;
} | null;

export const getMyAdminPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyAdminPlan> => {
    const lvl = await getAdminLevel(context.userId);
    if (!lvl || lvl === "master") return null;
    const { data } = await supabaseAdmin
      .from("admin_plans")
      .select("plan_name, expires_at, notes")
      .eq("admin_user_id", context.userId)
      .maybeSingle();
    if (!data) return null;
    return { plan_name: data.plan_name, expires_at: data.expires_at, notes: data.notes };
  });

export const listAdminPlans = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminPlanRow[] }> => {
    await assertMaster(context.userId);
    const [{ data: roles }, { data: profiles }, { data: plans }, authList] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role").in("role", ["adm_geral", "adm_comum"] as any),
      supabaseAdmin.from("profiles").select("user_id, full_name"),
      supabaseAdmin.from("admin_plans").select("id, admin_user_id, plan_name, expires_at, notes"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const emailMap = new Map((authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
    const planMap = new Map((plans ?? []).map((p: any) => [p.admin_user_id, p]));
    const rows: AdminPlanRow[] = (roles ?? []).map((r: any) => {
      const lvl: "geral" | "comum" = r.role === "adm_geral" ? "geral" : "comum";
      const plan = planMap.get(r.user_id);
      return {
        admin_user_id: r.user_id,
        email: emailMap.get(r.user_id) ?? null,
        full_name: profMap.get(r.user_id) ?? null,
        level: lvl,
        plan_id: plan?.id ?? null,
        plan_name: plan?.plan_name ?? null,
        expires_at: plan?.expires_at ?? null,
        notes: plan?.notes ?? null,
      };
    });
    rows.sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
    return { rows };
  });

export const upsertAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      admin_user_id: z.string().uuid(),
      plan_name: z.string().trim().min(1).max(80),
      expires_at: z.string().min(10).max(40),
      notes: z.string().trim().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const lvl = await getAdminLevel(data.admin_user_id);
    if (lvl !== "geral" && lvl !== "comum") throw new Error("Alvo não é um admin com plano");
    const exp = new Date(data.expires_at);
    if (Number.isNaN(exp.getTime())) throw new Error("Data de expiração inválida");
    const { error } = await supabaseAdmin
      .from("admin_plans")
      .upsert({
        admin_user_id: data.admin_user_id,
        plan_name: data.plan_name,
        expires_at: exp.toISOString(),
        notes: data.notes ?? null,
        created_by: context.userId,
      }, { onConflict: "admin_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ admin_user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const { error } = await supabaseAdmin.from("admin_plans").delete().eq("admin_user_id", data.admin_user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bulkUpsertAdminPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      plan_name: z.string().trim().min(1).max(80),
      expires_at: z.string().min(10).max(40),
      notes: z.string().trim().max(500).optional().nullable(),
      scope: z.enum(["all", "geral", "comum"]).default("all"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const exp = new Date(data.expires_at);
    if (Number.isNaN(exp.getTime())) throw new Error("Data de expiração inválida");
    const roles = data.scope === "all"
      ? (["adm_geral", "adm_comum"] as const)
      : data.scope === "geral" ? (["adm_geral"] as const) : (["adm_comum"] as const);
    const { data: targets, error: rolesErr } = await supabaseAdmin
      .from("user_roles").select("user_id").in("role", roles as any);
    if (rolesErr) throw new Error(rolesErr.message);
    const rows = (targets ?? []).map((r: any) => ({
      admin_user_id: r.user_id,
      plan_name: data.plan_name,
      expires_at: exp.toISOString(),
      notes: data.notes ?? null,
      created_by: context.userId,
    }));
    if (rows.length === 0) return { ok: true, count: 0 };
    const { error } = await supabaseAdmin
      .from("admin_plans")
      .upsert(rows, { onConflict: "admin_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

