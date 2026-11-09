import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireBackendAuth, requireBackendAuth as requireSupabaseAuth, requireUserAuth } from "./backend-auth";
type AdminClient = typeof import("./supabase-admin.server")["supabaseAdmin"];
let _admin: AdminClient | null = null;
async function getAdmin(): Promise<AdminClient> {
  if (!_admin) {
    const mod = await import("./supabase-admin.server");
    _admin = mod.supabaseAdmin;
  }
  return _admin;
}

function extractClientIp(req: Request | undefined): string | null {
  if (!req) return null;
  const h = req.headers;
  const candidates = [
    h.get("cf-connecting-ip"),
    h.get("x-real-ip"),
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    h.get("x-client-ip"),
  ];
  return candidates.find((v) => !!v) ?? null;
}

export const recordLoginEvent = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input) =>
    z.object({ event_type: z.enum(["signup", "login"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const req = getRequest();
    const ip = extractClientIp(req);
    const ua = req?.headers.get("user-agent") ?? null;
    await supabaseAdmin.from("user_login_events").insert({
      user_id: context.userId,
      event_type: data.event_type,
      ip_address: ip,
      user_agent: ua,
    });
    return { ok: true };
  });

export const validateReferralCode = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ code: z.string().trim().min(2).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdmin();
    const code = data.code.toUpperCase();
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("user_id")
      .eq("referral_code", code)
      .maybeSingle();
    if (!prof) return { ok: false as const };
    return { ok: true as const };
  });

export type AdminRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  referral_code: string | null;
  level: AdminLevel;
  created_at: string;
  client_count: number;
};

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireBackendAuth])
  .handler(async ({ context }): Promise<{ rows: AdminRow[]; viewerLevel: AdminLevel }> => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const viewerLevel = (await getEffectiveViewLevel(context.userId))!;
    const readOnly = await isReadOnlyAdmin(context.userId);
    if (viewerLevel === "comum") return { rows: [], viewerLevel };
    const [{ data: roles }, { data: profiles }, authList] = await Promise.all([
      supabaseAdmin.from("user_roles").select("user_id, role")
        .in("role", ["admin", "adm_geral", "adm_comum"] as any),
      supabaseAdmin.from("profiles").select("user_id, full_name, referral_code, created_at, referred_by"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const emailMap = new Map((authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    const countMap = new Map<string, number>();
    for (const p of profiles ?? []) {
      const ref = (p as any).referred_by;
      if (ref) countMap.set(ref, (countMap.get(ref) ?? 0) + 1);
    }
    const levelOf = (role: string): AdminLevel =>
      role === "admin" ? "master" : role === "adm_geral" ? "geral" : "comum";
    const rows: AdminRow[] = [];
    for (const r of roles ?? []) {
      const lvl = levelOf(r.role);
      // geral só vê adm_comum
      if (viewerLevel === "geral" && lvl !== "comum") continue;
      const p = profMap.get(r.user_id) as any;
      rows.push({
        user_id: r.user_id,
        email: emailMap.get(r.user_id) ?? null,
        full_name: p?.full_name ?? null,
        referral_code: p?.referral_code ?? null,
        level: lvl,
        created_at: p?.created_at ?? "",
        client_count: countMap.get(r.user_id) ?? 0,
      });
    }
    rows.sort((a, b) => (a.level === "master" ? -1 : b.level === "master" ? 1 : a.level === "geral" ? -1 : 1));
    return { rows, viewerLevel };
  });

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(72),
      full_name: z.string().trim().min(2).max(120),
      level: z.enum(["geral", "comum"]),
      referral_code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9]+$/).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertMaster(context.userId);
    // generate/validate code
    let code = (data.referral_code ?? "").toUpperCase();
    if (!code) {
      for (let i = 0; i < 6; i++) {
        const candidate = genCode();
        const { data: ex } = await supabaseAdmin.from("profiles").select("user_id").eq("referral_code", candidate).maybeSingle();
        if (!ex) { code = candidate; break; }
      }
      if (!code) throw new Error("Falha ao gerar código");
    } else {
      const { data: ex } = await supabaseAdmin.from("profiles").select("user_id").eq("referral_code", code).maybeSingle();
      if (ex) throw new Error("Código já está em uso");
    }

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name, country: "BR" },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Falha ao criar usuário");
    const uid = created.user.id;

    // trigger creates profile/account/role(user); upsert profile + code
    await supabaseAdmin.from("profiles").update({ full_name: data.full_name, referral_code: code }).eq("user_id", uid);
    // replace default role with chosen admin role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({
      user_id: uid,
      role: (data.level === "geral" ? "adm_geral" : "adm_comum") as any,
    });

    // create default active plan for newly created admin (30 days validity)
    const initialPlanExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin.from("admin_plans").upsert({
      admin_user_id: uid,
      plan_name: data.level === "geral" ? "Plano Geral (Ativo)" : "Plano Comum (Ativo)",
      expires_at: initialPlanExpires,
      created_by: context.userId,
    }, { onConflict: "admin_user_id" });

    return { ok: true, user_id: uid, referral_code: code };
  });

