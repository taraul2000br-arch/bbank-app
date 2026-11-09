import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield, Users, ShieldCheck, LayoutDashboard, LogOut, Search, Bell, Eye, EyeOff, X,
  ChevronLeft, DollarSign, Mail, Phone, Calendar, User as UserIcon,
  ArrowUpFromLine, Check, XCircle, Clock, Globe, LogIn,
  UserCog, Plus, Trash2, Pencil, FileText, Unlock, Circle, CalendarClock, Key, Headphones, Copy, MessageSquare,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, useIsAdmin, signOut } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import {
  listAdminUsers, type AdminUserDetail,
  listWithdrawalRequests, updateWithdrawalStatus, type WithdrawalRow,
  getUserAuthActivity, type UserAuthActivity,
  listAdmins, createAdmin, updateAdminCode, updateAdminPassword, deleteAdmin, unblockAccount, setUserTagColor, type AdminRow, type AdminLevel, type TagColor,
} from "@/lib/admin.functions";
import { adminI18n as t } from "@/lib/admin-i18n";
import { callWithRetry } from "@/lib/server-call";

import { useAdminPlan, AdminPlanExpiredScreen, AdminCountdownBadge, AdminCountdownPopup } from "@/components/AdminPlanGate";
import { AdminPlansTab } from "@/components/AdminPlansTab";
import { AdminSupportTab } from "@/components/AdminSupportTab";
import { AdminChatInboxTab } from "@/components/AdminChatInboxTab";
import { AdminTransferDetailModal } from "@/components/AdminTransferDetailModal";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";

export const Route = createFileRoute("/admin/")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "FSociety — Admin" }] }),
});

type Section = "users" | "withdrawals" | "kyc" | "admins" | "plans" | "support" | "inbox";


