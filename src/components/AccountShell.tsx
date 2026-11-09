import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import {
  Search, Eye, EyeOff, MessageSquare, ChevronRight, Home, Wallet, ArrowLeftRight,
  TrendingUp, ShoppingBag, User, HelpCircle, LogOut, FileText, Files, CalendarDays,
  Receipt, Ban, Download, ClipboardCheck, CalendarClock, Landmark, RefreshCcw, Send, Shield,
  Mail, Phone, IdCard, Calendar, MapPin, Hash, BadgeCheck, Key, Clock,
  Copy, Check, Lock, AlertTriangle, RefreshCw,
} from "lucide-react";
import { BancoTesteLogo } from "@/components/BankLogo";
import { getInstitutionName } from "@/config/institution";
import { useAuth, useIsAdmin, signOut, type User as SupaUser } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SiteFooter } from "@/components/SiteFooter";
import { useAccount, useProfile, formatMoney, parseUkAccountCredentials, type Profile } from "@/lib/account";
import { useKycStatus } from "@/lib/kyc";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AccountBlockedOverlay } from "@/components/AccountBlockedOverlay";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";
import { CustomerErrorBoundary } from "@/components/CustomerErrorBoundary";
import { FloatingChatWidget } from "@/components/FloatingChatWidget";

type TabDef = {
  icon: typeof Home;
  labelKey: string;
  to?: string;
  menu?: { sectionKey: string; items: { icon: typeof FileText; labelKey: string; to?: string; search?: any }[] }[];
};

const tabs: TabDef[] = [
  { icon: Home, labelKey: "conta.tab.home", to: "/conta" },
  {
    icon: Wallet, labelKey: "conta.tab.digital", to: "/conta",
    menu: [
      { sectionKey: "conta.menu.balance", items: [
        { icon: FileText, labelKey: "conta.menu.statement", to: "/extrato" },
        { icon: Files, labelKey: "conta.menu.receipt", to: "/extrato", search: { tab: "receipts" } },
        { icon: CalendarDays, labelKey: "conta.menu.scheduled", to: "/standing-orders" },
      ]},
      { sectionKey: "conta.menu.more", items: [
        { icon: Receipt, labelKey: "conta.menu.fees", to: "/fees-charges" },
        { icon: Ban, labelKey: "conta.menu.judicial", to: "/bloqueio-judicial" },
        { icon: Download, labelKey: "conta.menu.income", to: "/interest-statements" },
      ]},
    ],
  },
  {
    icon: ArrowLeftRight, labelKey: "conta.tab.transactions", to: "/transferencia",
    menu: [
      { sectionKey: "conta.menu.pay", items: [
        { icon: Send, labelKey: "conta.menu.transfer", to: "/transferencia" },
        { icon: Clock, labelKey: "conta.menu.pending", to: "/pending-payments" },
        { icon: Search, labelKey: "conta.menu.track", to: "/track-payment" },
      ]},
    ],
  },
  { icon: MessageSquare, labelKey: "conta.tab.support", to: "/support" },
];

type ShellCtx = {
  user: SupaUser;
  isAdmin: boolean;
  showBalance: boolean;
  setShowBalance: (v: boolean | ((p: boolean) => boolean)) => void;
  mask: (v: string) => string;
  balance: number | null;
  currency: string;
  accountNumber?: string;
  iban?: string;
  profile?: Profile | null;
  loading?: boolean;
  balanceUnavailable?: boolean;
  refetchAccount?: () => void;
};