export const updateAdminCode = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      referral_code: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9]+$/),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertCanEditAdmin(context.userId, data.user_id);
    const code = data.referral_code.toUpperCase();
    const { data: ex } = await supabaseAdmin.from("profiles").select("user_id").eq("referral_code", code).maybeSingle();
    if (ex && (ex as any).user_id !== data.user_id) throw new Error("Código já está em uso");
    const { error } = await supabaseAdmin.from("profiles").update({ referral_code: code }).eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo");
    await assertCanEditAdmin(context.userId, data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Exclui um cliente (não-admin). Apenas o adm master pode executar.
export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertMaster(context.userId);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const targetLvl = await getAdminLevel(data.user_id);
    if (targetLvl) throw new Error("Use a tela de Administradores para excluir contas administrativas");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      password: z.string().min(6).max(72),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    // Apenas o adm master pode alterar a senha de outros admins.
    await assertMaster(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      password: z.string().min(6).max(72),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const actorLvl = await assertAdmin(context.userId);

    // REGRA OBRIGATÓRIA: ADM Geral e ADM Comum NÃO podem alterar a própria senha
    if (data.user_id === context.userId && actorLvl !== "master") {
      throw new Error(
        "Acesso negado: Administradores dos níveis ADM Geral e ADM Comum não têm permissão para alterar a própria senha."
      );
    }

    // Se o alvo é um admin (comum/geral/master), apenas o master pode alterar a senha.
    const targetLvl = await getAdminLevel(data.user_id);
    if (targetLvl && actorLvl !== "master") {
      throw new Error("Apenas o adm master pode alterar a senha de contas administrativas");
    }
    if (!targetLvl) {
      await assertCanSee(context.userId, data.user_id);
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateMasterSelfPassword = createServerFn({ method: "POST" })
  .middleware([requireBackendAuth])
  .validator((input: unknown) =>
    z.object({
      current_password: z.string().min(1).max(128),
      new_password: z.string().min(8).max(128),
      sign_out_others: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // 1. Strictly verify the caller is ADMIN MASTER in database (user_roles)
    await assertMaster(context.userId);
    const supabaseAdmin = await getAdmin();

    // 2. Fetch the user record to get email for re-authentication
    const { data: userRecord, error: userFetchErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (userFetchErr || !userRecord?.user?.email) {
      throw new Error("Usuário não encontrado.");
    }

    // 3. Re-authenticate current password
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://rbhczirsgprmynpiudmi.supabase.co";
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_lasza5Kvnwb_BwH-09DqIQ_pt1Authi";
    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: signInErr } = await authClient.auth.signInWithPassword({
      email: userRecord.user.email,
      password: data.current_password,
    });
    if (signInErr) {
      throw new Error("Senha atual incorreta.");
    }

    // 4. Update to new password via Supabase Auth Admin API
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      password: data.new_password,
      user_metadata: {
        ...(userRecord.user.user_metadata || {}),
        must_change_password: false,
      },
    });
    if (updateErr) {
      throw new Error(updateErr.message);
    }

    return { ok: true };
  });

export const changeSelfPassword = createServerFn({ method: "POST" })
  .middleware([requireUserAuth])
  .validator((input: unknown) =>
    z.object({
      current_password: z.string().min(1).max(128),
      new_password: z.string().min(8).max(128),
      sign_out_others: z.boolean().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    const adminLevel = await getAdminLevel(actorId);

    // REGRA OBRIGATÓRIA:
    // Administradores dos níveis ADM Geral e ADM Comum NÃO podem alterar a própria senha em hipótese alguma.
    if (adminLevel === "geral" || adminLevel === "comum") {
      throw new Error(
        "Acesso negado: Administradores dos níveis ADM Geral e ADM Comum não têm permissão para alterar a própria senha. Entre em contato com o Administrador Master."
      );
    }

    // Apenas ADM Master (adminLevel === 'master') ou clientes comuns (adminLevel === null) podem alterar a própria senha
    const supabaseAdmin = await getAdmin();
    const { data: userRecord, error: userFetchErr } = await supabaseAdmin.auth.admin.getUserById(actorId);
    if (userFetchErr || !userRecord?.user?.email) {
      throw new Error("Usuário não encontrado.");
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://rbhczirsgprmynpiudmi.supabase.co";
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_lasza5Kvnwb_BwH-09DqIQ_pt1Authi";
    const authClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: signInErr } = await authClient.auth.signInWithPassword({
      email: userRecord.user.email,
      password: data.current_password,
    });
    if (signInErr) {
      throw new Error("Senha atual incorreta.");
    }

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(actorId, {
      password: data.new_password,
      user_metadata: {
        ...(userRecord.user.user_metadata || {}),
        must_change_password: false,
      },
    });
    if (updateErr) {
      throw new Error(updateErr.message);
    }

    return { ok: true };
  });



export type AdminLevel = "master" | "geral" | "comum";

export type TagColor = "none" | "green" | "red" | "yellow" | "purple";

export type KycSubmissionInfo = {
  status: string;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  rejection_reason: string | null;
  rejected_parts: string[];
};

export type AdminUserDetail = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  document_type: string | null;
  document_number: string | null;
  country: string | null;
  created_at: string;
  balance: number;
  currency: string;
  holder_name: string | null;
  iban: string | null;
  swift: string | null;
  account_number: string | null;
  role: string;
  referred_by: string | null;
  referred_by_name: string | null;
  referred_by_level: AdminLevel | null;
  account_blocked: boolean;
  account_blocked_at: string | null;
  tag_color: TagColor;
  transfer_locked: boolean;
  kyc_status: string;
  kyc_submission: KycSubmissionInfo | null;
};

export async function isPlanExpired(userId: string): Promise<boolean> {
  const supabaseAdmin = await getAdmin();
  const { data } = await supabaseAdmin
    .from("admin_plans")
    .select("expires_at")
    .eq("admin_user_id", userId)
    .maybeSingle();
  if (!data || !data.expires_at) return true;
  return new Date(data.expires_at).getTime() <= Date.now();
}

export async function isAccountBlocked(userId: string): Promise<boolean> {
  const supabaseAdmin = await getAdmin();
  const [{ data: prof }, { data: acc }] = await Promise.all([
    supabaseAdmin.from("profiles").select("account_blocked").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("accounts").select("is_blocked, status").eq("user_id", userId).maybeSingle(),
  ]);
  return (
    prof?.account_blocked === true ||
    (acc as any)?.is_blocked === true ||
    (acc as any)?.status === "bloqueado"
  );
}

export async function assertAccountNotBlocked(userId: string): Promise<void> {
  const blocked = await isAccountBlocked(userId);
  if (blocked) {
    throw new Error("Account is blocked");
  }
}

export async function getAdminLevel(userId: string): Promise<AdminLevel | null> {
  const supabaseAdmin = await getAdmin();
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (!data || data.length === 0) return null;
  const roles = data.map((r: any) => r.role as string);
  if (roles.includes("admin")) return "master";
  if (roles.includes("adm_geral")) return "geral";
  if (roles.includes("adm_comum")) return "comum";
  return null;
}

export async function getEffectiveViewLevel(userId: string): Promise<AdminLevel | null> {
  return getAdminLevel(userId);
}

export async function assertAdmin(userId: string): Promise<AdminLevel> {
  const lvl = await getAdminLevel(userId);
  if (!lvl) throw new Error("Not authorized");
  if (lvl !== "master") {
    const expired = await isPlanExpired(userId);
    if (expired) {
      throw new Error("Plano administrativo expirado. Entre em contato com o suporte master para renovar o acesso.");
    }
  }
  return lvl;
}

export async function isReadOnlyAdmin(_userId: string): Promise<boolean> {
  return false;
}

// Cliente pertence à carteira do próprio admin?
export async function isOwnClient(adminId: string, targetUserId: string): Promise<boolean> {
  const supabaseAdmin = await getAdmin();
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("referred_by")
    .eq("user_id", targetUserId)
    .maybeSingle();
  return (data as any)?.referred_by === adminId;
}

export async function assertNotReadOnlyAdmin(userId: string, targetUserId?: string) {
  if (!(await isReadOnlyAdmin(userId))) return;
  if (targetUserId && (await isOwnClient(userId, targetUserId))) return;
  throw new Error("Este perfil é somente leitura: só pode transferir clientes para outro ADM");
}

export async function assertMaster(userId: string) {
  const lvl = await getAdminLevel(userId);
  if (lvl !== "master") throw new Error("Apenas Master pode executar esta ação");
}

export async function assertCanEditAdmin(actorId: string, targetId: string) {
  const actor = await assertAdmin(actorId);
  const target = await getAdminLevel(targetId);
  if (!target) throw new Error("Alvo não é um administrador");
  if (actor === "master") return;
  if (actor === "geral" && target === "comum") return;
  throw new Error("Você não tem permissão para editar este admin");
}

function canSee(
  adminLevel: AdminLevel,
  adminId: string,
  refId: string | null,
  refLevel: AdminLevel | null,
): boolean {
  if (adminLevel === "master") return true;
  if (!refId) return false;
  if (adminLevel === "comum") return refId === adminId;
  // geral: vê clientes de adm_comum e os próprios,
  // nunca clientes do MASTER ou de outros adm_geral sem atribuição
  return refLevel === "comum" || refId === adminId;
}

export async function assertCanSee(adminId: string, targetUserId: string) {
  const supabaseAdmin = await getAdmin();
  const lvl = await assertAdmin(adminId);
  if (lvl === "master") return;
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("referred_by")
    .eq("user_id", targetUserId)
    .maybeSingle();
  const refId = (prof as any)?.referred_by ?? null;
  if (lvl === "comum") {
    if (refId && refId === adminId) return;
    throw new Error("Cliente fora do seu escopo");
  }
  if (!refId) throw new Error("Cliente fora do seu escopo");
  if (refId === adminId) return;
  const refLvl = await getAdminLevel(refId);
  if (!canSee(lvl, adminId, refId, refLvl)) throw new Error("Cliente fora do seu escopo");
}

export const getMyAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireUserAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; level: AdminLevel | null; isExpired: boolean; referralCode: string | null }> => {
    const lvl = await getAdminLevel(context.userId);
    if (!lvl) return { isAdmin: false, level: null, isExpired: false, referralCode: null };
    const supabaseAdmin = await getAdmin();
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("user_id", context.userId)
      .maybeSingle();
    const referralCode = prof?.referral_code ?? null;
    if (lvl === "master") return { isAdmin: true, level: "master", isExpired: false, referralCode };
    const expired = await isPlanExpired(context.userId);
    return { isAdmin: true, level: lvl, isExpired: expired, referralCode };
  });

