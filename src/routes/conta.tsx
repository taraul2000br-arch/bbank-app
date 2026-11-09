import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronRight, Eye, EyeOff, Shield, Search, Clock, X,
  Smartphone, Send, Receipt, Wallet, FileText,
  CalendarDays, HelpCircle, BadgeCheck, AlertTriangle,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AccountShell } from "@/components/AccountShell";
import { useTransactions, formatMoney, usePendingTransfers } from "@/lib/account";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TransferReceiptModal } from "@/components/TransferReceiptModal";

function ContaErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center p-8 bg-card rounded-2xl border border-border shadow-sm">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          Não foi possível carregar esta página.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          Encontramos um problema temporário. Tente novamente ou volte para sua conta.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            Tentar novamente
          </button>
          <Link
            to="/conta"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full border border-border bg-secondary px-5 py-2.5 text-sm font-semibold text-foreground hover:bg-secondary/80 transition"
          >
            Voltar para minha conta
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/conta")({
  component: ContaPage,
  head: () => ({ meta: [{ title: "My account — Secure Portal" }] }),
  errorComponent: ContaErrorComponent,
});

function getGreeting(t: (k: string) => string) {
  const hour = new Date().getHours();
  if (hour < 12) return t("conta.greeting.morning");
  if (hour < 18) return t("conta.greeting.afternoon");
  return t("conta.greeting.evening");
}

