import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Receipt, ChevronRight, Calendar, Filter, Printer, CheckCircle2,
  HelpCircle, Info, Landmark, ArrowDownLeft, ArrowUpRight, AlertTriangle
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AccountShell } from "@/components/AccountShell";
import { useTransactions, formatMoney, type Tx } from "@/lib/account";

function FeesChargesErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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

export const Route = createFileRoute("/fees-charges")({
  component: FeesChargesPage,
  head: () => ({ meta: [{ title: "Fees & Charges Statement — Secure Portal" }] }),
  errorComponent: FeesChargesErrorComponent,
});

type PeriodFilter = "all" | "current-month" | "30d" | "90d";

export function FeesChargesPage() {
  const { t, lang } = useI18n();
  const { txs, loading } = useTransactions();
  const [period, setPeriod] = useState<PeriodFilter>("all");

  // Filter only real fee transactions
  const feeTxs = useMemo(() => {
    return txs.filter((tx) => {
      const desc = (tx.description || "").toLowerCase();
      const type = (tx.type || "").toLowerCase();
      const isFee =
        type === "fee" ||
        type === "tarifa" ||
        desc.includes("fee") ||
        desc.includes("tarifa") ||
        desc.includes("charge") ||
        desc.includes("iof") ||
        desc.includes("spread") ||
        desc.includes("swift fee") ||
        desc.includes("comiss") ||
        desc.includes("manuten");

      if (!isFee) return false;

      const txDate = new Date(tx.created_at);
      const now = new Date();

      if (period === "current-month") {
        return (
          txDate.getMonth() === now.getMonth() &&
          txDate.getFullYear() === now.getFullYear()
        );
      }
      if (period === "30d") {
        return txDate.getTime() >= now.getTime() - 30 * 24 * 60 * 60 * 1000;
      }
      if (period === "90d") {
        return txDate.getTime() >= now.getTime() - 90 * 24 * 60 * 60 * 1000;
      }
      return true;
    });
  }, [txs, period]);

  const totalFees = useMemo(() => {
    return feeTxs.reduce((sum, tx) => sum + Math.abs(Number(tx.amount)), 0);
  }, [feeTxs]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <AccountShell>
      {({ currency, mask }) => (
        <div className="mx-auto max-w-7xl px-6 py-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 select-none print:hidden">
            <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.home")}</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.digital")}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">
              {lang === "pt" ? "Extrato de Tarifação" : "Fees & Charges"}
            </span>
          </nav>

          <section className="bg-background border border-border/60 rounded-2xl shadow-sm p-7 space-y-7">
            {/* Header */}
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold tracking-tight select-none">
                  {lang === "pt" ? "Extrato de Tarifação & Encargos" : "Fees & Charges Statement"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl select-none">
                  {lang === "pt"
                    ? "Detalhamento de tarifas bancárias, custos de manutenção, câmbio e remessas internacionais cobrados nesta conta corrente."
                    : "Detailed breakdown of bank fees, maintenance charges, FX margins, and international transfer costs debited from this account."}
                </p>
              </div>

              <div className="flex items-center gap-2 select-none print:hidden">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="h-10 px-4 rounded-full border border-border text-xs font-semibold flex items-center gap-2 hover:bg-secondary transition cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-primary" />
                  <span>{lang === "pt" ? "Imprimir extrato" : "Print statement"}</span>
                </button>
              </div>
            </div>

            {/* Overview Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 select-none">
              <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  {lang === "pt" ? "Total de Tarifas no Período" : "Total Fees in Period"}
                </span>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatMoney(totalFees, currency)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {feeTxs.length} {lang === "pt" ? "tarifas registradas" : "fee charges logged"}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  {lang === "pt" ? "Tarifa Mensal de Manutenção" : "Monthly Account Maintenance"}
                </span>
                <p className="text-2xl font-bold tabular-nums text-emerald-600">
                  £0.00 <span className="text-xs font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "pt" ? "Pacote Padrão B Bank isento" : "B Bank Standard Current Account"}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                  {lang === "pt" ? "Transparência Institucional" : "Fee Transparency"}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-foreground">Standard Governance</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {lang === "pt" ? "Tarifação clara sem custos ocultos" : "Transparent fee schedule"}
                </p>
              </div>
            </div>

            {/* Period Filter Tabs */}
            <div className="flex items-center justify-between gap-4 flex-wrap pt-2 border-t border-border/60 print:hidden select-none">
              <div className="flex items-center gap-1.5 bg-secondary/80 p-1 rounded-full border border-border">
                {[
                  { id: "all", label: lang === "pt" ? "Todo o histórico" : "All time" },
                  { id: "current-month", label: lang === "pt" ? "Mês atual" : "Current month" },
                  { id: "30d", label: lang === "pt" ? "Últimos 30 dias" : "Last 30 days" },
                  { id: "90d", label: lang === "pt" ? "Últimos 90 dias" : "Last 90 days" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPeriod(item.id as PeriodFilter)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer select-none ${
                      period === item.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-muted-foreground">
                {feeTxs.length} {lang === "pt" ? "lançamento(s) localizado(s)" : "record(s) found"}
              </span>
            </div>

            {/* Table or Empty State */}
            {loading ? (
              <div className="py-20 text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-muted-foreground">{lang === "pt" ? "Carregando tarifas…" : "Loading fee records…"}</p>
              </div>
            ) : feeTxs.length === 0 ? (
              <div className="py-16 text-center border rounded-2xl border-dashed border-border/70 bg-secondary/10">
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3 text-muted-foreground select-none">
                  <Receipt className="w-6 h-6 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground select-none">
                  {lang === "pt" ? "Nenhuma tarifa registrada neste período" : "No fee charges recorded in this period"}
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto select-none">
                  {lang === "pt"
                    ? "Sua conta corrente B Bank opera com isenção total de mensalidade. Nenhuma tarifa avulsa ou custo oculto foi cobrado no período selecionado."
                    : "Your B Bank account operates with zero monthly maintenance fees. No individual charges or hidden fees were incurred during the selected period."}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
                {feeTxs.map((tx) => (
                  <div key={tx.id} className="p-4 flex items-center justify-between gap-4 flex-wrap bg-card hover:bg-secondary/20 transition">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-foreground select-text">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground select-text">
                        Ref: <span className="font-mono">{tx.id.slice(0, 8)}…{tx.id.slice(-6)}</span> · {new Date(tx.created_at).toLocaleString("en-GB")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground select-text">
                        {formatMoney(Math.abs(Number(tx.amount)), currency)}
                      </p>
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Debited</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Informational regulatory note */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 flex items-start gap-3 text-xs text-muted-foreground select-none">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {lang === "pt"
                  ? "As informações deste extrato atendem às melhores práticas e diretrizes institucionais de transparência de custos bancários. Tarifas de câmbio são discriminadas no momento da contratação da remessa."
                  : "This fee statement is compiled in alignment with transparent banking standards. FX margins and transfer fees are clearly itemised upon confirmation of international transactions."}
              </p>
            </div>
          </section>
        </div>
      )}
    </AccountShell>
  );
}