export const getMyReferralCode = createServerFn({ method: "GET" })
  .middleware([requireUserAuth])
  .handler(async ({ context }): Promise<{ referralCode: string | null }> => {
    const supabaseAdmin = await getAdmin();
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("referral_code")
      .eq("user_id", context.userId)
      .maybeSingle();
    return { referralCode: prof?.referral_code ?? null };
  });


export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const adminLevel = (await getEffectiveViewLevel(context.userId))!;

    const [{ data: profiles }, { data: accounts }, { data: roles }, authList] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("user_id, full_name, phone, birth_date, document_type, document_number, country, created_at, referred_by, account_blocked, account_blocked_at, tag_color, transfer_locked, kyc_status")
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("accounts").select("user_id, balance, currency, holder_name, iban, swift, account_number"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

    const emailMap = new Map<string, string | null>(
      (authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );
    const accMap = new Map(
      (accounts ?? []).map((a: any) => [a.user_id, a]),
    );
    const rank = (x: string) => x === "admin" ? 4 : x === "adm_geral" ? 3 : x === "adm_comum" ? 2 : 1;
    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) {
      const cur = roleMap.get(r.user_id);
      if (!cur || rank(r.role) > rank(cur)) roleMap.set(r.user_id, r.role);
    }
    const profileNameMap = new Map<string, string | null>(
      (profiles ?? []).map((p: any) => [p.user_id, p.full_name]),
    );
    const levelOf = (uid: string | null): AdminLevel | null => {
      if (!uid) return null;
      const r = roleMap.get(uid);
      if (r === "admin") return "master";
      if (r === "adm_geral") return "geral";
      if (r === "adm_comum") return "comum";
      return null;
    };

    const all: AdminUserDetail[] = (profiles ?? []).map((p: any) => ({
      user_id: p.user_id,
      email: emailMap.get(p.user_id) ?? null,
      full_name: p.full_name,
      phone: p.phone,
      birth_date: p.birth_date ?? null,
      document_type: p.document_type ?? null,
      document_number: p.document_number ?? null,
      country: p.country ?? null,
      created_at: p.created_at,
      balance: Number(accMap.get(p.user_id)?.balance ?? 0),
      currency: accMap.get(p.user_id)?.currency ?? "GBP",
      holder_name: accMap.get(p.user_id)?.holder_name ?? null,
      iban: accMap.get(p.user_id)?.iban ?? null,
      swift: accMap.get(p.user_id)?.swift ?? null,
      account_number: accMap.get(p.user_id)?.account_number ?? null,
      role: roleMap.get(p.user_id) ?? "user",
      referred_by: p.referred_by ?? null,
      referred_by_name: p.referred_by ? (profileNameMap.get(p.referred_by) ?? null) : null,
      referred_by_level: levelOf(p.referred_by ?? null),
      account_blocked: !!p.account_blocked,
      account_blocked_at: p.account_blocked_at ?? null,
      tag_color: (p.tag_color ?? "none") as TagColor,
      transfer_locked: p.transfer_locked === true,
      kyc_status: p.kyc_status ?? "not_started",
      kyc_submission: null,
    }));

    const users = all.filter((u) => {
      if (u.role === "admin" || u.role === "adm_geral" || u.role === "adm_comum") return false;
      return canSee(adminLevel, context.userId, u.referred_by, u.referred_by_level);
    });
    const viewerReadOnly = await isReadOnlyAdmin(context.userId);
    return { users, viewerLevel: adminLevel, viewerReadOnly };
  });

