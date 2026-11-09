import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Download, ChevronRight, Calendar, Printer, FileText, CheckCircle2,
  Landmark, Info, ShieldCheck, UserCheck, Hash, AlertTriangle
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AccountShell } from "@/components/AccountShell";
import { useTransactions, formatMoney, parseUkAccountCredentials, type Tx } from "@/lib/account";
import { BancoTesteLogo } from "@/components/BankLogo";

function InterestStatementsErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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

export const Route = createFileRoute("/interest-statements")({
  component: InterestStatementsPage,
  head: () => ({ meta: [{ title: "Interest Statements — Secure Portal" }] }),
  errorComponent: InterestStatementsErrorComponent,
});

type TaxYearId = "2025-2026" | "2024-2025" | "2023-2024";

interface TaxYearDefinition {
  id: TaxYearId;
  label: string;
  startDate: string;
  endDate: string;
}

const TAX_YEARS: TaxYearDefinition[] = [
  {
    id: "2025-2026",
    label: "Tax Year 2025/2026 (06 Apr 2025 – 05 Apr 2026)",
    startDate: "2025-04-06",
    endDate: "2026-04-05",
  },
  {
    id: "2024-2025",
    label: "Tax Year 2024/2025 (06 Apr 2024 – 05 Apr 2025)",
    startDate: "2024-04-06",
    endDate: "2025-04-05",
  },
  {
    id: "2023-2024",
    label: "Tax Year 2023/2024 (06 Apr 2023 – 05 Apr 2024)",
    startDate: "2023-04-06",
    endDate: "2024-04-05",
  },
];