function TransactionSkeleton() {
  return (
    <div className="space-y-4 py-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-secondary/80 shrink-0" />
          <div className="flex-1 space-y-2 min-w-0">
            <div className="h-4 bg-secondary/80 rounded w-1/3" />
            <div className="h-3 bg-secondary/60 rounded w-1/2" />
          </div>
          <div className="h-4 bg-secondary/80 rounded w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function EmptyTransactions({ lang, t }: { lang: string; t: (k: string) => string }) {
  return (
    <div className="text-center py-12 border-t border-border/40">
      <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
        <Wallet className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-foreground">
        {t("conta.empty.title")}
      </p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {t("conta.empty.desc")}
      </p>
      <div className="mt-5">
        <Link
          to="/transferencia"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-sm"
        >
          <Send className="w-4 h-4" />
          <span>{lang === "pt" ? "Fazer uma transferência" : "Make a transfer"}</span>
        </Link>
      </div>
    </div>
  );
}

function ContaPage() {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<"todas" | "entradas" | "saidas">("todas");
  const { txs, loading: txsLoading, isError: txsError, refetch: refetchTxs } = useTransactions();
  const pending = usePendingTransfers();
  const pendingTotal = pending.reduce((s, r) => s + Number(r.amount), 0);
  const [receiptTransferId, setReceiptTransferId] = useState<string | null>(null);
  const [detail, setDetail] = useState<null | {
    id: string;
    isIn: boolean;
    amount: number;
    type: string;
    description: string | null;
    created_at: string;
    pending?: boolean;
    cancelled?: boolean;
    reason?: string | null;
    transferId?: string;
  }>(null);

  return (
    <AccountShell>
      {({ user, isAdmin, showBalance, setShowBalance, mask, balance, currency, profile, balanceUnavailable, refetchAccount }) => {
        const isMaster = isAdmin;
        const balanceLabel = balanceUnavailable
          ? t("conta.balanceUnavailable")
          : formatMoney(balance, currency);
        const clientName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Customer";

        type Item = {
          id: string;
          isIn: boolean;
          amount: number;
          type: string;
          description: string | null;
          created_at: string;
          pending?: boolean;
          cancelled?: boolean;
          reason?: string | null;
          transferId?: string;
        };
        const CANCEL_TAG = "[CANCELADA]";
        const pendingItems: Item[] = pending.map((p) => ({
          id: `pending-${p.id}`,
          isIn: false,
          amount: Number(p.amount),
          type: t("tx.internationalTransfer"),
          description: `Para ${p.beneficiary_name ?? ""} (${p.to_country ?? ""}) — ${p.reference ?? p.purpose ?? ""}${p.protocol ? ` (${p.protocol})` : ""}`,
          created_at: p.created_at,
          pending: true,
          transferId: p.id,
        }));

        // Collect all protocols of active pending transfers to suppress duplicate raw audit entries
        const pendingProtocols = new Set(
          pending.map((p) => p.protocol?.trim()).filter(Boolean) as string[],
        );

        const txItems: Item[] = txs
          .filter((tx) => {
            // Deduplicate: if an audit row in transactions corresponds to an active pending transfer,
            // the pending item already represents it in the statement list.
            if (tx.description && pendingProtocols.size > 0) {
              for (const proto of pendingProtocols) {
                if (tx.description.includes(proto)) return false;
              }
            }
            return true;
          })
          .map((tx) => {
            const raw = tx.description ?? "";
            const cancelled = raw.startsWith(CANCEL_TAG);
            const description = cancelled ? raw.slice(CANCEL_TAG.length).trim() : raw;
            let reason: string | null = null;
            if (cancelled) {
              const m = description.match(/Motivo:\s*(.+)$/i);
              if (m) reason = m[1].trim();
            }
            const isIntlTransfer = tx.type === "saida" && raw.toLowerCase().includes("international transfer");
            return {
              id: tx.id,
              isIn: tx.type === "entrada",
              amount: Number(tx.amount),
              type: isIntlTransfer ? t("tx.internationalTransfer") : tx.type,
              description,
              created_at: tx.created_at,
              cancelled,
              reason,
            };
          });
        const allItems = [...pendingItems, ...txItems].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        const filtered = allItems.filter((it) => {
          if (filter === "entradas") return it.isIn;
          if (filter === "saidas") return !it.isIn;
          return true;
        });

        return (
          <>
            {/* ============ MOBILE DASHBOARD ============ */}
            <div className="md:hidden px-4 pt-4 pb-6 space-y-5">
              {/* Client Greeting Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{getGreeting(t)}</p>
                  <h1 className="text-xl font-bold text-foreground truncate max-w-[220px]">{clientName}</h1>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  {t("conta.verified")}
                </span>
              </div>

              {/* Balance Box */}
              <div className="bg-background rounded-2xl border border-border/60 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{t("conta.balance")}</p>
                    {balanceUnavailable ? (
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xl font-bold tracking-tight text-amber-600">
                          {t("conta.balanceUnavailable")}
                        </p>
                        {refetchAccount && (
                          <button
                            type="button"
                            onClick={() => refetchAccount()}
                            className="text-xs text-primary underline hover:opacity-80"
                          >
                            {t("conta.retry")}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-3xl font-bold tracking-tight tabular-nums mt-0.5">{mask(balanceLabel)}</p>
                    )}
                    {pendingTotal > 0 && !balanceUnavailable && (
                      <p className="text-xs text-amber-600 font-medium mt-1">
                        {mask(formatMoney(pendingTotal, currency))} em liquidação
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setShowBalance((v) => !v)}
                    className="p-2 text-muted-foreground hover:text-foreground"
                    title={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
                    aria-label={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
                  >
                    {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Quick Action Pill Buttons */}
              <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none] select-none">
                {[
                  { label: t("conta.action.transfer"), to: "/transferencia", icon: Send },
                  { label: t("conta.action.extract"), to: "/extrato", icon: FileText },
                  { label: t("conta.shortcuts.standing"), to: "/standing-orders", icon: CalendarDays },
                  { label: t("conta.shortcuts.pending"), to: "/pending-payments", icon: Clock },
                  { label: t("conta.shortcuts.support"), to: "/contact", icon: HelpCircle },
                ].map((p) => {
                  const Icon = p.icon;
                  return (
                    <Link
                      key={p.label}
                      to={p.to}
                      className="snap-start shrink-0 h-10 px-4 rounded-full bg-primary/10 text-primary font-semibold text-xs flex items-center gap-2 hover:bg-primary/20 transition select-none"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{p.label}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Horizontal Scroll Quick Cards */}
              <div className="relative -mx-4 select-none">
                <div className="flex gap-3 overflow-x-auto px-4 pt-2 pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none] select-none">
                  {[
                    { label: t("conta.action.transfer"), icon: Send, to: "/transferencia", tag: t("conta.tag.fast") },
                    { label: t("conta.action.extract"), icon: FileText, to: "/extrato" },
                    { label: t("conta.shortcuts.standing"), icon: CalendarDays, to: "/standing-orders" },
                    { label: t("conta.shortcuts.pending"), icon: Clock, to: "/pending-payments" },
                    { label: t("conta.shortcuts.support"), icon: HelpCircle, to: "/contact" },
                  ].map((it) => {
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.label}
                        to={it.to}
                        className="snap-start relative shrink-0 w-32 h-32 rounded-2xl bg-background border border-border/60 p-4 flex flex-col justify-end text-left shadow-sm hover:border-primary/40 transition select-none"
                      >
                        {it.tag && (
                          <span className="absolute -top-2 left-3 text-[10px] font-bold uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded shadow-sm select-none">
                            {it.tag}
                          </span>
                        )}
                        <Icon className="w-6 h-6 text-foreground mb-3" />
                        <span className="text-sm font-medium leading-tight">{it.label}</span>
                      </Link>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
              </div>

              {isMaster && (
                <Link
                  to="/admin"
                  className="block rounded-2xl p-5 text-white shadow-lg select-none"
                  style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)" }}
                >
                  <div className="flex items-center gap-3 select-none">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1 select-none">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">{t("admin.master")}</p>
                      <p className="text-base font-bold">Painel de Controle</p>
                    </div>
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </Link>
              )}

              {/* Transactions List */}
              <div className="bg-background rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                <Link to="/extrato" className="flex items-center justify-between px-5 py-4 border-b border-border/60 hover:bg-secondary/40 transition">
                  <h2 className="text-base font-semibold">{t("conta.extract")}</h2>
                  <ChevronRight className="w-5 h-5 text-primary" />
                </Link>

                <div className="px-4 py-3 flex gap-2">
                  {(["todas", "entradas", "saidas"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`flex-1 h-9 rounded-full text-xs font-semibold transition ${
                        filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      {f === "todas" ? t("conta.filter.all") : f === "entradas" ? t("conta.filter.in") : t("conta.filter.out")}
                    </button>
                  ))}
                </div>

                <div className="px-4 pb-4">
                  {txsLoading ? (
                    <TransactionSkeleton />
                  ) : txsError ? (
                    <div className="text-center py-8 px-4 border-t border-border/40">
                      <p className="text-sm text-amber-600 font-medium mb-2">{t("conta.errorLoadingTx")}</p>
                      {refetchTxs && (
                        <button
                          type="button"
                          onClick={() => refetchTxs()}
                          className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                        >
                          {t("conta.retry")}
                        </button>
                      )}
                    </div>
                  ) : filtered.length === 0 ? (
                    <EmptyTransactions lang={lang} t={t} />
                  ) : (
                    filtered.slice(0, 6).map((tx) => {
                      const isIn = tx.isIn;
                      return (
                        <button
                          key={tx.id}
                          type="button"
                          onClick={() => setDetail(tx)}
                          className="w-full flex items-center gap-3 py-3 border-t border-border/40 first:border-t-0 text-left hover:bg-secondary/40 transition"
                        >
                          <span className={`w-9 h-9 rounded-full flex items-center justify-center text-sm ${
                            tx.cancelled
                              ? "bg-muted text-muted-foreground border border-border"
                              : tx.pending
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-secondary text-muted-foreground"
                          }`}>
                            {tx.pending ? <Clock className="w-4 h-4" /> : tx.cancelled ? <X className="w-4 h-4" /> : isIn ? "↓" : "↑"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-muted-foreground truncate">{tx.description ?? tx.type}</p>
                              {tx.pending && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">{t("status.pending")}</span>
                              )}
                              {tx.cancelled && (
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 border border-rose-300 bg-rose-50 px-1.5 py-0.5 rounded-sm">{t("status.cancelled")}</span>
                              )}
                            </div>
                            <p className={`text-sm font-semibold tabular-nums ${
                              tx.cancelled
                                ? "text-muted-foreground line-through"
                                : tx.pending
                                ? "text-amber-500 font-semibold"
                                : isIn
                                ? "text-emerald-600"
                                : "text-foreground"
                            }`}>
                              {mask((isIn ? "" : "-") + formatMoney(Math.abs(tx.amount), currency))}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-primary" />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ============ DESKTOP DASHBOARD ============ */}
            <div className="hidden md:block mx-auto max-w-7xl px-6 py-8 space-y-6">
              {/* Account Credentials & Personalised Greeting Banner */}
              <section className="bg-background rounded-2xl border border-border/60 shadow-sm p-6">
                <div className="pb-5 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider font-semibold text-primary">
                      B Bank Current Account
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      {t("conta.verified")}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-foreground mt-1">
                    {getGreeting(t)}, {clientName}
                  </h1>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("conta.details.demoDesc")}
                  </p>
                </div>

                {/* Reorganized Balance Card */}
                <div className="pt-5">
                  <div className="p-5 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("conta.accBalance")}</p>
                      <div className="flex flex-wrap items-baseline gap-3 mt-1.5">
                        {balanceUnavailable ? (
                          <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-amber-600">
                              {t("conta.balanceUnavailable")}
                            </span>
                            {refetchAccount && (
                              <button
                                type="button"
                                onClick={() => refetchAccount()}
                                className="text-xs px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition"
                              >
                                {t("conta.retry")}
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-3xl lg:text-4xl font-bold text-foreground tabular-nums tracking-tight">
                            {mask(balanceLabel)}
                          </p>
                        )}
                        {pendingTotal > 0 && !balanceUnavailable && (
                          <span className="text-xs text-amber-600 font-medium bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                            {mask(formatMoney(pendingTotal, currency))} em liquidação
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowBalance((v) => !v)}
                      className="p-3 rounded-xl hover:bg-secondary text-muted-foreground hover:text-primary transition border border-transparent hover:border-border/60"
                      title={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
                      aria-label={showBalance ? "Ocultar saldo" : "Mostrar saldo"}
                    >
                      {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Quick functional shortcuts bar */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-5 border-t border-border/60 mt-5 select-none">
                  <Link
                    to="/transferencia"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary font-semibold text-xs transition select-none"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t("conta.shortcuts.transfer")}</span>
                  </Link>
                  <Link
                    to="/extrato"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition border border-border/60 select-none"
                  >
                    <FileText className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">{t("conta.shortcuts.statement")}</span>
                  </Link>
                  <Link
                    to="/standing-orders"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition border border-border/60 select-none"
                  >
                    <CalendarDays className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">{t("conta.shortcuts.standing")}</span>
                  </Link>
                  <Link
                    to="/pending-payments"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition border border-border/60 select-none"
                  >
                    <Clock className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">{t("conta.shortcuts.pending")}</span>
                  </Link>
                  <Link
                    to="/contact"
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition border border-border/60 select-none"
                  >
                    <HelpCircle className="w-4 h-4 shrink-0 text-primary" />
                    <span className="truncate">{t("conta.shortcuts.support")}</span>
                  </Link>
                </div>
              </section>

              {/* Main Desktop Grid */}
              <div className="grid lg:grid-cols-[1fr_440px] gap-6">
                {/* Left: Statement & Transactions */}
                <section className="bg-background rounded-2xl border border-border/60 shadow-sm overflow-hidden">
                  <Link to="/extrato" className="w-full flex items-center justify-between px-7 py-5 border-b border-border/60 hover:bg-secondary/40 transition">
                    <h2 className="text-xl font-semibold">{t("conta.extract")}</h2>
                    <ChevronRight className="w-5 h-5 text-primary" />
                  </Link>

                  <div className="px-7 py-6 space-y-6">
                    <div className="grid grid-cols-2 gap-8 items-end">
                      <div>
                        <p className="text-sm text-muted-foreground">{t("conta.accBalance")}</p>
                        <p className="text-2xl font-semibold tracking-normal tabular-nums mt-1">
                          {balanceUnavailable ? (
                            <span className="text-amber-600 font-medium text-base">{t("conta.balanceUnavailable")}</span>
                          ) : (
                            mask(balanceLabel)
                          )}
                        </p>
                      </div>
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{t("conta.processing")}</p>
                          <p className="text-2xl font-semibold tracking-normal tabular-nums mt-1">
                            {balanceUnavailable ? "—" : mask(formatMoney(pendingTotal, currency))}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowBalance((v) => !v)}
                          className="text-primary hover:opacity-80 pb-1"
                        >
                          {showBalance ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {(["todas", "entradas", "saidas"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilter(f)}
                          className={`h-12 rounded-full border text-sm font-medium transition ${
                            filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-foreground hover:bg-secondary"
                          }`}
                        >
                          {f === "todas" ? t("conta.filter.all") : f === "entradas" ? t("conta.filter.in") : t("conta.filter.out")}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="px-7 pb-8 min-h-[200px]">
                    {txsLoading ? (
                      <TransactionSkeleton />
                    ) : txsError ? (
                      <div className="text-center py-12 px-4 border-t border-border/40">
                        <p className="text-sm text-amber-600 font-medium mb-3">{t("conta.errorLoadingTx")}</p>
                        {refetchTxs && (
                          <button
                            type="button"
                            onClick={() => refetchTxs()}
                            className="px-5 py-2 rounded-full bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
                          >
                            {t("conta.retry")}
                          </button>
                        )}
                      </div>
                    ) : filtered.length === 0 ? (
                      <EmptyTransactions lang={lang} t={t} />
                    ) : (
                      filtered.map((tx) => {
                        const isIn = tx.isIn;
                        return (
                          <button
                            key={tx.id}
                            type="button"
                            onClick={() => setDetail(tx)}
                            className="w-full flex items-center gap-4 py-4 border-t border-border/40 hover:bg-secondary/40 transition text-left"
                          >
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              tx.cancelled
                                ? "bg-muted text-muted-foreground border border-border"
                                : tx.pending
                                ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                : "bg-secondary text-muted-foreground"
                            }`}>
                              {tx.pending ? <Clock className="w-4 h-4" /> : tx.cancelled ? <X className="w-4 h-4" /> : isIn ? "↓" : "↑"}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold truncate">{tx.type}</p>
                                {tx.pending && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500 border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 rounded-sm">{t("status.pending")}</span>
                                )}
                                {tx.cancelled && (
                                  <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-700 border border-rose-300 bg-rose-50 px-2 py-0.5 rounded-sm">{t("status.cancelled")}</span>
                                )}
                              </div>
                              <p className={`text-base font-semibold tabular-nums ${
                                tx.cancelled
                                  ? "text-muted-foreground line-through"
                                  : tx.pending
                                  ? "text-amber-500 font-semibold"
                                  : isIn
                                  ? "text-emerald-600"
                                  : "text-foreground"
                              }`}>
                                {mask((isIn ? "" : "-") + formatMoney(Math.abs(tx.amount), currency))}
                              </p>
                              <p className="text-sm text-muted-foreground truncate">{tx.description ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString("en-GB")}{tx.pending ? ` · ${t("status.awaitingApproval")}` : tx.cancelled && tx.reason ? ` · ${t("status.reason")}: ${tx.reason}` : ""}</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-primary shrink-0" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                {/* Right: Master Admin, Cards promo, Heritage & Security */}
                <aside className="space-y-6">
                  {isMaster && (
                    <Link
                      to="/admin"
                      className="group relative block overflow-hidden rounded-2xl p-6 text-white shadow-xl transition hover:scale-[1.01] select-none"
                      style={{ background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)" }}
                    >
                      <div className="absolute inset-0 opacity-20" style={{ background: "radial-gradient(circle at 80% 20%, #4f46e5 0%, transparent 50%)" }} />
                      <div className="absolute top-4 right-4 flex items-center gap-1.5 select-none">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-semibold">{t("admin.online")}</span>
                      </div>

                      <div className="relative flex items-center gap-4 mb-5 select-none">
                        <div className="w-14 h-14 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
                          <Shield className="w-7 h-7" />
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/60 font-semibold">{t("admin.master")}</p>
                          <p className="text-xl font-bold tracking-tight">{t("admin.controlPanel")}</p>
                        </div>
                      </div>

                      <p className="relative text-sm text-white/70 mb-5 leading-relaxed select-none">
                        {t("admin.controlDesc")}
                      </p>

                      <div className="relative grid grid-cols-3 gap-2 mb-5 select-none">
                        {[t("admin.users"), t("admin.accounts"), t("admin.transactions")].map((label) => (
                          <div key={label} className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-center">
                            <p className="text-[10px] text-white/50 uppercase tracking-wider">{label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="relative flex items-center justify-between pt-4 border-t border-white/10 select-none">
                        <span className="text-sm font-semibold">{t("admin.access")}</span>
                        <div className="flex items-center gap-2 text-sm font-medium text-white/80 group-hover:text-white transition">
                          <span>{t("admin.enter")}</span>
                          <ChevronRight className="w-4 h-4 transition group-hover:translate-x-1" />
                        </div>
                      </div>
                    </Link>
                  )}

                  <div
                    className="relative overflow-hidden rounded-2xl p-7 min-h-[240px] flex flex-col justify-between text-white promo-card select-none"
                    style={{ background: "linear-gradient(140deg, #0a0a0a 0%, #1a1a2e 60%, #0f1b3d 100%)" }}
                    data-promo="true"
                  >
                    <div
                      className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
                      style={{ background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)" }}
                    />
                    <div className="relative select-none">
                      <p className="text-[10px] font-bold tracking-[0.25em] text-amber-400/90 uppercase">{t("heritage.eyebrow")}</p>
                      <h3 className="text-2xl font-bold leading-tight mt-3">
                        {t("heritage.title1")}<br />{t("heritage.title2")}
                        <br /><span className="text-amber-400">{t("heritage.title3")}</span>
                      </h3>
                    </div>
                    <div className="relative grid grid-cols-3 gap-2 pt-5 border-t border-white/10 select-none">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">{t("heritage.security")}</p>
                        <p className="text-sm font-semibold mt-0.5">256-bit</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">{t("heritage.guarantee")}</p>
                        <p className="text-sm font-semibold mt-0.5" title="Direct Ledger Custody">100%</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-white/40">{t("heritage.support")}</p>
                        <p className="text-sm font-semibold mt-0.5">24/7 UK</p>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            {/* Transaction Detail Dialog */}
            <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
              <DialogContent className="max-w-md">
                {detail && (() => {
                  const sign = detail.isIn ? "+" : "-";
                  const amountLabel = mask(sign + formatMoney(Math.abs(detail.amount), currency));
                  const dt = new Date(detail.created_at);
                  const status = detail.cancelled ? t("status.cancelled") : detail.pending ? t("status.pending") : t("status.completed");
                  const statusClass = detail.cancelled
                    ? "text-rose-700 border-rose-300 bg-rose-50"
                    : detail.pending
                    ? "text-muted-foreground border-border bg-muted"
                    : "text-emerald-700 border-emerald-300 bg-emerald-50";
                  return (
                    <>
                      <DialogHeader>
                        <DialogTitle className="capitalize">{detail.type}</DialogTitle>
                        <DialogDescription>{t("tx.details")}</DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-4">
                          <div>
                            <p className="text-xs text-muted-foreground">{t("tx.amount")}</p>
                            <p className={`text-2xl font-semibold tabular-nums ${detail.cancelled ? "line-through text-muted-foreground" : detail.isIn ? "text-emerald-600" : "text-foreground"}`}>{amountLabel}</p>
                          </div>
                          <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-1 rounded-sm ${statusClass}`}>{status}</span>
                        </div>

                        <dl className="text-sm divide-y divide-border/60 rounded-xl border border-border/60">
                          <div className="flex justify-between gap-4 px-4 py-3">
                            <dt className="text-muted-foreground">{t("tx.type")}</dt>
                            <dd className="font-medium capitalize text-right">{detail.isIn ? t("tx.entry") : t("tx.exit")}</dd>
                          </div>
                          <div className="flex justify-between gap-4 px-4 py-3">
                            <dt className="text-muted-foreground">{t("tx.category")}</dt>
                            <dd className="font-medium capitalize text-right">{detail.type}</dd>
                          </div>
                          <div className="flex justify-between gap-4 px-4 py-3">
                            <dt className="text-muted-foreground">{t("tx.date")}</dt>
                            <dd className="font-medium text-right">{dt.toLocaleDateString("en-GB")}</dd>
                          </div>
                          <div className="flex justify-between gap-4 px-4 py-3">
                            <dt className="text-muted-foreground">{t("tx.time")}</dt>
                            <dd className="font-medium text-right">{dt.toLocaleTimeString("en-GB")}</dd>
                          </div>
                          <div className="flex justify-between gap-4 px-4 py-3">
                            <dt className="text-muted-foreground">{t("tx.id")}</dt>
                            <dd className="font-mono text-xs text-right break-all">{detail.id}</dd>
                          </div>
                          {detail.description && (
                            <div className="px-4 py-3">
                              <dt className="text-muted-foreground mb-1">{t("tx.description")}</dt>
                              <dd className="font-medium whitespace-pre-wrap break-words">{detail.description}</dd>
                            </div>
                          )}
                          {detail.cancelled && detail.reason && (
                            <div className="px-4 py-3 bg-rose-50/50">
                              <dt className="text-rose-700 text-xs uppercase tracking-wider font-semibold mb-1">{t("tx.cancelReason")}</dt>
                              <dd className="font-medium text-rose-900 whitespace-pre-wrap break-words">{detail.reason}</dd>
                            </div>
                          )}
                          {detail.pending && (
                            <div className="px-4 py-3">
                              <dd className="text-xs text-muted-foreground">{t("status.awaitingTeamApproval")}</dd>
                            </div>
                          )}
                        </dl>

                        {detail.transferId && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={() => setReceiptTransferId(detail.transferId!)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition"
                            >
                              <FileText className="w-4 h-4" />
                              <span>{lang === "pt" ? "Ver comprovante da transferência" : "View transfer receipt"}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </DialogContent>
            </Dialog>

            <TransferReceiptModal
              open={!!receiptTransferId}
              onClose={() => setReceiptTransferId(null)}
              transferId={receiptTransferId}
            />
          </>
        );
      }}
    </AccountShell>
  );
}