// Devolve o conjunto de user_ids que o admin atual pode ver.
// Para master retorna null (= sem filtro).
export async function allowedUserIds(adminId: string, adminLevel: AdminLevel): Promise<Set<string> | null> {
  const supabaseAdmin = await getAdmin();
  if (adminLevel === "master") return null;
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("user_id, referred_by"),
    supabaseAdmin.from("user_roles").select("user_id, role"),
  ]);
  const roleMap = new Map<string, string>();
  for (const r of roles ?? []) {
    const cur = roleMap.get(r.user_id);
    const rk = (x: string) => x === "admin" ? 4 : x === "adm_geral" ? 3 : x === "adm_comum" ? 2 : 1;
    if (!cur || rk(r.role) > rk(cur)) roleMap.set(r.user_id, r.role);
  }
  const allowed = new Set<string>();
  for (const p of profiles ?? []) {
    const refId = (p as any).referred_by as string | null;
    if (!refId) continue;
    if (adminLevel === "comum") {
      if (refId === adminId) allowed.add(p.user_id);
    } else {
      // geral: apenas clientes de adm_comum + os próprios.
      // Clientes do ADM MASTER nunca aparecem para geral/comum.
      const refRole = roleMap.get(refId);
      if (refRole === "adm_comum" || refId === adminId) allowed.add(p.user_id);
    }
  }
  return allowed;
}

export type AdminNote = {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author_name: string | null;
};


export const getAdminUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminUserDetail> => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertCanSee(context.userId, data.user_id);
    const [
      { data: profile },
      { data: account },
      { data: role },
      userRes,
      { data: latestKyc },
    ] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("user_id, full_name, phone, birth_date, document_type, document_number, country, created_at, referred_by, account_blocked, account_blocked_at, tag_color, transfer_locked, kyc_status, kyc_reviewed_at, kyc_reviewed_by")
        .eq("user_id", data.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("accounts")
        .select("balance, currency, holder_name, iban, swift, account_number")
        .eq("user_id", data.user_id)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user_id)
        .maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(data.user_id),
      supabaseAdmin
        .from("kyc_submissions")
        .select("id, status, created_at, reviewed_at, reviewed_by, rejection_reason, rejected_parts")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (!profile) throw new Error("User not found");
    const refId = (profile as any).referred_by ?? null;
    let refName: string | null = null;
    let refLevel: AdminLevel | null = null;
    if (refId) {
      const { data: refProf } = await supabaseAdmin
        .from("profiles").select("full_name").eq("user_id", refId).maybeSingle();
      refName = (refProf as any)?.full_name ?? null;
      refLevel = await getAdminLevel(refId);
    }

    const reviewerId = (latestKyc as any)?.reviewed_by ?? (profile as any)?.kyc_reviewed_by ?? null;
    let reviewerName: string | null = null;
    if (reviewerId) {
      const { data: revProf } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("user_id", reviewerId)
        .maybeSingle();
      reviewerName = (revProf as any)?.full_name ?? null;
      if (!reviewerName) {
        try {
          const { data: revAuth } = await supabaseAdmin.auth.admin.getUserById(reviewerId);
          reviewerName = revAuth?.user?.email ?? null;
        } catch {
          // ignore
        }
      }
    }

    const kycSubmission: KycSubmissionInfo | null = latestKyc
      ? {
          status: (latestKyc as any).status ?? (profile as any).kyc_status ?? "not_started",
          submitted_at: (latestKyc as any).created_at ?? null,
          reviewed_at: (latestKyc as any).reviewed_at ?? (profile as any).kyc_reviewed_at ?? null,
          reviewed_by: reviewerId,
          reviewed_by_name: reviewerName,
          rejection_reason: (latestKyc as any).rejection_reason ?? null,
          rejected_parts: Array.isArray((latestKyc as any).rejected_parts)
            ? ((latestKyc as any).rejected_parts as string[])
            : [],
        }
      : (profile as any).kyc_status && (profile as any).kyc_status !== "not_started"
      ? {
          status: (profile as any).kyc_status,
          submitted_at: null,
          reviewed_at: (profile as any).kyc_reviewed_at ?? null,
          reviewed_by: reviewerId,
          reviewed_by_name: reviewerName,
          rejection_reason: null,
          rejected_parts: [],
        }
      : null;

    return {
      user_id: profile.user_id,
      email: userRes.data?.user?.email ?? null,
      full_name: profile.full_name,
      phone: profile.phone,
      birth_date: (profile as any).birth_date ?? null,
      document_type: (profile as any).document_type ?? null,
      document_number: (profile as any).document_number ?? null,
      country: (profile as any).country ?? null,
      created_at: profile.created_at || (userRes.data?.user?.created_at ?? ""),
      balance: Number(account?.balance ?? 0),
      currency: account?.currency ?? "GBP",
      holder_name: (account as any)?.holder_name ?? null,
      iban: (account as any)?.iban ?? null,
      swift: (account as any)?.swift ?? null,
      account_number: (account as any)?.account_number ?? null,
      role: role?.role ?? "user",
      referred_by: refId,
      referred_by_name: refName,
      referred_by_level: refLevel,
      account_blocked: !!(profile as any).account_blocked,
      account_blocked_at: (profile as any).account_blocked_at ?? null,
      tag_color: ((profile as any).tag_color ?? "none") as TagColor,
      transfer_locked: (profile as any).transfer_locked === true,
      kyc_status: (profile as any).kyc_status ?? "not_started",
      kyc_submission: kycSubmission,
    };
  });