export function AccountShell({ children }: { children: (ctx: ShellCtx) => ReactNode }) {
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading } = useAuth();
  const { isAdmin, level: adminLevel, loading: roleLoading } = useIsAdmin(user?.id, user?.email);
  const { status: kycStatus, loading: kycLoading } = useKycStatus(user?.id);
  const [showBalance, setShowBalance] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { balance, currency, iban, accountNumber, loading: accountLoading, balanceUnavailable, refetch: refetchAccount } = useAccount();
  const { profile, loading: profileLoading } = useProfile();
  const isBlocked = !!profile?.account_blocked;

  const isAuthChecking = loading || roleLoading || kycLoading;
  const shouldRedirectHome = !isAuthChecking && !user;
  const shouldRedirectKyc = !isAuthChecking && !isAdmin && kycStatus && kycStatus !== "approved";

  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // 6-second safety timeout against network hangs or frozen states
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, 6000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isAuthChecking) return;
    if (shouldRedirectHome) {
      navigate({ to: "/" }).catch(() => {
        if (typeof window !== "undefined") {
          window.location.replace("/");
        }
      });
    } else if (shouldRedirectKyc) {
      navigate({ to: "/kyc" });
    }
  }, [isAuthChecking, shouldRedirectHome, shouldRedirectKyc, navigate]);

  // If loading took too long (e.g. offline, network timeout, or Supabase connection issue)
  if (timedOut && (isAuthChecking || shouldRedirectHome || shouldRedirectKyc)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
          <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {shouldRedirectHome
              ? (lang === "pt" ? "Sessão não encontrada" : "Session not found")
              : (lang === "pt" ? "O carregamento demorou mais que o esperado" : "Loading took longer than expected")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {shouldRedirectHome
              ? (lang === "pt" ? "Você não está conectado a uma conta ativa. Retorne para a página inicial." : "You are not signed in to an active account. Return to the home page.")
              : (lang === "pt" ? "Não foi possível carregar as informações da sua conta no momento. Verifique sua conexão e tente novamente." : "Unable to load your account information right now. Please check your connection and try again.")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{lang === "pt" ? "Tentar novamente" : "Try again"}</span>
            </button>
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.sessionStorage?.removeItem("bancoteste_sc_proof");
                  window.sessionStorage?.removeItem("bancoteste_auth_challenge");
                  window.localStorage?.removeItem("bancoteste_sc_proof");
                  window.sessionStorage?.removeItem("velunor_sc_proof");
                  window.sessionStorage?.removeItem("velunor_auth_challenge");
                  window.localStorage?.removeItem("velunor_sc_proof");
                  window.location.replace("/");
                }
              }}
              className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 transition"
            >
              {lang === "pt" ? "Ir para a página inicial" : "Go to home page"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isAuthChecking || shouldRedirectHome || shouldRedirectKyc) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-xs text-muted-foreground font-medium animate-pulse">
            {shouldRedirectHome
              ? (lang === "pt" ? "Redirecionando para a página inicial…" : "Redirecting to home page…")
              : (lang === "pt" ? `Carregando sua conta ${getInstitutionName()}…` : `Loading your ${getInstitutionName()} account…`)}
          </p>
        </div>
      </div>
    );
  }

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      window.sessionStorage?.removeItem("bancoteste_sc_proof");
      window.sessionStorage?.removeItem("bancoteste_auth_challenge");
      window.localStorage?.removeItem("bancoteste_sc_proof");
      window.sessionStorage?.removeItem("velunor_sc_proof");
      window.sessionStorage?.removeItem("velunor_auth_challenge");
      window.localStorage?.removeItem("velunor_sc_proof");
    }
    await signOut();
    navigate({ to: "/" });
  };
  const mask = (v: string) => (showBalance ? v : "••••••");
  const balanceLabel = balanceUnavailable
    ? t("conta.balanceUnavailable")
    : formatMoney(balance, currency);

  const handleCopy = (key: string, val: string) => {
    navigator.clipboard.writeText(val);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const { sortCode, accountNumber: parsedAccNo, iban: parsedIban, prettyIban } = parseUkAccountCredentials(accountNumber, iban);
  const notProvided = t("shell.notProvided");

  const isSupportPage = pathname === "/support";

  return (
    <main className={isSupportPage ? "h-[100dvh] flex flex-col bg-secondary/30 overflow-hidden pb-16 md:pb-0" : "min-h-screen bg-secondary/50 pb-20 md:pb-0"}>
      {/* Mobile top bar (Inter-style) */}
      <header className="md:hidden sticky top-0 z-30 bg-background border-b border-border/60 px-4 h-14 flex items-center justify-between select-none">
        <button
          onClick={() => setProfileOpen(true)}
          className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-foreground select-none"
          aria-label={t("shell.profile")}
        >
          <User className="w-5 h-5" />
        </button>
        <BancoTesteLogo to="/conta" size="sm" />
        <div className="flex items-center gap-3 select-none">
          <Link to="/contact" className="text-muted-foreground hover:text-primary transition" aria-label={t("shell.help")}>
            <HelpCircle className="w-5 h-5" />
          </Link>
          <button onClick={() => setShowBalance((v) => !v)} className="text-muted-foreground hover:text-primary transition" aria-label={t("shell.toggleBalance")}>
            {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      <header className="hidden md:block bg-background border-b border-border/60 select-none">
        <div className="mx-auto max-w-7xl px-6 h-20 flex items-center justify-between gap-6">
          <BancoTesteLogo to="/conta" size="lg" />

          <div className="flex items-center gap-6">
            <LanguageSwitcher />
            <button className="text-muted-foreground hover:text-primary transition" aria-label="Search">
              <Search className="w-5 h-5" />
            </button>
            <button onClick={() => setShowBalance((v) => !v)} className="text-muted-foreground hover:text-primary transition" aria-label="Toggle balance">
              {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-3 pl-6 border-l border-border">
              <div className="text-right">
                <p className="text-xs text-muted-foreground leading-tight">{t("conta.balance")}</p>
                <p className="text-sm font-semibold tabular-nums leading-tight">
                  {balanceUnavailable ? (
                    <span className="text-amber-600 font-medium text-xs">{t("conta.balanceUnavailable")}</span>
                  ) : (
                    mask(balanceLabel)
                  )}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>

            <button
              onClick={() => setProfileOpen(true)}
              className="w-10 h-10 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition"
              aria-label={t("shell.profile")}
            >
              <User className="w-5 h-5" />
            </button>

            <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto bg-background p-6">
                <SheetHeader className="text-left sr-only">
                  <SheetTitle>{t("shell.clientData")}</SheetTitle>
                </SheetHeader>

                {/* Profile Header */}
                <div className="flex items-center gap-4 pt-2 pb-5 border-b border-border/60">
                  <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center overflow-hidden shrink-0 border border-border/60">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold uppercase tracking-wide truncate text-foreground">
                      {profile?.full_name || user?.email || ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                        <BadgeCheck className="w-3 h-3" />
                        {profile?.kyc_status === "approved"
                          ? t("shell.kycApproved")
                          : (lang === "pt" ? "Conta Ativa" : "Active Account")}
                      </span>
                      <span className="text-[10px] text-muted-foreground">· {getInstitutionName()} UK</span>
                    </div>
                  </div>
                </div>

                {/* Seção 1: Dados Pessoais */}
                <div className="py-5 space-y-1">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-foreground">
                      {t("shell.personalData")}
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/60">
                      {t("shell.readOnly")}
                    </span>
                  </div>

                  <InfoRow
                    icon={User}
                    label={lang === "pt" ? "Nome completo" : "Full name"}
                    value={profile?.full_name || notProvided}
                    isMissing={!profile?.full_name}
                  />

                  <InfoRow
                    icon={Mail}
                    label={t("shell.email")}
                    value={user?.email ?? notProvided}
                    badge="Login"
                  />

                  <InfoRow
                    icon={Phone}
                    label={t("shell.phone")}
                    value={profile?.phone ? profile.phone : notProvided}
                    isMissing={!profile?.phone}
                  />

                  <InfoRow
                    icon={Calendar}
                    label={t("shell.birth")}
                    value={profile?.birth_date ? new Date(profile.birth_date).toLocaleDateString("en-GB") : notProvided}
                    isMissing={!profile?.birth_date}
                    badge={profile?.kyc_status === "approved" ? t("shell.kycApproved") : undefined}
                    badgeColor={profile?.kyc_status === "approved" ? "emerald" : "default"}
                  />

                  <InfoRow
                    icon={IdCard}
                    label={t("shell.document")}
                    value={
                      profile?.document_number
                        ? `${profile?.document_type ? profile.document_type.toUpperCase() + ": " : ""}${profile.document_number}`
                        : notProvided
                    }
                    isMissing={!profile?.document_number}
                    badge={profile?.kyc_status === "approved" ? t("shell.kycApproved") : undefined}
                    badgeColor={profile?.kyc_status === "approved" ? "emerald" : "default"}
                  />

                  <InfoRow
                    icon={MapPin}
                    label={t("shell.country")}
                    value={profile?.country ? profile.country : notProvided}
                    isMissing={!profile?.country}
                  />
                </div>

                {/* Seção 2: Dados Bancários */}
                <div className="py-5 space-y-1 border-t border-border/60">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider font-bold text-foreground">
                      {lang === "pt" ? "Dados Bancários" : "Banking Details"}
                    </h3>
                    <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full border border-border/60">
                      {t("shell.readOnly")}
                    </span>
                  </div>

                  {/* Sort Code */}
                  <CopyableRow
                    icon={Landmark}
                    label={t("shell.sortCode")}
                    value={sortCode || notProvided}
                    onCopy={sortCode ? () => handleCopy("sortCode", sortCode) : undefined}
                    copied={copiedKey === "sortCode"}
                    copiedText={t("shell.copied")}
                  />

                  {/* Account Number */}
                  <CopyableRow
                    icon={Hash}
                    label={t("shell.accountNumber")}
                    value={parsedAccNo || notProvided}
                    onCopy={parsedAccNo ? () => handleCopy("accNumber", parsedAccNo) : undefined}
                    copied={copiedKey === "accNumber"}
                    copiedText={t("shell.copied")}
                  />

                  {/* IBAN */}
                  <CopyableRow
                    icon={FileText}
                    label="IBAN"
                    value={prettyIban || notProvided}
                    onCopy={parsedIban ? () => handleCopy("iban", parsedIban) : undefined}
                    copied={copiedKey === "iban"}
                    copiedText={t("shell.copied")}
                  />

                  {/* Saldo disponível */}
                  <InfoRow
                    icon={Wallet}
                    label={t("shell.balance")}
                    value={mask(balanceLabel)}
                    extra={
                      <button
                        type="button"
                        onClick={() => setShowBalance((v) => !v)}
                        className="p-1.5 text-muted-foreground hover:text-foreground transition rounded-lg hover:bg-secondary"
                        title={t("shell.toggleBalance")}
                      >
                        {showBalance ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                    }
                  />

                  {/* Status da Conta */}
                  <InfoRow
                    icon={BadgeCheck}
                    label={t("shell.kyc")}
                    value={profile?.kyc_status === "approved" ? (lang === "pt" ? "Ativa e Verificada" : "Active & Verified") : (lang === "pt" ? "Ativa (Pendente KYC)" : "Active (KYC Pending)")}
                    badgeColor="emerald"
                  />

                  {/* Cliente desde */}
                  <InfoRow
                    icon={CalendarClock}
                    label={t("shell.customerSince")}
                    value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString("en-GB") : notProvided}
                  />
                </div>

                {/* Seção 3: Segurança e Configurações */}
                <div className="py-5 space-y-2 border-t border-border/60">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-foreground mb-3">
                    {t("shell.securityAndSettings")}
                  </h3>

                  {isAdmin && (
                    <Link
                      to="/admin"
                      onClick={() => setProfileOpen(false)}
                      className="w-full flex items-center justify-between px-3.5 py-3 text-sm rounded-xl hover:bg-secondary transition text-primary font-medium border border-border/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <Shield className="w-4 h-4 text-primary" />
                        <span>{t("shell.adminPanel")}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  )}

                  {(!isAdmin || adminLevel === "master") && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        setChangePasswordOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-3.5 py-3 text-sm rounded-xl hover:bg-secondary transition text-foreground border border-border/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <Key className="w-4 h-4 text-primary" />
                        <span>{t("shell.changePassword")}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  )}

                  <Link
                    to="/contact"
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm rounded-xl hover:bg-secondary transition text-foreground border border-border/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <HelpCircle className="w-4 h-4 text-primary" />
                      <span>{t("shell.supportCentre")}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>

                  <Link
                    to="/privacy"
                    onClick={() => setProfileOpen(false)}
                    className="w-full flex items-center justify-between px-3.5 py-3 text-sm rounded-xl hover:bg-secondary transition text-foreground border border-border/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-primary" />
                      <span>{t("shell.privacy")}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm rounded-xl hover:bg-destructive/10 transition text-destructive font-medium border border-destructive/20 mt-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t("conta.logout")}</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <nav className="mx-auto max-w-7xl px-6 relative">
          <ul className="flex items-end gap-2 overflow-visible">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const hasMenu = !!tab.menu;
              const isActive =
                tab.to === pathname ||
                (tab.labelKey === "conta.tab.digital" && (pathname === "/extrato" || pathname === "/standing-orders" || pathname === "/bloqueio-judicial" || pathname === "/fees-charges" || pathname === "/interest-statements")) ||
                (tab.labelKey === "conta.tab.transactions" && (pathname === "/transferencia" || pathname === "/pending-payments" || pathname === "/track-payment"));
              const inner = (
                <>
                  <Icon className="w-6 h-6" />
                  <span className="text-sm font-semibold">{t(tab.labelKey)}</span>
                  {isActive && <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-full bg-primary" />}
                  {hasMenu && !isActive && <span className="absolute bottom-0 left-1/4 right-1/4 h-[3px] rounded-full bg-primary opacity-0 group-hover/tab:opacity-100 transition" />}
                </>
              );
              const baseCls = `relative w-full flex flex-col items-center gap-1 py-4 transition ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
              } ${hasMenu ? "group-hover/tab:text-primary group-hover/tab:bg-background group-hover/tab:shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)] group-hover/tab:rounded-t-2xl" : ""}`;
              return (
                <li key={tab.labelKey} className="flex-1 min-w-[120px] group/tab relative">
                  {tab.to ? (
                    <Link to={tab.to} className={baseCls}>{inner}</Link>
                  ) : (
                    <button className={baseCls}>{inner}</button>
                  )}

                  {hasMenu && tab.menu && (
                    <div className="absolute left-0 top-full z-40 w-[420px] opacity-0 invisible translate-y-1 group-hover/tab:opacity-100 group-hover/tab:visible group-hover/tab:translate-y-0 transition-all duration-150">
                      <div className="bg-background rounded-b-2xl rounded-tr-2xl shadow-2xl border border-border/60 p-6 space-y-5">
                        {tab.menu.map((sec) => (
                          <div key={sec.sectionKey}>
                            <p className="text-base font-bold text-foreground mb-3">{t(sec.sectionKey)}</p>
                            <div className="grid grid-cols-3 gap-3">
                              {sec.items.map((it) => {
                                const ItIcon = it.icon;
                                const inner = (
                                  <>
                                    <span className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                      <ItIcon className="w-5 h-5" />
                                    </span>
                                    <span className="text-xs font-medium leading-tight text-foreground">{t(it.labelKey)}</span>
                                  </>
                                );
                                const cls = "flex flex-col items-center text-center gap-2 p-3 rounded-xl hover:bg-secondary/60 transition";
                                return it.to ? (
                                  <Link key={it.labelKey} to={it.to} search={it.search} className={cls}>{inner}</Link>
                                ) : (
                                  <button key={it.labelKey} className={cls}>{inner}</button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <div className={isSupportPage ? "flex-1 min-h-0 flex flex-col overflow-hidden" : ""}>
        <CustomerErrorBoundary route={pathname}>
          {children({
            user: user!,
            isAdmin,
            showBalance,
            setShowBalance,
            mask,
            balance,
            currency,
            accountNumber,
            iban,
            profile,
            loading: accountLoading || profileLoading,
            balanceUnavailable,
            refetchAccount,
          })}
        </CustomerErrorBoundary>
      </div>
      {!isSupportPage && <SiteFooter />}

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-background border-t border-border/60 h-16 grid grid-cols-4 select-none">
        {[
          { icon: Home, label: t("conta.tab.home"), to: "/conta", active: pathname === "/conta" },
          { icon: FileText, label: t("conta.action.extract"), to: "/extrato", active: pathname === "/extrato" },
          { icon: Send, label: t("conta.action.transfer"), to: "/transferencia", active: pathname === "/transferencia" || pathname === "/pending-payments" },
          { icon: HelpCircle, label: t("conta.help"), to: "/contact", active: pathname === "/contact" || pathname === "/help" },
        ].map((it, i) => {
          const Icon = it.icon;
          const active = it.active;
          const cls = `flex flex-col items-center justify-center gap-0.5 text-[10px] px-1 transition ${
            active ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
          }`;
          const inner = (
            <>
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-[64px]">{it.label}</span>
            </>
          );
          return (
            <Link key={i} to={it.to} className={cls}>
              {inner}
            </Link>
          );
        })}
      </nav>
      {isBlocked && <AccountBlockedOverlay />}
      {(!isAdmin || adminLevel === "master") && (
        <ChangePasswordModal open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />
      )}
      {!isSupportPage && <FloatingChatWidget />}
    </main>
  );
}

function CopyableRow({
  icon: Icon,
  label,
  value,
  onCopy,
  copied,
  copiedText = "Copiado!",
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  onCopy?: () => void;
  copied: boolean;
  copiedText?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1 select-text">
          <p className="text-xs text-muted-foreground select-none">{label}</p>
          <p className="text-sm font-mono font-medium break-words text-foreground mt-0.5 select-text" data-copyable="true">{value}</p>
        </div>
      </div>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition shrink-0 flex items-center gap-1 border border-transparent hover:border-border/60 select-none"
          title="Copiar"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[10px] font-semibold text-emerald-600">{copiedText}</span>
            </>
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  badge,
  badgeColor,
  extra,
  onAction,
  actionLabel,
  isMissing,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  badge?: string;
  badgeColor?: "emerald" | "default";
  extra?: ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  isMissing?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-xs text-muted-foreground">{label}</p>
            {badge && (
              <span
                className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.2 rounded-sm border ${
                  badgeColor === "emerald"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-secondary text-muted-foreground border-border/60"
                }`}
              >
                {badge}
              </span>
            )}
          </div>
          <p className={`text-sm font-medium break-words mt-0.5 ${isMissing ? "text-muted-foreground italic" : "text-foreground"}`}>
            {value}
          </p>
        </div>
      </div>
      {extra}
      {onAction && actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="text-xs font-semibold text-primary hover:underline hover:opacity-80 transition shrink-0"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