export function InterestStatementsPage() {
  const { t, lang } = useI18n();
  const { txs, loading } = useTransactions();
  const [selectedYearId, setSelectedYearId] = useState<TaxYearId>("2025-2026");

  const currentYear = TAX_YEARS.find((y) => y.id === selectedYearId) ?? TAX_YEARS[0];

  // Filter transactions within the selected UK tax year that represent interest / earnings
  const interestTxs = useMemo(() => {
    const start = new Date(currentYear.startDate + "T00:00:00").getTime();
    const end = new Date(currentYear.endDate + "T23:59:59.999").getTime();

    return txs.filter((tx) => {
      const txTime = new Date(tx.created_at).getTime();
      if (txTime < start || txTime > end) return false;

      const desc = (tx.description || "").toLowerCase();
      const type = (tx.type || "").toLowerCase();

      return (
        type.includes("interest") ||
        type.includes("rendimento") ||
        desc.includes("interest") ||
        desc.includes("rendimento") ||
        desc.includes("yield") ||
        desc.includes("aer") ||
        desc.includes("dividend") ||
        desc.includes("juros")
      );
    });
  }, [txs, currentYear]);

  const grossInterest = useMemo(() => {
    return interestTxs.reduce((sum, tx) => sum + Math.max(0, Number(tx.amount)), 0);
  }, [interestTxs]);

  const taxDeducted = 0; // In the UK since 2016, banks pay interest gross without tax deducted at source
  const netInterest = grossInterest - taxDeducted;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <AccountShell>
      {({ profile, user, accountNumber, iban, currency }) => {
        const credentials = parseUkAccountCredentials(accountNumber, iban);
        const holderName = profile?.full_name || user?.email || "Account Holder";

        return (
          <div className="mx-auto max-w-7xl px-6 py-6">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 select-none print:hidden">
              <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.home")}</Link>
              <ChevronRight className="w-4 h-4" />
              <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.digital")}</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground font-medium">
                {lang === "pt" ? "Informe de Rendimentos" : "Interest Statements"}
              </span>
            </nav>

            <section className="bg-background border border-border/60 rounded-2xl shadow-sm p-7 space-y-8">
              {/* Header */}
              <div className="flex items-start justify-between gap-6 flex-wrap print:hidden">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight select-none">
                    {lang === "pt" ? "Informe de Rendimentos" : "Interest Statements"}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1 max-w-2xl select-none">
                    {lang === "pt"
                      ? "Apuração anual de rendimentos e juros creditados nesta conta."
                      : "Annual summary of interest credits applied to this account."}
                  </p>
                </div>

                <div className="flex items-center gap-3 select-none">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="h-10 px-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 hover:opacity-90 transition cursor-pointer shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    <span>{lang === "pt" ? "Imprimir Extrato (PDF)" : "Print Statement (PDF)"}</span>
                  </button>
                </div>
              </div>

              {/* Tax Year Selector */}
              <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60 flex items-center justify-between gap-4 flex-wrap select-none print:hidden">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    {lang === "pt" ? "Selecione o Ano Fiscal (UK Tax Year):" : "Select UK Tax Year:"}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {TAX_YEARS.map((y) => (
                    <button
                      key={y.id}
                      type="button"
                      onClick={() => setSelectedYearId(y.id)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                        selectedYearId === y.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-background border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {y.id.replace("-", "/")}
                    </button>
                  ))}
                </div>
              </div>

              {/* Statement Certificate Container */}
              <div className="p-8 sm:p-10 rounded-3xl border border-border/80 bg-card shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
                {/* Certificate Header with Logo */}
                <div className="flex items-start justify-between border-b border-border/60 pb-6 flex-wrap gap-4">
                  <div className="space-y-1">
                    <BancoTesteLogo className="h-8" />
                    <p className="text-xs text-muted-foreground pt-1">
                      B Bank S.A.
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      Statement Ref: BB-INT-{currentYear.id}
                    </span>
                    <p className="text-sm font-bold text-foreground mt-1">
                      {lang === "pt" ? "Informe Anual de Rendimentos" : "Annual Interest Statement"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Issue Date: {new Date().toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>

                {/* Account & Taxpayer Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-secondary/20 border border-border/50 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Account Holder</span>
                    <span className="font-bold text-foreground mt-0.5 block select-text">{holderName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Sort Code & Account</span>
                    <span className="font-mono font-bold text-foreground mt-0.5 block select-text">
                      {credentials.sortCode} · {credentials.accountNumber || "20000000"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Tax Period</span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {currentYear.id.replace("-", "/")}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Tax Residence</span>
                    <span className="font-semibold text-foreground mt-0.5 block">
                      {profile?.country || "United Kingdom"}
                    </span>
                  </div>
                </div>

                {/* Financial Summary Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                    {lang === "pt" ? "Resumo de Rendimentos no Período Fiscal" : "Interest Summary for Selected Tax Year"}
                  </h3>
                  <div className="rounded-2xl border border-border/60 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-secondary/40 text-muted-foreground border-b border-border/60 uppercase font-semibold text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3.5">Description</th>
                          <th className="p-3.5">Tax Period</th>
                          <th className="p-3.5 text-right">Gross Interest</th>
                          <th className="p-3.5 text-right">Tax Deducted</th>
                          <th className="p-3.5 text-right">Net Interest Paid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        <tr className="bg-card">
                          <td className="p-3.5 font-medium text-foreground">
                            B Bank Current & Savings Account
                          </td>
                          <td className="p-3.5 text-muted-foreground">
                            {currentYear.startDate} to {currentYear.endDate}
                          </td>
                          <td className="p-3.5 text-right font-semibold tabular-nums text-foreground select-text">
                            {formatMoney(grossInterest, currency)}
                          </td>
                          <td className="p-3.5 text-right font-medium tabular-nums text-muted-foreground select-text">
                            {formatMoney(taxDeducted, currency)}
                          </td>
                          <td className="p-3.5 text-right font-bold tabular-nums text-emerald-600 select-text">
                            {formatMoney(netInterest, currency)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Itemized Transactions or Notice */}
                {interestTxs.length === 0 ? (
                  <div className="p-5 rounded-2xl bg-secondary/15 border border-border/40 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs font-bold text-foreground">
                        {lang === "pt"
                          ? "Nenhum rendimento registrado para este período"
                          : "No interest recorded for this period"}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {lang === "pt"
                        ? "Não foram encontrados lançamentos de juros, remuneração de capital ou dividendos creditados nesta conta durante o período fiscal selecionado."
                        : "No interest payments, yield credits, or dividends were recorded in this account for the selected tax period."}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-foreground">
                      {lang === "pt" ? "Discriminação dos Lançamentos de Rendimentos" : "Itemised Interest Credits"}
                    </h4>
                    <div className="divide-y divide-border/40 border border-border/60 rounded-xl overflow-hidden">
                      {interestTxs.map((tx) => (
                        <div key={tx.id} className="p-3 flex items-center justify-between text-xs bg-card">
                          <div>
                            <span className="font-semibold text-foreground">{tx.description || tx.type}</span>
                            <span className="text-muted-foreground block text-[10px]">
                              {new Date(tx.created_at).toLocaleDateString("en-GB")} · Ref: {tx.id.slice(0, 8)}
                            </span>
                          </div>
                          <span className="font-bold tabular-nums text-emerald-600 select-text">
                            +{formatMoney(Number(tx.amount), currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Informational Guidance Notice */}
                <div className="p-5 rounded-2xl bg-secondary/30 border border-border/50 space-y-2 text-[11px] text-muted-foreground leading-relaxed select-none">
                  <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-primary" />
                    {lang === "pt" ? "Informações sobre Rendimentos e Regras Fiscais no Reino Unido" : "UK Savings Interest & HMRC Information"}
                  </h4>
                  <p>
                    {lang === "pt"
                      ? "No Reino Unido, os juros bancários são pagos brutos (sem retenção de 20% na fonte desde 2016). O enquadramento tributário depende da faixa de renda individual (Personal Savings Allowance) e deve ser declarado diretamente à autoridade tributária quando aplicável."
                      : "In the UK, savings interest has been paid gross (without 20% tax deducted at source) since April 2016. Tax liability depends on individual income tax bands and must be reported directly to tax authorities when applicable."}
                  </p>
                </div>
              </div>
            </section>
          </div>
        );
      }}
    </AccountShell>
  );
}