export const listAdminUserNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ notes: AdminNote[] }> => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertCanSee(context.userId, data.user_id);
    const { data: notes, error } = await supabaseAdmin
      .from("admin_user_notes")
      .select("id, content, created_at, author_id")
      .eq("user_id", data.user_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const authorIds = Array.from(new Set((notes ?? []).map((n) => n.author_id)));
    const nameMap = new Map<string, string | null>();
    if (authorIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", authorIds);
      for (const p of profs ?? []) nameMap.set(p.user_id, p.full_name);
    }
    return {
      notes: (notes ?? []).map((n) => ({
        id: n.id,
        content: n.content,
        created_at: n.created_at,
        author_id: n.author_id,
        author_name: nameMap.get(n.author_id) ?? null,
      })),
    };
  });

export const addAdminUserNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      content: z.string().min(1).max(5000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertNotReadOnlyAdmin(context.userId, data.user_id);
    await assertCanSee(context.userId, data.user_id);
    const { error } = await supabaseAdmin.from("admin_user_notes").insert({
      user_id: data.user_id,
      author_id: context.userId,
      content: data.content.trim(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      balance: z.number().min(0).max(999999999),
      expected_current_balance: z.number().min(0).max(999999999).optional(),
      reason: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const adminId = context.userId;
    await assertAdmin(adminId);
    await assertNotReadOnlyAdmin(adminId, data.user_id);
    await assertCanSee(adminId, data.user_id);

    let expected = data.expected_current_balance;
    if (expected === undefined) {
      const { data: acc, error: accErr } = await supabaseAdmin
        .from("accounts")
        .select("balance")
        .eq("user_id", data.user_id)
        .maybeSingle();
      if (accErr || !acc) throw new Error("Account not found for user.");
      expected = Number(acc.balance);
    }

    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
      "admin_update_balance_atomic",
      {
        _admin_id: adminId,
        _user_id: data.user_id,
        _new_balance: data.balance,
        _expected_current_balance: expected,
        _reason: data.reason ?? null,
      },
    );

    if (rpcErr) {
      const errMsg = rpcErr.message || "";
      if (/changed while you were editing/i.test(errMsg)) {
        throw new Error("The account balance changed while you were editing. Refresh and try again.");
      }
      if (/account not found/i.test(errMsg)) {
        throw new Error("Account not found for user.");
      }
      console.error("[updateUserBalance] atomic update failed:", rpcErr);
      throw new Error("Failed to update user balance.");
    }

    return {
      ok: true,
      previous_balance: rpcRes?.previous_balance ?? expected,
      new_balance: rpcRes?.new_balance ?? data.balance,
      delta: rpcRes?.delta ?? (data.balance - expected),
    };
  });

export type WithdrawalRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  amount: number;
  method: string;
  pix_key: string | null;
  notes: string | null;
  status: "solicitado" | "aprovado" | "recusado";
  created_at: string;
  kind: "withdrawal" | "transfer";
};

export const listWithdrawalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    const lvl = (await getEffectiveViewLevel(context.userId))!;
    const allowed = await allowedUserIds(context.userId, lvl);

    const [{ data: withdrawals, error }, { data: transfers, error: trErr }, { data: profiles }, authList] =
      await Promise.all([
        supabaseAdmin
          .from("withdrawal_requests")
          .select("id, user_id, amount, method, pix_key, notes, status, created_at")
          .order("created_at", { ascending: false }),
        supabaseAdmin
          .from("transfer_requests")
          .select("id, user_id, amount, beneficiary_name, bank_name, account_number, currency_to, status, created_at")
          .in("status", ["solicitado", "aprovado", "recusado"])
          .order("created_at", { ascending: false }),
        supabaseAdmin.from("profiles").select("user_id, full_name"),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);
    if (error) throw new Error(error.message);
    if (trErr) throw new Error(trErr.message);

    const nameMap = new Map<string, string | null>(
      (profiles ?? []).map((p: any) => [p.user_id, p.full_name]),
    );
    const emailMap = new Map<string, string | null>(
      (authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]),
    );

    const withdrawalRows: WithdrawalRow[] = (withdrawals ?? [])
      .filter((w: any) => allowed === null || allowed.has(w.user_id))
      .map((w: any) => ({
        id: w.id,
        user_id: w.user_id,
        full_name: nameMap.get(w.user_id) ?? null,
        email: emailMap.get(w.user_id) ?? null,
        amount: Number(w.amount),
        method: w.method,
        pix_key: w.pix_key,
        notes: w.notes,
        status: w.status,
        created_at: w.created_at,
        kind: "withdrawal" as const,
      }));

    const transferRows: WithdrawalRow[] = (transfers ?? [])
      .filter((t: any) => allowed === null || allowed.has(t.user_id))
      .map((t: any) => ({
        id: t.id,
        user_id: t.user_id,
        full_name: nameMap.get(t.user_id) ?? null,
        email: emailMap.get(t.user_id) ?? null,
        amount: Number(t.amount),
        method: `Transferência internacional · ${t.currency_to ?? ""}`.trim(),
        pix_key: `${t.beneficiary_name} · ${t.bank_name} · ${t.account_number}`,
        notes: null,
        status: t.status,
        created_at: t.created_at,
        kind: "transfer" as const,
      }));

    const rows = [...withdrawalRows, ...transferRows].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
    return { rows };
  });