function AdminPage() {
  const navigate = useNavigate();
  const { lang } = useI18n();
  const isPt = lang === "pt";
  const { user, loading } = useAuth();
  const { isAdmin, loading: roleLoading, level: localAdminLevel, referralCode } = useIsAdmin(user?.id, user?.email);
  const fetchUsers = useServerFn(listAdminUsers);
  const fetchWithdrawals = useServerFn(listWithdrawalRequests);
  const updateWithdrawal = useServerFn(updateWithdrawalStatus);
  const fetchActivity = useServerFn(getUserAuthActivity);
  const fetchAdmins = useServerFn(listAdmins);
  const createAdminFn = useServerFn(createAdmin);
  const updateCodeFn = useServerFn(updateAdminCode);
  const deleteAdminFn = useServerFn(deleteAdmin);
  const updatePasswordFn = useServerFn(updateAdminPassword);

  const [copiedReferral, setCopiedReferral] = useState(false);
  const [customReferralCode, setCustomReferralCode] = useState<string | null>(null);

  const [section, setSection] = useState<Section>("admins");
  const [search, setSearch] = useState("");
  const [withdrawalsSearch, setWithdrawalsSearch] = useState("");
  const [rows, setRows] = useState<AdminUserDetail[]>([]);
  const [viewerLevel, setViewerLevel] = useState<AdminLevel | null>(null);
  const [viewerReadOnly, setViewerReadOnly] = useState(false);
  const [initialSectionReady, setInitialSectionReady] = useState(false);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [selectedWithdrawalsUserId, setSelectedWithdrawalsUserId] = useState<string | null>(null);
  const [selectedTransferDetailId, setSelectedTransferDetailId] = useState<string | null>(null);
  const [activity, setActivity] = useState<UserAuthActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [adminFilter, setAdminFilter] = useState<string | "all" | "mine">("all");
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [editAdminTarget, setEditAdminTarget] = useState<AdminRow | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [changePasswordForced, setChangePasswordForced] = useState(false);
  const unblockAccountFn = useServerFn(unblockAccount);
  const setTagColorFn = useServerFn(setUserTagColor);
  const effectiveViewerLevel = viewerLevel ?? localAdminLevel;

  const displayedReferralCode = useMemo(() => {
    if (customReferralCode) return customReferralCode;
    if (admins.length > 0 && user?.id) {
      const me = admins.find((a) => a.user_id === user.id);
      if (me?.referral_code) return me.referral_code;
    }
    return referralCode ?? null;
  }, [customReferralCode, admins, user?.id, referralCode]);

  const handleCopyReferralCode = () => {
    if (!displayedReferralCode) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(displayedReferralCode);
      }
      setCopiedReferral(true);
      setTimeout(() => setCopiedReferral(false), 2000);
    } catch (e) {
      console.error("Failed to copy referral code", e);
    }
  };

  useEffect(() => {
    if (effectiveViewerLevel === "master" && user?.user_metadata?.must_change_password) {
      setChangePasswordForced(true);
      setChangePasswordOpen(true);
    }
  }, [user, effectiveViewerLevel]);


  useEffect(() => {
    if (!selected) { setActivity(null); return; }
    setActivityLoading(true);
    fetchActivity({ data: { user_id: selected.user_id } })
      .then((a: UserAuthActivity) => setActivity(a))
      .catch((e: unknown) => { console.error("activity", e); setActivity(null); })
      .finally(() => setActivityLoading(false));
  }, [selected, fetchActivity]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingData(true);
    callWithRetry(() => fetchUsers())
      .then((res: { users: AdminUserDetail[]; viewerLevel: AdminLevel; viewerReadOnly?: boolean }) => { setRows(res.users); setViewerLevel(res.viewerLevel); setViewerReadOnly(!!res.viewerReadOnly); })
      .catch((e: unknown) => console.error("admin list", e))
      .finally(() => setLoadingData(false));
  }, [isAdmin, fetchUsers]);

  const reloadAdmins = () => {
    callWithRetry(() => fetchAdmins())
      .then((r: { rows: AdminRow[]; viewerLevel: AdminLevel }) => { setAdmins(r.rows); setViewerLevel(r.viewerLevel); })
      .catch((e: unknown) => console.error("admins", e));
  };

  useEffect(() => {
    if (!isAdmin || (effectiveViewerLevel !== "master" && effectiveViewerLevel !== "geral")) return;
    reloadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, effectiveViewerLevel]);

  useEffect(() => {
    if (!effectiveViewerLevel || initialSectionReady) return;
    if (effectiveViewerLevel !== "master" && section === "admins") setSection("users");
    setInitialSectionReady(true);
  }, [effectiveViewerLevel, initialSectionReady, section]);

  // Geral defaults to viewing his own captured clients
  useEffect(() => {
    if (effectiveViewerLevel === "geral" && !viewerReadOnly) setAdminFilter("mine");
    if (viewerReadOnly) setAdminFilter("all");
  }, [effectiveViewerLevel, viewerReadOnly]);

  // Admin plan gate: applies to non-master admins
  const planEnabled = isAdmin && effectiveViewerLevel !== null && effectiveViewerLevel !== "master";
  const { plan, loading: planLoading, isExpired: planExpired } = useAdminPlan(planEnabled);


  const reloadWithdrawals = () => {
    fetchWithdrawals()
      .then((res: { rows: WithdrawalRow[] }) => setWithdrawals(res.rows))
      .catch((e: unknown) => console.error("withdrawals", e));
  };

  useEffect(() => {
    if (!isAdmin || section !== "withdrawals") return;
    reloadWithdrawals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, section]);

  const [refuseTarget, setRefuseTarget] = useState<WithdrawalRow | null>(null);
  const [refuseReason, setRefuseReason] = useState("");
  const [refuseError, setRefuseError] = useState<string | null>(null);

  const handleWithdrawalAction = async (id: string, status: "aprovado" | "recusado", kind?: "withdrawal" | "transfer", reason?: string) => {
    setUpdatingId(id);
    try {
      await updateWithdrawal({ data: { id, status, kind, reason } });
      reloadWithdrawals();
    } catch (e: any) {
      console.error("update withdrawal", e);
      window.alert(e?.message ?? "Falha ao atualizar a solicitação.");
    } finally {
      setUpdatingId(null);
    }
  };

  const openRefuse = (w: WithdrawalRow) => {
    setRefuseTarget(w);
    setRefuseReason("");
    setRefuseError(null);
  };

  const submitRefuse = async () => {
    if (!refuseTarget) return;
    const reason = refuseReason.trim();
    if (reason.length < 3) {
      setRefuseError("Descreva o motivo do cancelamento (mín. 3 caracteres).");
      return;
    }
    setUpdatingId(refuseTarget.id);
    try {
      await updateWithdrawal({ data: { id: refuseTarget.id, status: "recusado", kind: refuseTarget.kind, reason } });
      setRefuseTarget(null);
      reloadWithdrawals();
    } catch (e: any) {
      console.error("refuse withdrawal", e);
      setRefuseError(e?.message ?? "Falha ao cancelar.");
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = useMemo(
    () =>
      rows
        .filter((r) => {
          if (adminFilter === "mine" && r.referred_by !== user?.id) return false;
          if (adminFilter !== "all" && adminFilter !== "mine" && r.referred_by !== adminFilter) return false;
          if (search) {
            const q = search.toLowerCase();
            const hay = [r.full_name, r.email, r.referred_by_name].filter(Boolean).join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [rows, search, adminFilter, user?.id],
  );

  // Map user_id -> referred_by, used to filter ops sections by selected admin
  const referredByMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const r of rows) m.set(r.user_id, r.referred_by ?? null);
    return m;
  }, [rows]);

  // Somente-leitura vale só para clientes de outros ADMs; a própria carteira é editável.
  const lockedFor = (targetUserId: string | null | undefined): boolean => {
    if (!viewerReadOnly) return false;
    if (!targetUserId) return true;
    return (referredByMap.get(targetUserId) ?? null) !== user?.id;
  };

  const matchesAdminScope = (userId: string): boolean => {
    if (adminFilter === "all") return true;
    const ref = referredByMap.get(userId) ?? null;
    if (adminFilter === "mine") return ref === user?.id;
    return ref === adminFilter;
  };

  const visibleWithdrawals = useMemo(
    () => withdrawals.filter((w) => matchesAdminScope(w.user_id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [withdrawals, adminFilter, referredByMap, user?.id],
  );

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-[#C6A667]/20 border-t-[#C6A667] rounded-full animate-spin" />
          <p className="text-xs text-[#999999] font-medium">Verificando autorização administrativa…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" />;
  if (!isAdmin) return <Navigate to="/conta" />;

  const handleLogout = async () => { await signOut(); navigate({ to: "/" }); };

  // Block expired non-master admins from the panel.
  if (planEnabled && !planLoading && planExpired) {
    return <AdminPlanExpiredScreen onSignOut={handleLogout} />;
  }

  const stats = [
    { label: t.totalUsers, value: rows.length.toString(), Icon: Users },
    { label: t.adminsCount, value: admins.length.toString(), Icon: ShieldCheck },
    { label: t.totalBalance, value: t.formatMoneyGBP(totalBalance), Icon: DollarSign },
  ];

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] flex w-full bg-[#080808] text-[#F5F5F5] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 h-full border-r border-[#292929] bg-[#050505] flex flex-col select-none overflow-hidden">
        <div className="shrink-0 px-5 py-5 flex items-center gap-3 border-b border-[#292929]">
          <div className="w-11 h-11 rounded-xl bg-[#141414] border border-[#292929] grid place-items-center">
            <Shield className="w-5 h-5 text-[#C6A667]" />
          </div>
          <div className="leading-tight">
            <div className="font-bold tracking-wider text-sm text-[#F5F5F5]">FSOCIETY</div>
            <div className="text-[10px] text-[#999999] tracking-[0.2em]">{t.masterAccess}</div>
          </div>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4 text-sm no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <NavGroup label={t.operations}>
            <NavItem label={t.users} Icon={Users} active={section === "users"} onClick={() => setSection("users")} />
            <NavItem label={t.withdrawals} Icon={ArrowUpFromLine} active={section === "withdrawals"} onClick={() => setSection("withdrawals")} />
            <NavItem
              label={isPt ? "Support Inbox (Chat)" : "Support Inbox"}
              Icon={MessageSquare}
              active={section === "inbox"}
              onClick={() => setSection("inbox")}
            />
            <NavItem
              label={isPt ? "Atendimento" : "Support Centre"}
              Icon={Headphones}
              active={section === "support"}
              onClick={() => setSection("support")}
            />
          </NavGroup>
          {(effectiveViewerLevel === "master" || effectiveViewerLevel === "geral") && (
            <NavGroup label={effectiveViewerLevel === "master" ? t.administration : "ADM COMUM"}>
              {effectiveViewerLevel === "master" && (
                <>
                  <NavItem label={t.admins} Icon={UserCog} active={section === "admins"} onClick={() => setSection("admins")} />
                  <NavItem label="Planos dos Admins" Icon={CalendarClock} active={section === "plans"} onClick={() => setSection("plans")} />
                </>
              )}
              {admins.filter((a) => a.level !== "master" && (effectiveViewerLevel === "master" || a.level === "comum")).length > 0 && (
                <div className={`${effectiveViewerLevel === "master" ? "ml-7" : "ml-2"} mt-1 space-y-0.5 border-l border-[#292929] pl-2`}>
                  {admins
                    .filter((a) => a.level !== "master" && (effectiveViewerLevel === "master" || a.level === "comum"))
                    .map((a) => {
                      const isActive = section === "users" && adminFilter === a.user_id;
                      return (
                        <button
                          key={a.user_id}
                          onClick={() => { setAdminFilter(a.user_id); setSearch(""); setSection("users"); }}
                          className={`w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs transition ${isActive ? "bg-[#141414] text-[#F5F5F5] border border-[#C6A667]/40 font-medium" : "text-[#999999] hover:bg-[#141414] hover:text-[#F5F5F5]"}`}
                          title={a.full_name ?? a.email ?? "Admin"}
                        >
                          <span className="truncate">{a.full_name ?? a.email ?? t.noName}</span>
                          <span className="text-[10px] text-[#999999] shrink-0">{a.client_count}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </NavGroup>
          )}
          <NavGroup label={t.complianceAndRisk}>
            <NavItem label={t.kycManager} Icon={ShieldCheck} active={section === "kyc"} onClick={() => setSection("kyc")} />
          </NavGroup>
          {effectiveViewerLevel === "master" && (
            <NavGroup label="Settings">
              <NavItem
                label="Change Password"
                Icon={Key}
                active={changePasswordOpen}
                onClick={() => {
                  setChangePasswordForced(false);
                  setChangePasswordOpen(true);
                }}
              />
            </NavGroup>
          )}
        </nav>



        <div className="mt-auto shrink-0 border-t border-[#292929] p-3 space-y-2">
          {/* Admin Referral Code Fixed Block */}
          <div className="rounded-lg bg-[#111111] border border-[#292929] p-2.5 select-text">
            <div className="flex items-center justify-between gap-1 mb-1.5 select-none">
              <span className="text-[10px] font-semibold tracking-wider text-[#999999] uppercase">
                {isPt ? "Seu código de referência" : "Your referral code"}
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1C1C1C] text-[#C6A667] border border-[#C6A667]/20 uppercase font-mono shrink-0">
                {effectiveViewerLevel ? `ADM ${effectiveViewerLevel}` : "ADMIN"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-[#1C1C1C] border border-[#292929] rounded px-2.5 py-1.5 min-h-[34px]">
              {roleLoading ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 border-2 border-[#C6A667]/30 border-t-[#C6A667] rounded-full animate-spin" />
                  <span className="text-xs text-[#999999]">Carregando…</span>
                </div>
              ) : displayedReferralCode ? (
                <>
                  <span className="font-mono text-xs font-bold tracking-wider text-[#F5F5F5] select-all truncate" title={displayedReferralCode}>
                    {displayedReferralCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyReferralCode}
                    title={copiedReferral ? (isPt ? "Copiado!" : "Copied!") : (isPt ? "Copiar código" : "Copy code")}
                    className="p-1 rounded text-[#999999] hover:text-[#F5F5F5] hover:bg-[#292929] transition shrink-0 flex items-center gap-1 select-none"
                    aria-label={isPt ? "Copiar código de referência" : "Copy referral code"}
                  >
                    {copiedReferral ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-medium">Copiado!</span>
                      </>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-[#C6A667]" />
                    )}
                  </button>
                </>
              ) : (
                <span className="text-xs text-[#999999] italic">
                  Código indisponível
                </span>
              )}
            </div>
          </div>

          <button onClick={() => navigate({ to: "/conta" })} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[#999999] hover:bg-[#141414] hover:text-[#F5F5F5] transition">
            <LayoutDashboard className="w-4 h-4" /> {t.dashboard}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-500/10 transition">
            <LogOut className="w-4 h-4" /> {t.signOut}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden">
        <header className="shrink-0 h-16 border-b border-[#292929] bg-[#0A0A0A] px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[#999999]">
            <ChevronLeft className="w-4 h-4 opacity-50" />
            <span>FSociety</span>
            <span className="opacity-40">›</span>
            <span className="text-[#F5F5F5] font-medium">{section === "users" ? t.users : section === "withdrawals" ? t.withdrawals : section === "admins" ? t.admins : section === "plans" ? "Planos dos Admins" : t.kycManager}</span>
          </div>
          <div className="flex items-center gap-4">
            {planEnabled && plan && <AdminCountdownBadge expiresAt={plan.expires_at} />}
            <button className="relative w-9 h-9 grid place-items-center rounded-lg bg-[#141414] border border-[#292929] text-[#999999] hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition">
              <Bell className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" />
              {t.systemOperational}
            </div>
          </div>
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
          {section === "users" && (
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">{t.usersTitle}</h1>
                <p className="text-sm text-slate-400 mt-1">{t.usersSubtitle}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {stats.map(({ label, value, Icon }) => (
                  <div key={label} className="rounded-xl border border-[#292929] bg-[#141414] p-5 hover:border-[#3D3D3D] transition">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs text-[#999999]">{label}</span>
                      <Icon className="w-4 h-4 text-[#C6A667]" />
                    </div>
                    <div className="text-2xl font-bold tracking-tight text-[#F5F5F5]">{value}</div>
                  </div>
                ))}
              </div>

              <section className="rounded-xl border border-[#292929] bg-[#111111]">
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#292929]">
                  <h2 className="font-semibold text-[#F5F5F5]">{t.userListCount(filtered.length)}</h2>
                  <div className="flex items-center gap-3">
                    {effectiveViewerLevel && effectiveViewerLevel !== "comum" && (
                      <select
                        value={adminFilter}
                        onChange={(e) => setAdminFilter(e.target.value as any)}
                        style={{ colorScheme: "dark" }}
                        className="bg-[#1C1C1C] border border-[#292929] rounded-lg px-3 py-2 text-sm text-[#F5F5F5] focus:outline-none focus:border-[#C6A667]/50 [&>option]:bg-[#1C1C1C] [&>option]:text-[#F5F5F5]"
                      >
                        <option value="all" className="bg-[#1C1C1C] text-[#F5F5F5]">{t.allClients}</option>
                        <option value="mine" className="bg-[#1C1C1C] text-[#F5F5F5]">{effectiveViewerLevel === "geral" ? "Meus clientes" : t.myClientsMaster}</option>
                        {Array.from(new Map(rows.filter((r) => r.referred_by && r.referred_by_name).map((r) => [r.referred_by!, { id: r.referred_by!, name: r.referred_by_name!, level: r.referred_by_level }])).values())
                          .filter((a) => effectiveViewerLevel === "master" || a.level === "comum")
                          .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
                          .map((a) => (
                            <option key={a.id} value={a.id} className="bg-[#1C1C1C] text-[#F5F5F5]">{a.name} {a.level ? `· ${a.level.toUpperCase()}` : ""}</option>
                          ))}
                      </select>
                    )}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.searchByNameEmailOrAdmin} className="bg-[#1C1C1C] border border-[#292929] rounded-lg pl-9 pr-3 py-2 text-sm w-72 text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />
                    </div>
                  </div>
                </div>


                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-[#999999] border-b border-[#292929]">
                        <th className="px-6 py-3 font-medium">{t.name}</th>
                        <th className="px-4 py-3 font-medium">{t.responsibleAdmin}</th>
                        <th className="px-4 py-3 font-medium">{t.role}</th>
                        <th className="px-4 py-3 font-medium">{t.balance}</th>
                        <th className="px-4 py-3 font-medium text-right">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingData && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-[#999999]">{t.loading}</td></tr>
                      )}
                      {!loadingData && filtered.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-12 text-center text-[#999999]">{t.noUsersFound}</td></tr>
                      )}
                      {filtered.map((r) => {
                        const tagBg: Record<TagColor, string> = {
                          none: "",
                          green: "bg-emerald-500/[0.06]",
                          red: "bg-rose-500/[0.06]",
                          yellow: "bg-amber-500/[0.06]",
                          purple: "bg-violet-500/[0.06]",
                        };
                        const tagBar: Record<TagColor, string> = {
                          none: "bg-transparent",
                          green: "bg-emerald-400",
                          red: "bg-rose-400",
                          yellow: "bg-amber-400",
                          purple: "bg-violet-400",
                        };
                        return (
                        <tr key={r.user_id} className={`border-b border-[#292929] hover:bg-[#161616] transition ${r.account_blocked ? "bg-rose-500/[0.03]" : tagBg[r.tag_color]}`}>
                          <td className="px-6 py-4 relative">
                            <span className={`absolute left-0 top-0 bottom-0 w-1 ${tagBar[r.tag_color]}`} />
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full grid place-items-center ${r.account_blocked ? "bg-rose-500/15 text-rose-400" : "bg-[#1C1C1C] border border-[#292929] text-[#999999]"}`}>
                                {r.account_blocked ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                              </div>
                              <div>
                                <div className="font-medium flex items-center gap-2 text-[#F5F5F5]">
                                  {r.full_name ?? t.noName}
                                  {r.account_blocked && (
                                    <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-300">BLOQUEADO</span>
                                  )}
                                </div>
                                <div className="text-xs text-[#999999]">{r.email ?? t.none}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {r.referred_by_name ? (
                              <div className="min-w-0">
                                <div className="text-xs font-medium text-[#F5F5F5] truncate max-w-[180px]">{r.referred_by_name}</div>
                                {r.referred_by_level && (
                                  <div className="text-[10px] uppercase tracking-wider text-[#999999]">{r.referred_by_level}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-[#999999]">{t.noResponsibleAdmin}</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${r.role === "admin" ? "bg-[#1C1C1C] text-[#C6A667] border border-[#C6A667]/30" : "bg-[#1C1C1C] text-[#999999] border border-[#292929]"}`}>
                              {r.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-medium tabular-nums text-[#F5F5F5]">
                            {t.formatMoneyGBP(r.balance)}
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {!lockedFor(r.user_id) && (
                              <TagColorPicker
                                value={r.tag_color}
                                onChange={async (c) => {
                                  setRows((prev) => prev.map((u) => u.user_id === r.user_id ? { ...u, tag_color: c } : u));
                                  try { await setTagColorFn({ data: { user_id: r.user_id, tag_color: c } }); }
                                  catch (e: any) { window.alert(e?.message ?? "Falha ao atualizar etiqueta."); }
                                }}
                              />
                              )}
                              <button
                                onClick={() => navigate({ to: "/admin/usuarios/$userId", params: { userId: r.user_id } })}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#292929] hover:bg-[#252525] hover:border-[#3D3D3D] transition text-xs font-medium"
                              >
                                <Eye className="w-3.5 h-3.5" /> {t.viewDetails}
                              </button>
                            </div>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}

          {section === "withdrawals" && (() => {
            const scopedWithdrawals = visibleWithdrawals;
            const grouped = new Map<string, { user_id: string; full_name: string | null; email: string | null; items: WithdrawalRow[] }>();
            for (const w of scopedWithdrawals) {
              const g = grouped.get(w.user_id) ?? { user_id: w.user_id, full_name: w.full_name, email: w.email, items: [] };
              g.items.push(w);
              grouped.set(w.user_id, g);
            }
            const groups = Array.from(grouped.values()).filter((g) =>
              !withdrawalsSearch ||
              g.full_name?.toLowerCase().includes(withdrawalsSearch.toLowerCase()) ||
              g.email?.toLowerCase().includes(withdrawalsSearch.toLowerCase()),
            );
            const pend = scopedWithdrawals.filter((w) => w.status === "solicitado");
            const appr = scopedWithdrawals.filter((w) => w.status === "aprovado");
            const totalPend = pend.reduce((s, w) => s + w.amount, 0);
            const wStats = [
              { label: t.pending, value: pend.length.toString(), Icon: Clock },
              { label: t.approved, value: appr.length.toString(), Icon: Check },
              { label: t.pendingValue, value: t.formatMoneyEuro(totalPend), Icon: DollarSign },
            ];
            return (
              <>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-[#F5F5F5]">{t.withdrawalsTitle}</h1>
                  <p className="text-sm text-[#999999] mt-1">{t.withdrawalsSubtitle}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {wStats.map(({ label, value, Icon }) => (
                    <div key={label} className="rounded-xl border border-[#292929] bg-[#141414] p-5 hover:border-[#3D3D3D] transition">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-[#999999]">{label}</span>
                        <Icon className="w-4 h-4 text-[#C6A667]" />
                      </div>
                      <div className="text-2xl font-bold tracking-tight text-[#F5F5F5]">{value}</div>
                    </div>
                  ))}
                </div>

                <section className="rounded-xl border border-[#292929] bg-[#111111]">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929]">
                    <h2 className="font-semibold text-[#F5F5F5]">{t.clientsWithWithdrawals(groups.length)}</h2>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999999]" />
                      <input value={withdrawalsSearch} onChange={(e) => setWithdrawalsSearch(e.target.value)} placeholder={t.searchByNameOrEmail} className="bg-[#1C1C1C] border border-[#292929] rounded-lg pl-9 pr-3 py-2 text-sm w-72 text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-[#C6A667]/50" />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-[#999999] border-b border-[#292929]">
                          <th className="px-6 py-3 font-medium">{t.client}</th>
                          <th className="px-4 py-3 font-medium">{t.requests}</th>
                          <th className="px-4 py-3 font-medium">{t.pending}</th>
                          <th className="px-4 py-3 font-medium">{t.totalPending}</th>
                          <th className="px-4 py-3 font-medium text-right">{t.actions}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.length === 0 && (
                          <tr><td colSpan={5} className="px-6 py-12 text-center text-[#999999]">{t.noWithdrawalRequests}</td></tr>
                        )}
                        {groups.map((g) => {
                          const gp = g.items.filter((w) => w.status === "solicitado");
                          const gpTotal = gp.reduce((s, w) => s + w.amount, 0);
                          return (
                            <tr key={g.user_id} className="border-b border-[#292929] hover:bg-[#161616] transition">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-[#1C1C1C] border border-[#292929] grid place-items-center text-[#999999]">
                                    <UserIcon className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-[#F5F5F5]">{g.full_name ?? t.noName}</div>
                                    <div className="text-xs text-[#999999]">{g.email ?? t.none}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4 font-medium text-[#F5F5F5]">{g.items.length}</td>
                              <td className="px-4 py-4">
                                {gp.length > 0 ? (
                                  <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">{gp.length} PENDING</span>
                                ) : (
                                  <span className="text-xs text-[#999999]">{t.none}</span>
                                )}
                              </td>
                              <td className="px-4 py-4 font-semibold tabular-nums text-[#F5F5F5]">{t.formatMoneyEuro(gpTotal)}</td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end">
                                  <button
                                    onClick={() => setSelectedWithdrawalsUserId(g.user_id)}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#292929] hover:bg-[#252525] hover:border-[#3D3D3D] transition text-xs font-medium"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> {t.viewWithdrawals}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            );
          })()}




          {section === "kyc" && (
            <>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-[#F5F5F5]">{t.kycTitle}</h1>
                <p className="text-sm text-[#999999] mt-1">{t.kycSubtitle}</p>
              </div>
              <div className="rounded-xl border border-[#292929] bg-[#111111] p-12 text-center">
                <ShieldCheck className="w-12 h-12 mx-auto text-[#C6A667] mb-4" />
                <h3 className="font-semibold text-lg mb-2 text-[#F5F5F5]">{t.noPendingKyc}</h3>
                <p className="text-sm text-[#999999]">{t.kycEmptyDesc}</p>
              </div>
            </>
          )}

          {section === "admins" && effectiveViewerLevel === "master" && (
            <AdminsSection
              admins={admins}
              onCreate={() => setShowCreateAdmin(true)}
              onEditCode={async (uid, code) => {
                try {
                  await updateCodeFn({ data: { user_id: uid, referral_code: code } });
                  if (uid === user?.id) setCustomReferralCode(code.toUpperCase());
                  reloadAdmins();
                }
                catch (e: any) { window.alert(e?.message ?? "Falha ao atualizar código"); }
              }}
              onDelete={async (uid) => {
                if (!window.confirm("Excluir este administrador? Esta ação é permanente.")) return;
                try { await deleteAdminFn({ data: { user_id: uid } }); reloadAdmins(); }
                catch (e: any) { window.alert(e?.message ?? "Falha ao excluir"); }
              }}
              onEdit={(a) => setEditAdminTarget(a)}
            />
          )}

          {section === "plans" && effectiveViewerLevel === "master" && <AdminPlansTab />}
          {section === "inbox" && (
            <AdminChatInboxTab
              effectiveViewerLevel={effectiveViewerLevel}
              adminId={user?.id}
            />
          )}
          {section === "support" && (
            <AdminSupportTab
              effectiveViewerLevel={effectiveViewerLevel}
              adminId={user?.id}
            />
          )}
        </main>
      </div>

      {planEnabled && plan && <AdminCountdownPopup expiresAt={plan.expires_at} />}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl text-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414] shrink-0">
              <h3 className="font-semibold text-[#F5F5F5]">{t.userDetails}</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">

              <div className="flex items-center gap-4 pb-4 border-b border-[#292929]">
                <div className={`w-14 h-14 rounded-full grid place-items-center ${selected.account_blocked ? "bg-rose-900 border border-rose-500/30 text-rose-300" : "bg-[#1C1C1C] border border-[#292929] text-[#C6A667]"}`}>
                  <UserIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg flex items-center gap-2 text-[#F5F5F5]">
                    {selected.full_name ?? t.noName}
                    {selected.account_blocked && (
                      <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">BLOQUEADO</span>
                    )}
                  </div>
                  <span className={`inline-block mt-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded ${selected.role === "admin" ? "bg-[#1C1C1C] text-[#C6A667] border border-[#C6A667]/30" : "bg-[#1C1C1C] text-[#999999] border border-[#292929]"}`}>
                    {selected.role.toUpperCase()}
                  </span>
                </div>
              </div>

              <DetailRow Icon={Mail} label={t.email} value={selected.email ?? t.none} />
              <DetailRow Icon={Phone} label={t.phone} value={selected.phone ?? t.none} />
              <DetailRow Icon={Calendar} label={t.creationDate} value={t.ptBrDate(selected.created_at)} />
              <DetailRow
                Icon={DollarSign}
                label={t.accountBalance}
                value={t.formatMoneyGBP(selected.balance)}
              />

              {selected.account_blocked && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 space-y-3">
                  <div className="text-xs text-rose-200 font-medium flex items-center gap-2">
                    <Shield className="w-4 h-4 text-rose-400" />
                    Conta bloqueada por ordem judicial
                  </div>
                  <button
                    onClick={async () => {
                      if (!window.confirm("Deseja realmente DESBLOQUEAR a conta deste cliente?\n\nO acesso será restaurado imediatamente.")) return;
                      try {
                        await unblockAccountFn({ data: { user_id: selected.user_id } });
                        setRows((prev) => prev.map((u) => u.user_id === selected.user_id ? { ...u, account_blocked: false, account_blocked_at: null } : u));
                        setSelected((prev) => prev ? { ...prev, account_blocked: false, account_blocked_at: null } : prev);
                      } catch (e: any) {
                        window.alert(e?.message ?? "Falha ao desbloquear conta.");
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition text-xs font-semibold"
                  >
                    <Unlock className="w-3.5 h-3.5" /> DESBLOQUEAR CONTA
                  </button>
                </div>
              )}

              <div className="pt-4 mt-2 border-t border-[#292929] space-y-3">
                <div className="text-xs uppercase tracking-[0.2em] text-[#999999]">{t.accessActivity}</div>
                {activityLoading && <div className="text-sm text-[#999999]">{t.loadingActivity}</div>}
                {!activityLoading && activity && (
                  <>
                    <DetailRow Icon={Globe} label={t.signupIp} value={activity.signup_ip ?? t.none} />
                    <DetailRow Icon={LogIn} label={t.lastLogin} value={activity.last_sign_in_at ? `${t.ptBrDate(activity.last_sign_in_at)}${activity.last_sign_in_ip ? ` · ${activity.last_sign_in_ip}` : ""}` : t.none} />
                    <DetailRow Icon={ShieldCheck} label={t.provider} value={activity.provider ?? "email"} />

                    <div>
                      <div className="text-xs text-[#999999] mb-2">{t.historyCount(activity.entries.length)}</div>
                      <div className="max-h-56 overflow-y-auto rounded-lg border border-[#292929] divide-y divide-[#292929]">
                        {activity.entries.length === 0 && (
                          <div className="px-3 py-4 text-center text-xs text-[#999999]">{t.noRecords}</div>
                        )}
                        {activity.entries.slice(0, 50).map((e, i) => (
                          <div key={i} className="px-3 py-2 flex items-center justify-between text-xs">
                            <div>
                              <div className="font-medium text-[#F5F5F5]">{e.action ?? t.none}</div>
                              <div className="text-[#999999]">{t.ptBrDate(e.created_at)}</div>
                            </div>
                            <div className="font-mono text-[#999999]">{e.ip_address ?? t.none}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdrawals per-user modal */}
      {selectedWithdrawalsUserId && (() => {
        const userItems = withdrawals.filter((w) => w.user_id === selectedWithdrawalsUserId);
        const head = userItems[0];
        return (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl text-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414]">
                <div>
                  <h3 className="font-semibold text-[#F5F5F5]">{t.withdrawalRequests}</h3>
                  <div className="text-xs text-[#999999] mt-0.5">{head?.full_name ?? t.noName} · {head?.email ?? t.none}</div>
                </div>
                <button onClick={() => setSelectedWithdrawalsUserId(null)} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] transition">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6">
                <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-[#292929] divide-y divide-[#292929]">
                  {userItems.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-[#999999]">{t.noRequests}</div>
                  )}
                  {userItems.map((w) => (
                    <div key={w.id} className="px-4 py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold tabular-nums text-[#F5F5F5]">{t.formatMoneyEuro(w.amount)}</div>
                          <StatusBadge status={w.status} />
                          {w.kind === "transfer" && (
                            <button
                              type="button"
                              onClick={() => setSelectedTransferDetailId(w.id)}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] text-[#F5F5F5] font-medium transition ml-1"
                            >
                              <Eye className="w-3 h-3 text-[#C6A667]" /> View details
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-[#999999] mt-1 uppercase tracking-wider">{w.method}</div>
                        <div className="text-xs text-[#999999] font-mono break-all">{w.pix_key ?? t.none}</div>
                        <div className="text-xs text-[#999999] mt-1">{t.ptBrDate(w.created_at)}</div>
                      </div>
                      {w.status === "solicitado" && !lockedFor(w.user_id) && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            disabled={updatingId === w.id}
                            onClick={() => handleWithdrawalAction(w.id, "aprovado", w.kind)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition text-xs font-medium disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" /> {t.approve}
                          </button>
                          <button
                            disabled={updatingId === w.id}
                            onClick={() => openRefuse(w)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 transition text-xs font-medium disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" /> {t.refuse}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Refuse withdrawal/transfer modal */}
      {refuseTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl text-[#F5F5F5]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414]">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-400" />
                <h3 className="font-semibold text-[#F5F5F5]">Cancelar solicitação</h3>
              </div>
              <button onClick={() => setRefuseTarget(null)} className="text-[#999999] hover:text-[#F5F5F5] transition">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-[#999999]">
                Informe o motivo do cancelamento. O cliente verá esta mensagem no extrato.
              </p>
              <textarea
                autoFocus
                value={refuseReason}
                onChange={(e) => { setRefuseReason(e.target.value); setRefuseError(null); }}
                rows={4}
                maxLength={500}
                placeholder="Ex.: Documentação insuficiente para validar a operação."
                className="w-full rounded-lg bg-[#1C1C1C] border border-[#292929] px-3 py-2 text-sm text-[#F5F5F5] placeholder:text-[#999999] focus:outline-none focus:border-rose-400/50 resize-none"
              />
              {refuseError && <p className="text-xs text-rose-400">{refuseError}</p>}
            </div>
            <div className="px-6 py-4 border-t border-[#292929] bg-[#141414] flex items-center justify-end gap-2">
              <button
                onClick={() => setRefuseTarget(null)}
                className="px-3 py-1.5 rounded-lg text-sm text-[#999999] border border-[#292929] hover:bg-[#1C1C1C] hover:text-[#F5F5F5] transition"
              >
                Voltar
              </button>
              <button
                onClick={submitRefuse}
                disabled={updatingId === refuseTarget.id}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition disabled:opacity-50"
              >
                Confirmar cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateAdmin && (
        <CreateAdminModal
          onClose={() => setShowCreateAdmin(false)}
          onCreated={() => { setShowCreateAdmin(false); reloadAdmins(); }}
          createAdminFn={createAdminFn}
        />
      )}

      {editAdminTarget && (
        <EditAdminModal
          admin={editAdminTarget}
          onClose={() => setEditAdminTarget(null)}
          onSave={async (password) => {
            await updatePasswordFn({ data: { user_id: editAdminTarget.user_id, password } });
            setEditAdminTarget(null);
          }}
        />
      )}

      <AdminTransferDetailModal
        transferId={selectedTransferDetailId}
        onClose={() => setSelectedTransferDetailId(null)}
      />

      {effectiveViewerLevel === "master" && (
        <ChangePasswordModal
          open={changePasswordOpen}
          onOpenChange={(v) => {
            setChangePasswordOpen(v);
            if (!v) setChangePasswordForced(false);
          }}
          forced={changePasswordForced}
          isMasterOnly={true}
          onSuccess={() => {
            setChangePasswordForced(false);
          }}
        />
      )}
    </div>
  );
}

function AdminsSection({
  admins, onCreate, onEditCode, onDelete, onEdit,
}: {
  admins: AdminRow[];
  onCreate: () => void;
  onEditCode: (uid: string, code: string) => void | Promise<void>;
  onDelete: (uid: string) => void | Promise<void>;
  onEdit: (a: AdminRow) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#F5F5F5]">{t.adminsTitle}</h1>
          <p className="text-sm text-[#999999] mt-1">{t.adminsSubtitle}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] text-sm font-semibold hover:bg-[#252525] border border-[#C6A667]/50 hover:border-[#C6A667] transition shadow-sm"
        >
          <Plus className="w-4 h-4 text-[#C6A667]" /> {t.newAdmin}
        </button>
      </div>

      <section className="rounded-xl border border-[#292929] bg-[#111111]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#999999] border-b border-[#292929]">
                <th className="px-6 py-3 font-medium">{t.name}</th>
                <th className="px-4 py-3 font-medium">{t.level}</th>
                <th className="px-4 py-3 font-medium">{t.code}</th>
                <th className="px-4 py-3 font-medium">{t.clients}</th>
                <th className="px-4 py-3 font-medium text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 && (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-[#999999]">{t.noAdminBeyondMaster}</td></tr>
              )}
              {admins.map((a) => (
                <tr key={a.user_id} className="border-b border-[#292929] hover:bg-[#141414] transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#F5F5F5]">{a.full_name ?? t.noName}</div>
                    <div className="text-xs text-[#999999]">{a.email ?? t.none}</div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${a.level === "master" ? "bg-amber-500/15 text-[#C6A667] border border-[#C6A667]/30" : a.level === "geral" ? "bg-violet-500/15 text-violet-300" : "bg-[#1C1C1C] text-[#999999] border border-[#292929]"}`}>
                      ADM {a.level.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {editing === a.user_id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={draft}
                          onChange={(e) => setDraft(e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20))}
                          className="bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded px-2 py-1 text-sm font-mono w-28 focus:outline-none focus:border-[#C6A667]/60"
                        />
                        <button onClick={async () => { if (draft.length >= 2) { await onEditCode(a.user_id, draft); setEditing(null); } }} className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 text-xs"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setEditing(null)} className="px-2 py-1 rounded bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] text-xs"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-[#C6A667]">{a.referral_code ?? t.none}</span>
                        <button onClick={() => { setEditing(a.user_id); setDraft(a.referral_code ?? ""); }} className="text-[#999999] hover:text-[#F5F5F5]">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 font-medium text-[#F5F5F5]">{a.client_count}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onEdit(a)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#292929] hover:bg-[#252525] hover:border-[#C6A667]/50 transition text-xs font-medium"
                      >
                        <Pencil className="w-3.5 h-3.5 text-[#C6A667]" /> {t.editAdm}
                      </button>
                      <button onClick={() => onDelete(a.user_id)} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition text-xs font-medium">
                        <Trash2 className="w-3.5 h-3.5" /> {t.delete}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CreateAdminModal({
  onClose, onCreated, createAdminFn,
}: {
  onClose: () => void;
  onCreated: () => void;
  createAdminFn: (args: { data: { email: string; password: string; full_name: string; level: "geral" | "comum"; referral_code?: string } }) => Promise<{ ok: boolean; user_id: string; referral_code: string }>;
}) {
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [level, setLevel] = useState<"geral" | "comum">("comum");
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (full_name.trim().length < 2) return setErr(t.errName);
    if (!/\S+@\S+\.\S+/.test(email)) return setErr(t.errEmail);
    if (password.length < 6) return setErr(t.errPassword);
    setSaving(true);
    try {
      await createAdminFn({ data: { email: email.trim(), password, full_name: full_name.trim(), level, referral_code: code.trim() || undefined } });
      onCreated();
    } catch (e: any) {
      setErr(e?.message ?? t.errCreateAdmin);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414]">
          <h3 className="font-semibold text-[#F5F5F5]">{t.newAdministrator}</h3>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <Input label={t.fullName} value={full_name} onChange={setFullName} placeholder={t.fullNamePlaceholder} />
          <Input label={t.email} value={email} onChange={setEmail} placeholder={t.emailPlaceholder} type="email" />
          <Input label={t.password} value={password} onChange={setPassword} placeholder={t.passwordPlaceholder} type="password" />
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999]">{t.levelLabel}</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as any)} className="w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#C6A667]/60">
              <option value="comum" className="bg-[#1C1C1C] text-[#F5F5F5]">{t.admComum}</option>
              <option value="geral" className="bg-[#1C1C1C] text-[#F5F5F5]">{t.admGeral}</option>
            </select>
          </div>
          <Input label={t.referralCodeOptional} value={code} onChange={(v) => setCode(v.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 20))} placeholder={t.referralCodePlaceholder} />
          {err && <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#999999] hover:text-[#F5F5F5] hover:bg-[#1C1C1C] transition">{t.cancel}</button>
            <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:bg-[#252525] hover:border-[#C6A667] text-sm font-medium transition disabled:opacity-50">
              <Plus className="w-4 h-4 text-[#C6A667]" /> {saving ? t.creating : t.createAdmin}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-[#999999]">{label}</label>
      <div className="relative">
        <input
          type={isPassword ? (showPassword ? "text" : "password") : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-[#1C1C1C] border border-[#292929] text-[#F5F5F5] placeholder:text-[#999999] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#C6A667]/60 ${isPassword ? "pr-10" : ""}`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999999] hover:text-[#F5F5F5] transition"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}


function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="px-3 py-2 text-[10px] tracking-[0.2em] text-[#999999] uppercase font-semibold">{label}</div>
      <div className="space-y-0.5 mt-1">{children}</div>
    </div>
  );
}

function NavItem({ label, Icon, active, onClick }: { label: string; Icon: any; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${active ? "bg-[#141414] text-[#F5F5F5] border border-[#C6A667]/40 shadow-sm" : "text-[#999999] hover:bg-[#141414] hover:text-[#F5F5F5] border border-transparent"}`}>
      <Icon className={`w-4 h-4 ${active ? "text-[#C6A667]" : "text-[#999999]"}`} />
      {label}
    </button>
  );
}

function DetailRow({ Icon, label, value }: { Icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-[#141414] border border-[#292929] grid place-items-center text-[#C6A667] shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[#999999]">{label}</div>
        <div className="font-medium text-[#F5F5F5] break-all">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "solicitado" | "aprovado" | "recusado" }) {
  const map = {
    solicitado: { label: t.statusPending, cls: "bg-amber-500/15 text-amber-400" },
    aprovado: { label: t.statusApproved, cls: "bg-emerald-500/15 text-emerald-400" },
    recusado: { label: t.statusRefused, cls: "bg-rose-500/15 text-rose-400" },
  } as const;
  const s = map[status];
  return <span className={`text-[10px] font-bold tracking-wider px-2 py-1 rounded ${s.cls}`}>{s.label.toUpperCase()}</span>;
}

function EditAdminModal({
  admin, onClose, onSave,
}: {
  admin: AdminRow;
  onClose: () => void;
  onSave: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (password.length < 6) return setErr(t.errPasswordLength);
    if (password !== confirm) return setErr(t.errPasswordMatch);
    setSaving(true);
    try {
      await onSave(password);
      setPassword("");
      setConfirm("");
    } catch (e: any) {
      setErr(e?.message ?? t.errUpdatePassword);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setPassword("");
    setConfirm("");
    setErr(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#292929] bg-[#111111] shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#292929] bg-[#141414]">
          <div>
            <h3 className="font-semibold text-[#F5F5F5]">{t.editAdministrator}</h3>
            <div className="text-xs text-[#999999] mt-0.5">{admin.full_name ?? admin.email ?? t.none}</div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <Input
            label={t.newPassword}
            type="password"
            value={password}
            onChange={setPassword}
            placeholder={t.newPasswordPlaceholder}
          />
          <Input
            label={t.confirmPassword}
            type="password"
            value={confirm}
            onChange={setConfirm}
          />
          {err && <div className="text-xs text-rose-400">{err}</div>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={handleClose} className="px-4 py-2 rounded-lg bg-[#1C1C1C] text-[#999999] hover:text-[#F5F5F5] hover:bg-[#252525] border border-[#292929] text-sm transition">{t.cancel}</button>
            <button
              onClick={submit}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-[#1C1C1C] text-[#F5F5F5] border border-[#C6A667]/50 hover:border-[#C6A667] hover:bg-[#252525] text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? t.saving : t.savePassword}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TagColorPicker({ value, onChange }: { value: TagColor; onChange: (c: TagColor) => void }) {
  const [open, setOpen] = useState(false);
  const options: { c: TagColor; label: string; cls: string }[] = [
    { c: "none", label: "No tag", cls: "bg-slate-500" },
    { c: "green", label: "Working", cls: "bg-emerald-400" },
    { c: "red", label: "Client blocked", cls: "bg-rose-400" },
    { c: "yellow", label: "Waiting to pay taxes", cls: "bg-amber-400" },
    { c: "purple", label: "Waiting to receive", cls: "bg-violet-400" },
  ];
  const current = options.find((o) => o.c === value) ?? options[0];
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#252525] border border-[#292929] transition text-xs font-medium text-[#999999] hover:text-[#F5F5F5]"
        title={current.label}
      >
        <span className={`w-3 h-3 rounded-full ${current.cls}`} />
        <span className="hidden md:inline">Etiqueta</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        >
          <div
            className="w-full max-w-sm rounded-xl border border-[#292929] bg-[#111111] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#292929] bg-[#141414] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#F5F5F5]">Set tag</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[#999999] hover:text-[#F5F5F5] text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="py-2">
              {options.map((o) => (
                <button
                  key={o.c}
                  onClick={() => { onChange(o.c); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-[#141414] transition ${value === o.c ? "bg-[#141414] border-l-2 border-[#C6A667]" : ""}`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${o.cls}`} />
                  <span className="text-[#F5F5F5]">{o.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