export async function reviewTransferAsAdmin(params: {
  adminId: string;
  transferId: string;
  status: "aprovado" | "recusado" | "bloqueado";
  reason?: string | null;
}): Promise<{ ok: boolean; id?: string; status?: string }> {
  const supabaseAdmin = await getAdmin();
  const lvl = await assertAdmin(params.adminId);
  if (!lvl) throw new Error("Not authorized");

  // Fetch transfer user_id to verify scope/hierarchy before invoking the RPC
  const { data: tr, error: trErr } = await supabaseAdmin
    .from("transfer_requests")
    .select("user_id, status")
    .eq("id", params.transferId)
    .maybeSingle();

  if (trErr || !tr) throw new Error("Transfer not found");
  const t = tr as any;

  await assertCanSee(params.adminId, t.user_id);
  await assertNotReadOnlyAdmin(params.adminId, t.user_id);

  if (t.status !== "solicitado") throw new Error("Transfer already reviewed");

  if (params.status === "recusado" && (!params.reason || params.reason.trim().length === 0)) {
    throw new Error("Informe o motivo do cancelamento.");
  }

  const cleanReason = params.reason && params.reason.trim().length > 0 ? params.reason.trim() : null;

  // Call atomic PostgreSQL RPC function (all-or-nothing transaction with row locks)
  const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
    "review_transfer_atomic",
    {
      _transfer_id: params.transferId,
      _reviewer_id: params.adminId,
      _target_status: params.status,
      _rejection_reason: cleanReason,
    },
  );

  if (rpcErr) {
    const errMsg = rpcErr.message || "";
    if (/already been reviewed/i.test(errMsg)) {
      throw new Error("Transfer already reviewed");
    }
    if (/not found/i.test(errMsg)) {
      throw new Error("Transfer not found");
    }
    if (/rejection reason/i.test(errMsg)) {
      throw new Error("Informe o motivo do cancelamento.");
    }
    if (/invalid target status/i.test(errMsg)) {
      throw new Error("Invalid transfer status transition");
    }
    console.error("[reviewTransferAsAdmin] atomic review transaction failed:", rpcErr);
    throw new Error("Transfer review could not be completed.");
  }

  return {
    ok: true,
    id: rpcRes?.id ?? params.transferId,
    status: rpcRes?.status ?? params.status,
  };
}

export const updateWithdrawalStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["solicitado", "aprovado", "recusado"]),
      kind: z.enum(["withdrawal", "transfer"]).optional(),
      reason: z.string().trim().min(1).max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    const adminId = context.userId;
    await assertAdmin(adminId);

    if (data.status === "recusado" && (!data.reason || data.reason.trim().length === 0)) {
      throw new Error("Informe o motivo do cancelamento.");
    }

    // Determine reliably whether id belongs to transfer_requests or withdrawal_requests
    const tryTransferFirst = data.kind === "transfer";

    let isTransfer = false;
    let isWithdrawal = false;
    let withdrawalRow: any = null;

    if (tryTransferFirst) {
      const { data: tr } = await supabaseAdmin
        .from("transfer_requests")
        .select("id, user_id, status")
        .eq("id", data.id)
        .maybeSingle();
      if (tr) {
        isTransfer = true;
      } else {
        const { data: wr } = await supabaseAdmin
          .from("withdrawal_requests")
          .select("id, user_id, status, amount, method")
          .eq("id", data.id)
          .maybeSingle();
        if (wr) {
          isWithdrawal = true;
          withdrawalRow = wr;
        }
      }
    } else {
      const { data: wr } = await supabaseAdmin
        .from("withdrawal_requests")
        .select("id, user_id, status, amount, method")
        .eq("id", data.id)
        .maybeSingle();
      if (wr) {
        isWithdrawal = true;
        withdrawalRow = wr;
      } else {
        const { data: tr } = await supabaseAdmin
          .from("transfer_requests")
          .select("id, user_id, status")
          .eq("id", data.id)
          .maybeSingle();
        if (tr) {
          isTransfer = true;
        }
      }
    }

    if (!isTransfer && !isWithdrawal) {
      throw new Error("Solicitação não encontrada");
    }

    // PATH 1: TRANSFER REQUESTS -> Route strictly through the atomic review function
    if (isTransfer) {
      if (data.status === "solicitado") {
        throw new Error("Invalid transfer status transition");
      }
      return reviewTransferAsAdmin({
        adminId,
        transferId: data.id,
        status: data.status,
        reason: data.reason,
      });
    }

    // PATH 2: WITHDRAWAL REQUESTS -> Preserve existing withdrawal handling without mixing tables
    await assertNotReadOnlyAdmin(adminId, withdrawalRow.user_id);
    await assertCanSee(adminId, withdrawalRow.user_id);

    if (withdrawalRow.status !== "solicitado") {
      throw new Error("Solicitação já revisada");
    }

    const { data: acc } = await supabaseAdmin
      .from("accounts")
      .select("id, balance")
      .eq("user_id", withdrawalRow.user_id)
      .maybeSingle();
    if (!acc) throw new Error("Conta do usuário não encontrada");

    // Atomic update restricted to records currently in 'solicitado' to prevent double review / race conditions
    const patch: any = { status: data.status, notes: data.reason ?? null };
    const { data: updatedRows, error: updErr } = await supabaseAdmin
      .from("withdrawal_requests")
      .update(patch)
      .eq("id", data.id)
      .eq("status", "solicitado")
      .select("id");

    if (updErr) throw new Error(updErr.message);
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error("Solicitação já revisada");
    }
    return { ok: true };
  });

export type AuthActivityEntry = {
  created_at: string;
  ip_address: string | null;
  action: string | null;
};

export type UserAuthActivity = {
  signup_ip: string | null;
  signup_at: string | null;
  last_sign_in_at: string | null;
  last_sign_in_ip: string | null;
  email_confirmed_at: string | null;
  provider: string | null;
  entries: AuthActivityEntry[];
};

export const getUserAuthActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<UserAuthActivity> => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertCanSee(context.userId, data.user_id);

    const [{ data: events, error }, userRes] = await Promise.all([
      supabaseAdmin
        .from("user_login_events")
        .select("created_at, event_type, ip_address")
        .eq("user_id", data.user_id)
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.auth.admin.getUserById(data.user_id),
    ]);
    if (error) throw new Error(error.message);

    const entries: AuthActivityEntry[] = (events ?? []).map((r: any) => ({
      created_at: r.created_at,
      ip_address: r.ip_address || null,
      action: r.event_type,
    }));

    const signup = [...entries].reverse().find((e) => e.action === "signup");
    const lastLogin = entries.find((e) => e.action === "login");

    const u = userRes.data?.user;
    return {
      signup_ip: signup?.ip_address ?? null,
      signup_at: signup?.created_at ?? u?.created_at ?? null,
      last_sign_in_at: lastLogin?.created_at ?? u?.last_sign_in_at ?? null,
      last_sign_in_ip: lastLogin?.ip_address ?? null,
      email_confirmed_at: u?.email_confirmed_at ?? null,
      provider: (u?.app_metadata as any)?.provider ?? null,
      entries,
    };
  });

// =============================================================================
// Discontinued Features: Cards and Credit Facilities
// All card issuance, management, credit requests and approvals have been deactivated.
// =============================================================================

export type CardRequestRow = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  status: "solicitado" | "aprovado" | "recusado";
  holder_name: string | null;
  last4: string | null;
  expiry: string | null;
  credit_limit: number;
  created_at: string;
};

export const requestCard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d?: any) => d)
  .handler(async () => {
    throw new Error("Feature discontinued: Card issuance and credit applications are no longer supported.");
  });

export const getMyCardRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { request: null };
  });

export type MyCard = { id: string; holder_name: string; last4: string | null; expiry: string | null; credit_limit: number };

export const getMyApprovedCards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ cards: MyCard[] }> => {
    return { cards: [] };
  });

export const listCardRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ rows: CardRequestRow[] }> => {
    return { rows: [] };
  });

export const updateCardRequestStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: any) => input)
  .handler(async () => {
    throw new Error("Feature discontinued: Card management and credit underwriting are no longer supported.");
  });

export const unblockAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertNotReadOnlyAdmin(context.userId, data.user_id);
    await assertCanSee(context.userId, data.user_id);
    const [pRes, aRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({ account_blocked: false, account_blocked_at: null })
        .eq("user_id", data.user_id),
      supabaseAdmin
        .from("accounts")
        .update({ is_blocked: false, status: "ativo" } as any)
        .eq("user_id", data.user_id),
    ]);
    if (pRes.error) throw new Error(pRes.error.message);
    if (aRes.error) throw new Error(aRes.error.message);
    return { ok: true };
  });

export const blockAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertNotReadOnlyAdmin(context.userId, data.user_id);
    await assertCanSee(context.userId, data.user_id);
    const now = new Date().toISOString();
    const [pRes, aRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({ account_blocked: true, account_blocked_at: now })
        .eq("user_id", data.user_id),
      supabaseAdmin
        .from("accounts")
        .update({ is_blocked: true, status: "bloqueado" } as any)
        .eq("user_id", data.user_id),
    ]);
    if (pRes.error) throw new Error(pRes.error.message);
    if (aRes.error) throw new Error(aRes.error.message);
    return { ok: true };
  });


export const setUserTagColor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      tag_color: z.enum(["none", "green", "red", "yellow", "purple"]),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertAdmin(context.userId);
    await assertNotReadOnlyAdmin(context.userId, data.user_id);
    await assertCanSee(context.userId, data.user_id);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ tag_color: data.tag_color })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Master-only: toggle the per-user "transfer lock". When locked, the user
// is shown a deposit warning (2.5% of balance) before submitting a transfer.
export const setUserTransferLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      locked: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await getAdmin();
    await assertMaster(context.userId);
    const [pRes, aRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .update({ transfer_locked: data.locked })
        .eq("user_id", data.user_id),
      supabaseAdmin
        .from("accounts")
        .update({ transfer_locked: data.locked } as any)
        .eq("user_id", data.user_id),
    ]);
    if (pRes.error) throw new Error(pRes.error.message);
    if (aRes.error) throw new Error(aRes.error.message);
    return { ok: true };
  });


// ===== Transferência de cliente entre admins =====
// Podem transferir: master e adm_geral (controle exclusivamente por nível/role).
async function assertCanReassign(actorId: string): Promise<AdminLevel> {
  const lvl = await assertAdmin(actorId);
  if (lvl === "master" || lvl === "geral") return lvl;
  throw new Error("Você não tem permissão para transferir clientes");
}

export type AssignableAdmin = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  referral_code: string | null;
  level: "master" | "geral" | "comum";
};

export const canReassignClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ user_id: z.string().uuid().optional() }).optional().parse(input))
  .handler(async ({ data, context }): Promise<{ allowed: boolean; readOnly: boolean }> => {
    let readOnly = await isReadOnlyAdmin(context.userId).catch(() => false);
    // Somente-leitura não se aplica aos clientes da própria carteira.
    if (readOnly && data?.user_id) {
      readOnly = !(await isOwnClient(context.userId, data.user_id).catch(() => false));
    }
    try {
      await assertCanReassign(context.userId);
      return { allowed: true, readOnly };
    } catch {
      return { allowed: false, readOnly };
    }
  });

export const listAssignableAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AssignableAdmin[]> => {
    await assertCanReassign(context.userId);
    const supabaseAdmin = await getAdmin();
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "adm_geral", "adm_comum"] as any);
    const levelMap = new Map<string, "master" | "geral" | "comum">();
    for (const r of (roles ?? []) as any[]) {
      const lvl = r.role === "admin" ? "master" : r.role === "adm_geral" ? "geral" : "comum";
      const cur = levelMap.get(r.user_id);
      const rk = (x: string) => (x === "master" ? 3 : x === "geral" ? 2 : 1);
      if (!cur || rk(lvl) > rk(cur)) levelMap.set(r.user_id, lvl as any);
    }
    const ids = [...levelMap.keys()];
    if (ids.length === 0) return [];
    const [{ data: profiles }, authList] = await Promise.all([
      supabaseAdmin.from("profiles").select("user_id, full_name, referral_code").in("user_id", ids),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const emailMap = new Map((authList.data?.users ?? []).map((u) => [u.id, u.email ?? null]));
    const profMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
    return ids
      .map((id) => ({
        user_id: id,
        full_name: (profMap.get(id) as any)?.full_name ?? null,
        email: emailMap.get(id) ?? null,
        referral_code: (profMap.get(id) as any)?.referral_code ?? null,
        level: levelMap.get(id) ?? "comum",
      }))
      .sort((a, b) => {
        const rk = (x: string) => (x === "master" ? 0 : x === "geral" ? 1 : 2);
        if (rk(a.level) !== rk(b.level)) return rk(a.level) - rk(b.level);
        return (a.full_name ?? "").localeCompare(b.full_name ?? "");
      });
  });

// Move o cliente (com notas, KYC e histórico, que seguem o user_id) para outro adm_comum.
export const reassignClientToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      admin_id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanReassign(context.userId);
    await assertCanSee(context.userId, data.user_id);
    const targetIsAdmin = await getAdminLevel(data.user_id);
    if (targetIsAdmin) throw new Error("Não é possível transferir um administrador");
    const destLevel = await getAdminLevel(data.admin_id);
    if (!destLevel) throw new Error("Destino inválido: selecione um administrador");
    const supabaseAdmin = await getAdmin();

    const { data: current } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("user_id", data.user_id)
      .maybeSingle();
    const fromAdminId: string | null = (current as any)?.referred_by ?? null;

    const involvedIds = [...new Set([fromAdminId, data.admin_id, context.userId].filter(Boolean))] as string[];
    const { data: involvedProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", involvedIds);
    const nameMap = new Map((involvedProfiles ?? []).map((p: any) => [p.user_id, p.full_name as string | null]));
    const nameOf = (id: string | null) => (id ? (nameMap.get(id) || "Administrador") : null);

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ referred_by: data.admin_id })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    const toName = nameOf(data.admin_id);
    const fromName = nameOf(fromAdminId);
    const actorName = nameOf(context.userId);
    const content = fromAdminId
      ? `Cliente transferido de ${fromName} para ${toName}. Realizado por ${actorName}.`
      : `Cliente atribuído a ${toName}. Realizado por ${actorName}.`;

    await supabaseAdmin.from("admin_user_notes").insert({
      user_id: data.user_id,
      author_id: context.userId,
      content,
      from_admin_id: fromAdminId,
      to_admin_id: data.admin_id,
      actor_admin_id: context.userId,
    } as any);
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      full_name: z.string().trim().min(2).max(160).optional(),
      phone: z.string().trim().max(40).optional().nullable(),
      country: z.string().trim().min(2).max(60).optional().nullable(),
      birth_date: z.string().trim().max(10).optional().nullable(),
      document_type: z.string().trim().max(30).optional().nullable(),
      document_number: z.string().trim().max(40).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertAdmin(actorId);
    await assertCanSee(actorId, data.user_id);
    await assertNotReadOnlyAdmin(actorId, data.user_id);
    const supabaseAdmin = await getAdmin();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.full_name !== undefined) updatePayload.full_name = data.full_name;
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.country !== undefined) updatePayload.country = data.country?.trim() || "GB";
    if (data.birth_date !== undefined) updatePayload.birth_date = data.birth_date?.trim() || null;
    if (data.document_type !== undefined) updatePayload.document_type = data.document_type?.trim() || null;
    if (data.document_number !== undefined) updatePayload.document_number = data.document_number?.trim() || null;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(updatePayload as any)
      .eq("user_id", data.user_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateUserBankingDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      user_id: z.string().uuid(),
      holder_name: z.string().trim().max(160).optional().nullable(),
      sort_code: z.string().trim().max(12).optional().nullable(),
      account_number: z.string().trim().max(40).optional().nullable(),
      iban: z.string().trim().max(42).optional().nullable(),
      swift: z.string().trim().max(15).optional().nullable(),
      currency: z.string().trim().max(10).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const actorId = context.userId;
    await assertAdmin(actorId);
    await assertCanSee(actorId, data.user_id);
    await assertNotReadOnlyAdmin(actorId, data.user_id);
    const supabaseAdmin = await getAdmin();

    const cleanIban = (data.iban ?? "").replace(/\s+/g, "").toUpperCase();
    const cleanSwift = (data.swift ?? "").replace(/\s+/g, "").toUpperCase();
    const cleanHolder = data.holder_name?.trim() || null;

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (data.holder_name !== undefined) updatePayload.holder_name = cleanHolder;
    if (data.iban !== undefined) updatePayload.iban = cleanIban;
    if (data.swift !== undefined) updatePayload.swift = cleanSwift;

    // Backend currency validation: B Bank accounts must operate exclusively in GBP (£)
    if (data.currency !== undefined && data.currency !== null) {
      const cleanCurrency = data.currency.trim().toUpperCase();
      if (cleanCurrency !== "GBP") {
        // If a legacy account was already BRL/EUR/USD, permit keeping it without silent change, but reject changing TO another non-GBP
        const { data: existingAcc } = await supabaseAdmin
          .from("accounts")
          .select("currency")
          .eq("user_id", data.user_id)
          .maybeSingle();
        if (existingAcc?.currency !== cleanCurrency) {
          throw new Error("B Bank accounts must operate exclusively in GBP (£).");
        }
      } else {
        updatePayload.currency = "GBP";
      }
    }

    if (data.account_number !== undefined && data.account_number !== null) {
      const trimmedAcc = data.account_number.trim();
      const cleanAccDigits = trimmedAcc.replace(/\D/g, "");
      if (data.sort_code) {
        const cleanSort = data.sort_code.replace(/\D/g, "").padStart(6, "0").slice(0, 6);
        if (cleanAccDigits.length === 8) {
          updatePayload.account_number = `20-${cleanSort.slice(2)}-${cleanAccDigits}`;
        } else {
          updatePayload.account_number = trimmedAcc;
        }
      } else {
        updatePayload.account_number = trimmedAcc;
      }
    }

    const { error } = await supabaseAdmin
      .from("accounts")
      .update(updatePayload as any)
      .eq("user_id", data.user_id);

    if (error) throw new Error(error.message);
    return { ok: true };
  });
