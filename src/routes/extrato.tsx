import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  Search, ChevronRight, FileDown, Calendar, Tag, ListFilter,
  FileText, Landmark, Clock, CheckCircle2, XCircle, ShieldAlert,
  Copy, Check, X, ArrowUpRight, ArrowDownLeft, RotateCcw, Filter,
  ExternalLink, Layers, AlertTriangle,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { AccountShell } from "@/components/AccountShell";
import { useTransactions, formatMoney, parseUkAccountCredentials, type Tx } from "@/lib/account";
import { getTxSignedAmount, type StatementData } from "@/lib/pdf-statement";
import { listMyTransfers, type TransferRow, type TransferStatus } from "@/lib/transfers.functions";
import { TransferReceiptModal } from "@/components/TransferReceiptModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function ExtratoErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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

export const Route = createFileRoute("/extrato")({
  validateSearch: (search: Record<string, unknown>): { tab?: "statement" | "receipts" } => ({
    tab: search?.tab === "receipts" ? "receipts" : undefined,
  }),
  component: ExtratoPage,
  head: () => ({ meta: [{ title: "Statement & Receipts — Secure Portal" }] }),
  errorComponent: ExtratoErrorComponent,
});

type CategoryType = "all" | "transfers" | "deposits" | "fx" | "fees" | "cards" | "other";
type PeriodType = "all" | "7d" | "15d" | "30d" | "90d" | "custom";
type TxDirectionType = "all" | "in" | "out";

function classifyCategory(tx: Tx): "transfers" | "deposits" | "fx" | "fees" | "cards" | "other" {
  const desc = (tx.description || "").toLowerCase();
  const type = (tx.type || "").toLowerCase();
  if (
    desc.includes("fee") ||
    desc.includes("tarifa") ||
    desc.includes("iof") ||
    desc.includes("spread") ||
    desc.includes("charge") ||
    desc.includes("tax") ||
    desc.includes("swift fee")
  ) {
    return "fees";
  }
  if (
    desc.includes("câmbio") ||
    desc.includes("cambio") ||
    desc.includes("fx") ||
    desc.includes("conversion") ||
    desc.includes("conversão") ||
    desc.includes("usd") ||
    desc.includes("eur")
  ) {
    return "fx";
  }
  if (
    desc.includes("transfer") ||
    desc.includes("remessa") ||
    desc.includes("envio") ||
    desc.includes("ted") ||
    desc.includes("pix") ||
    desc.includes("faster payments") ||
    type.includes("transfer")
  ) {
    return "transfers";
  }
  if (
    desc.includes("cartão") ||
    desc.includes("cartao") ||
    desc.includes("card") ||
    desc.includes("compra") ||
    desc.includes("pos") ||
    desc.includes("debit card")
  ) {
    return "cards";
  }
  if (
    Number(tx.amount) > 0 ||
    desc.includes("depósito") ||
    desc.includes("deposito") ||
    desc.includes("deposit") ||
    desc.includes("crédito") ||
    desc.includes("credito") ||
    desc.includes("aporte")
  ) {
    return "deposits";
  }
  return "other";
}

function matchPeriod(txDate: Date, period: PeriodType, customStart: string, customEnd: string): boolean {
  if (period === "all") return true;
  const now = new Date();
  const txTime = txDate.getTime();
  if (period === "7d") {
    const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    return txTime >= cutoff;
  }
  if (period === "15d") {
    const cutoff = now.getTime() - 15 * 24 * 60 * 60 * 1000;
    return txTime >= cutoff;
  }
  if (period === "30d") {
    const cutoff = now.getTime() - 30 * 24 * 60 * 60 * 1000;
    return txTime >= cutoff;
  }
  if (period === "90d") {
    const cutoff = now.getTime() - 90 * 24 * 60 * 60 * 1000;
    return txTime >= cutoff;
  }
  if (period === "custom") {
    if (customStart && txTime < new Date(customStart + "T00:00:00").getTime()) return false;
    if (customEnd) {
      const end = new Date(customEnd + "T23:59:59.999");
      if (txTime > end.getTime()) return false;
    }
    return true;
  }
  return true;
}

function ExtratoPage() {
  const { t, lang } = useI18n();
  const searchParams = Route.useSearch();
  const [activeTab, setActiveTab] = useState<"statement" | "receipts">(
    searchParams.tab === "receipts" ? "receipts" : "statement"
  );

  // Search & Filters state
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodType>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [category, setCategory] = useState<CategoryType>("all");
  const [txType, setTxType] = useState<TxDirectionType>("all");

  // Selection state
  const [selectedTx, setSelectedTx] = useState<Tx | null>(null);
  const [copiedTxId, setCopiedTxId] = useState(false);

  // Popover open states
  const [periodOpen, setPeriodOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const { txs, loading: txsLoading, isError: txsError, refetch: refetchTxs } = useTransactions();

  const fetchTransfersFn = useServerFn(listMyTransfers);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    if (activeTab === "receipts") {
      let cancelled = false;
      setTransfersLoading(true);
      fetchTransfersFn()
        .then((res) => {
          if (!cancelled) {
            setTransfers(res.transfers ?? []);
            setTransfersLoading(false);
          }
        })
        .catch((err) => {
          console.error("Failed to load customer transfers", err);
          if (!cancelled) setTransfersLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [activeTab, fetchTransfersFn]);

  const copyProtocol = (protocol: string) => {
    navigator.clipboard.writeText(protocol);
    setCopiedId(protocol);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyTxId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedTxId(true);
    setTimeout(() => setCopiedTxId(false), 2000);
  };

  const clearFilters = () => {
    setQ("");
    setPeriod("all");
    setCustomStart("");
    setCustomEnd("");
    setCategory("all");
    setTxType("all");
  };

  const hasActiveFilters =
    q.trim() !== "" ||
    period !== "all" ||
    category !== "all" ||
    txType !== "all" ||
    customStart !== "" ||
    customEnd !== "";

  // 1. Transactions strictly accounted in the selected period (complete ledger for period)
  const periodTxs = useMemo(() => {
    return txs.filter((tx) => {
      const txDate = new Date(tx.created_at);
      return matchPeriod(txDate, period, customStart, customEnd);
    });
  }, [txs, period, customStart, customEnd]);

  // Whether secondary filters (text query, category, or type/direction) are active
  const hasSubFilters = Boolean(q.trim() || category !== "all" || txType !== "all");

  // 2. Further filtered transactions for screen display / filtered reports
  const filteredTxs = useMemo(() => {
    return periodTxs.filter((tx) => {
      // A. Text search
      if (q.trim()) {
        const term = q.toLowerCase();
        const matchesText =
          (tx.description ?? "").toLowerCase().includes(term) ||
          tx.type.toLowerCase().includes(term) ||
          tx.id.toLowerCase().includes(term);
        if (!matchesText) return false;
      }

      // B. Category
      if (category !== "all") {
        const cat = classifyCategory(tx);
        if (cat !== category) return false;
      }

      // C. Direction/Type
      if (txType !== "all") {
        const signedAmt = getTxSignedAmount(tx);
        if (txType === "in" && signedAmt < 0) return false;
        if (txType === "out" && signedAmt >= 0) return false;
      }

      return true;
    });
  }, [periodTxs, q, category, txType]);

  // Summary for currently filtered on-screen view
  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of filteredTxs) {
      const signedAmt = getTxSignedAmount(tx);
      if (signedAmt >= 0) inflow += signedAmt;
      else outflow += Math.abs(signedAmt);
    }
    return { inflow, outflow, count: filteredTxs.length };
  }, [filteredTxs]);

  // Complete period summary (independent of sub-filters)
  const periodSummary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    for (const tx of periodTxs) {
      const signedAmt = getTxSignedAmount(tx);
      if (signedAmt >= 0) inflow += signedAmt;
      else outflow += Math.abs(signedAmt);
    }
    return { inflow, outflow, count: periodTxs.length };
  }, [periodTxs]);

  // Filtered receipts
  const filteredTransfers = useMemo(() => {
    return transfers.filter((tr) => {
      if (!q.trim()) return true;
      const term = q.toLowerCase();
      return (
        tr.beneficiary_name.toLowerCase().includes(term) ||
        tr.bank_name.toLowerCase().includes(term) ||
        (tr.protocol ?? "").toLowerCase().includes(term) ||
        tr.reference.toLowerCase().includes(term) ||
        tr.to_country.toLowerCase().includes(term)
      );
    });
  }, [transfers, q]);

  const statusMap: Record<
    TransferStatus,
    { label: string; cls: string; icon: React.ComponentType<{ className?: string }> }
  > = {
    solicitado: { label: "Requested", cls: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: Clock },
    aprovado: { label: "Approved", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
    recusado: { label: "Rejected", cls: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle },
    bloqueado: { label: "Blocked", cls: "bg-rose-700/20 text-rose-700 border-rose-700/30", icon: ShieldAlert },
  };

  const periodLabelMap: Record<PeriodType, string> = {
    all: lang === "pt" ? "Todo o período" : "All time",
    "7d": lang === "pt" ? "Últimos 7 dias" : "Last 7 days",
    "15d": lang === "pt" ? "Últimos 15 dias" : "Last 15 days",
    "30d": lang === "pt" ? "Últimos 30 dias" : "Last 30 days",
    "90d": lang === "pt" ? "Últimos 90 dias" : "Last 90 days",
    custom: lang === "pt" ? "Personalizado" : "Custom range",
  };

  const categoryLabelMap: Record<CategoryType, string> = {
    all: lang === "pt" ? "Todas as categorias" : "All categories",
    transfers: lang === "pt" ? "Transferências" : "Transfers",
    deposits: lang === "pt" ? "Depósitos & Créditos" : "Deposits & Credits",
    fx: lang === "pt" ? "Câmbio & Internacional" : "FX & International",
    fees: lang === "pt" ? "Tarifas & Encargos" : "Fees & Charges",
    cards: lang === "pt" ? "Cartões & Compras" : "Cards & Shopping",
    other: lang === "pt" ? "Outras operações" : "Other transactions",
  };

  const typeLabelMap: Record<TxDirectionType, string> = {
    all: lang === "pt" ? "Todos os tipos" : "All types",
    in: lang === "pt" ? "Entradas (+)" : "Incoming (+)",
    out: lang === "pt" ? "Saídas (-)" : "Outgoing (-)",
  };

function calculatePeriodBalances(
  txs: Tx[],
  currentBalance: number,
  period: PeriodType,
  customEnd: string,
  periodTxs: Tx[]
): { openingBalance: number | null; closingBalance: number | null } {
  if (txs.length === 0) {
    return { openingBalance: null, closingBalance: currentBalance };
  }

  let periodEndTimestamp = Date.now();
  let isHistoricalPeriodEnd = false;
  if (period === "custom" && customEnd) {
    const d = new Date(customEnd);
    d.setHours(23, 59, 59, 999);
    periodEndTimestamp = d.getTime();
    if (periodEndTimestamp < Date.now()) {
      isHistoricalPeriodEnd = true;
    }
  }

  let calculatedClosing = currentBalance;
  if (isHistoricalPeriodEnd) {
    for (const t of txs) {
      const tTime = new Date(t.created_at).getTime();
      if (tTime > periodEndTimestamp) {
        calculatedClosing -= getTxSignedAmount(t);
      }
    }
  }

  let netPeriodMovement = 0;
  for (const t of periodTxs) {
    netPeriodMovement += getTxSignedAmount(t);
  }

  const calculatedOpening = calculatedClosing - netPeriodMovement;
  return { openingBalance: calculatedOpening, closingBalance: calculatedClosing };
}

  return (
    <AccountShell>
      {({ mask, currency, balance, profile, user, accountNumber, iban, balanceUnavailable, refetchAccount }) => {
        // Compute verifiable historical starting and ending balances for the period (no hooks in render prop)
        const currentBal = balance !== null ? balance : 0;
        const { openingBalance, closingBalance } = calculatePeriodBalances(
          txs,
          currentBal,
          period,
          customEnd,
          periodTxs
        );

        const handleDownloadPdf = async (forceFullStatement: boolean = false) => {
          try {
            setDownloadingPdf(true);
            const { downloadStatementPdf } = await import("@/lib/pdf-statement");
            const { sortCode, accountNumber: parsedAccNo, prettyIban, iban: parsedIban } = parseUkAccountCredentials(accountNumber, iban);
            const accountHolder = profile?.full_name || (profile as any)?.company_name || user?.user_metadata?.full_name || user?.email || "Valued Customer";

            let periodText = periodLabelMap[period];
            if (period === "custom" && (customStart || customEnd)) {
              periodText = `${customStart || "Start"} to ${customEnd || "End"}`;
            }

            const isFilteredExport = !forceFullStatement && hasSubFilters;
            const targetTxs = isFilteredExport ? filteredTxs : periodTxs;
            const targetSummary = isFilteredExport ? summary : periodSummary;

            let filterNotes = "";
            if (isFilteredExport) {
              const notes: string[] = [];
              if (q.trim()) notes.push(`Search: "${q.trim()}"`);
              if (category !== "all") notes.push(`Category: ${categoryLabelMap[category]}`);
              if (txType !== "all") notes.push(`Direction: ${typeLabelMap[txType]}`);
              filterNotes = notes.join(" · ");
            }

            const statementData: StatementData = {
              accountHolder,
              sortCode,
              accountNumber: parsedAccNo,
              iban: prettyIban || parsedIban,
              currency: currency || "GBP",
              periodLabel: periodText,
              lang: lang || "pt",
              documentSubtitle: filterNotes || undefined,
              isFiltered: isFilteredExport,
              currentBalance: balance ?? 0,
              openingBalance: isFilteredExport ? null : openingBalance,
              closingBalance: isFilteredExport ? null : closingBalance,
              totalInflow: targetSummary.inflow,
              totalOutflow: targetSummary.outflow,
              generatedAt: new Date().toLocaleString(lang === "pt" ? "pt-BR" : "en-GB", { dateStyle: "short", timeStyle: "short" }),
              transactions: targetTxs.map((t) => {
                const d = new Date(t.created_at);
                const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString("en-GB") : String(t.created_at).slice(0, 10);
                const timeStr = !isNaN(d.getTime()) ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
                const signedAmt = getTxSignedAmount(t);
                return {
                  date: dateStr,
                  time: timeStr,
                  description: t.description || t.type || "Transaction",
                  type: t.type || "Transfer",
                  amount: signedAmt,
                };
              }),
            };

            const prefix = isFilteredExport ? "bbank-filtered-report" : "bbank-statement";
            const fileName = `${prefix}-${parsedAccNo}-${new Date().toISOString().slice(0, 10)}.pdf`;
            downloadStatementPdf(statementData, fileName);
          } catch (err) {
            console.error("Failed to generate statement PDF", err);
          } finally {
            setTimeout(() => setDownloadingPdf(false), 600);
          }
        };

        return (
          <div className="mx-auto max-w-7xl px-6 py-6">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 select-none">
              <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.home")}</Link>
              <ChevronRight className="w-4 h-4" />
              <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.digital")}</Link>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground font-medium">
                {activeTab === "receipts"
                  ? (lang === "pt" ? "Comprovantes" : lang === "es" ? "Comprobantes" : "Receipts")
                  : t("conta.extract")}
              </span>
            </nav>

            <section className="bg-background border border-border/60 rounded-2xl shadow-sm overflow-hidden">
              {/* Header Title + Tabs */}
              <div className="px-7 pt-7 pb-4 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight select-none">
                    {activeTab === "receipts"
                      ? (lang === "pt" ? "Comprovantes de Transferências" : lang === "es" ? "Comprobantes de Transferencias" : "Transfer Receipts")
                      : t("conta.extract")}
                  </h1>
                  <p className="text-sm text-muted-foreground mt-1 select-none">
                    {activeTab === "receipts"
                      ? (lang === "pt" ? "Consulte e imprima os comprovantes oficiais das suas remessas." : "View and print official receipts for your transfers.")
                      : (lang === "pt" ? "Histórico detalhado de transações e movimentações da sua conta B Bank." : "Detailed transaction history and account movements.")}
                  </p>
                </div>

                {/* Actions & Tab Switcher */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Download Action Buttons */}
                  {activeTab === "statement" && !hasSubFilters && (
                    <button
                      type="button"
                      onClick={() => handleDownloadPdf(false)}
                      disabled={downloadingPdf || txsLoading}
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shadow-xs transition cursor-pointer select-none disabled:opacity-50"
                      title={lang === "pt" ? "Baixar extrato da conta em PDF" : "Download statement as PDF"}
                    >
                      <FileDown className="w-4 h-4" />
                      <span>
                        {downloadingPdf
                          ? (lang === "pt" ? "Gerando PDF…" : "Generating…")
                          : (lang === "pt" ? "Baixar PDF" : "Download PDF")}
                      </span>
                    </button>
                  )}

                  {activeTab === "statement" && hasSubFilters && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(false)}
                        disabled={downloadingPdf || txsLoading}
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shadow-xs transition cursor-pointer select-none disabled:opacity-50"
                        title={lang === "pt" ? "Baixar relatório das transações filtradas em PDF" : "Download filtered transactions report as PDF"}
                      >
                        <FileDown className="w-4 h-4" />
                        <span>
                          {downloadingPdf
                            ? (lang === "pt" ? "Gerando PDF…" : "Generating…")
                            : (lang === "pt" ? "Baixar Relatório Filtrado (PDF)" : "Download Filtered Report (PDF)")}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadPdf(true)}
                        disabled={downloadingPdf || txsLoading}
                        className="inline-flex items-center gap-2 h-10 px-3.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer select-none disabled:opacity-50"
                        title={lang === "pt" ? "Baixar extrato completo de todo o período, ignorando filtros de busca" : "Download complete statement for period"}
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{lang === "pt" ? "Extrato Completo (PDF)" : "Full Statement (PDF)"}</span>
                      </button>
                    </>
                  )}

                  {/* Tab Switcher */}
                  <div className="flex items-center gap-1 bg-secondary/80 p-1.5 rounded-full border border-border select-none">
                    <button
                      type="button"
                      onClick={() => setActiveTab("statement")}
                      className={`px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer select-none ${
                        activeTab === "statement"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {lang === "pt" ? "Extrato da conta" : lang === "es" ? "Extracto" : "Bank statement"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("receipts")}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition cursor-pointer select-none ${
                        activeTab === "receipts"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{lang === "pt" ? "Comprovantes" : lang === "es" ? "Comprobantes" : "Receipts"}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Statement Overview Metrics */}
              {activeTab === "statement" && (
                <div className="px-7 py-3 bg-secondary/20 border-y border-border/60 grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs select-none">
                  <div className="p-3 rounded-xl bg-background border border-border/50">
                    <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">
                      {lang === "pt" ? "Saldo Atual" : "Current Balance"}
                    </span>
                    <span className="text-base font-bold text-foreground mt-0.5 block tabular-nums">
                      {balanceUnavailable ? (
                        <span className="text-amber-600 font-medium text-xs">
                          {lang === "pt" ? "Saldo indisponível" : "Balance unavailable"}
                        </span>
                      ) : (
                        mask(formatMoney(balance, currency))
                      )}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border/50">
                    <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1">
                      <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                      {lang === "pt" ? "Entradas no período" : "Total Inflow"}
                    </span>
                    <span className="text-base font-bold text-emerald-600 mt-0.5 block tabular-nums">
                      {mask(formatMoney(summary.inflow, currency))}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border/50">
                    <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1">
                      <ArrowUpRight className="w-3 h-3 text-foreground" />
                      {lang === "pt" ? "Saídas no período" : "Total Outflow"}
                    </span>
                    <span className="text-base font-bold text-foreground mt-0.5 block tabular-nums">
                      {mask("-" + formatMoney(summary.outflow, currency))}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-background border border-border/50 flex flex-col justify-between">
                    <span className="text-muted-foreground block text-[11px] uppercase tracking-wider font-semibold">
                      {lang === "pt" ? "Transações filtradas" : "Filtered records"}
                    </span>
                    <span className="text-base font-bold text-foreground mt-0.5 block tabular-nums">
                      {summary.count} {lang === "pt" ? "registros" : "items"}
                    </span>
                  </div>
                </div>
              )}

              {/* Filters & Search Controls */}
              <div className="px-7 py-4 flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={
                      activeTab === "receipts"
                        ? (lang === "pt" ? "Buscar por beneficiário, banco ou protocolo…" : "Search by beneficiary, bank or protocol…")
                        : (lang === "pt" ? "Buscar por descrição, tipo ou protocolo…" : "Search statement by description, type or ID…")
                    }
                    className="w-full h-11 pl-11 pr-4 rounded-full border border-border bg-secondary/40 text-xs sm:text-sm outline-none focus:bg-background focus:border-primary transition"
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {activeTab === "statement" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* 1. Period Popover */}
                    <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`h-11 px-4 rounded-full border text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer select-none ${
                            period !== "all"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-secondary text-foreground"
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{period === "all" ? t("extrato.filter.period") : periodLabelMap[period]}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-72 p-3 bg-popover border border-border shadow-xl rounded-2xl">
                        <div className="space-y-1 select-none">
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">
                            {lang === "pt" ? "Filtrar por período" : "Select period"}
                          </p>
                          {(["all", "7d", "15d", "30d", "90d", "custom"] as PeriodType[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => {
                                setPeriod(p);
                                if (p !== "custom") setPeriodOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                                period === p ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-foreground"
                              }`}
                            >
                              <span>{periodLabelMap[p]}</span>
                              {period === p && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                          {period === "custom" && (
                            <div className="pt-2 border-t border-border/60 mt-2 space-y-2">
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-1 font-semibold uppercase">
                                  {lang === "pt" ? "Data inicial" : "Start date"}
                                </label>
                                <input
                                  type="date"
                                  value={customStart}
                                  onChange={(e) => setCustomStart(e.target.value)}
                                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-muted-foreground block mb-1 font-semibold uppercase">
                                  {lang === "pt" ? "Data final" : "End date"}
                                </label>
                                <input
                                  type="date"
                                  value={customEnd}
                                  onChange={(e) => setCustomEnd(e.target.value)}
                                  className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => setPeriodOpen(false)}
                                className="w-full mt-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
                              >
                                {lang === "pt" ? "Aplicar período" : "Apply dates"}
                              </button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* 2. Categories Popover */}
                    <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`h-11 px-4 rounded-full border text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer select-none ${
                            category !== "all"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-secondary text-foreground"
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" />
                          <span>{category === "all" ? t("extrato.filter.categories") : categoryLabelMap[category]}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-64 p-3 bg-popover border border-border shadow-xl rounded-2xl">
                        <div className="space-y-1 select-none">
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">
                            {lang === "pt" ? "Filtrar por categoria" : "Select category"}
                          </p>
                          {(["all", "transfers", "deposits", "fx", "fees", "cards", "other"] as CategoryType[]).map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setCategory(c);
                                setCategoryOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                                category === c ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-foreground"
                              }`}
                            >
                              <span>{categoryLabelMap[c]}</span>
                              {category === c && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* 3. Types Popover */}
                    <Popover open={typeOpen} onOpenChange={setTypeOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={`h-11 px-4 rounded-full border text-xs sm:text-sm font-medium flex items-center gap-2 transition cursor-pointer select-none ${
                            txType !== "all"
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-secondary text-foreground"
                          }`}
                        >
                          <ListFilter className="w-3.5 h-3.5" />
                          <span>{txType === "all" ? t("extrato.filter.types") : typeLabelMap[txType]}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="end" className="w-56 p-3 bg-popover border border-border shadow-xl rounded-2xl">
                        <div className="space-y-1 select-none">
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">
                            {lang === "pt" ? "Direção do fluxo" : "Flow direction"}
                          </p>
                          {(["all", "in", "out"] as TxDirectionType[]).map((tp) => (
                            <button
                              key={tp}
                              type="button"
                              onClick={() => {
                                setTxType(tp);
                                setTypeOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                                txType === tp ? "bg-primary/10 text-primary font-semibold" : "hover:bg-secondary text-foreground"
                              }`}
                            >
                              <span>{typeLabelMap[tp]}</span>
                              {txType === tp && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>

                    {/* 4. Clear Filters Button */}
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="h-11 px-3.5 rounded-full border border-rose-300 dark:border-rose-900 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-rose-500/20 transition cursor-pointer select-none"
                        title={lang === "pt" ? "Limpar todos os filtros" : "Clear all filters"}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{lang === "pt" ? "Limpar filtros" : "Clear filters"}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Tab 1: Bank Statement */}
              {activeTab === "statement" && (
                <div className="px-7 pb-8 min-h-[340px]">
                  {txsLoading ? (
                    <div className="py-20 text-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs text-muted-foreground">{lang === "pt" ? "Carregando movimentações…" : "Loading transactions…"}</p>
                    </div>
                  ) : txsError ? (
                    <div className="text-center py-20 border-t border-border/60">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mx-auto mb-3">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <p className="text-base font-semibold text-foreground">
                        {lang === "pt" ? "Extrato temporariamente indisponível" : "Statement temporarily unavailable"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                        {lang === "pt" ? "Não foi possível carregar as movimentações da conta. Tente novamente." : "Could not load account transactions. Please try again."}
                      </p>
                      {refetchTxs && (
                        <div className="mt-5">
                          <button
                            type="button"
                            onClick={() => refetchTxs()}
                            className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition shadow-sm"
                          >
                            {lang === "pt" ? "Tentar novamente" : "Try again"}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : filteredTxs.length === 0 ? (
                    <div className="text-center py-20 border-t border-border/60">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3 text-muted-foreground select-none">
                        <Filter className="w-5 h-5" />
                      </div>
                      <p className="text-base font-semibold select-none">
                        {hasActiveFilters
                          ? (lang === "pt" ? "Nenhuma movimentação com os filtros aplicados" : "No transactions match current filters")
                          : (lang === "pt" ? "Nenhuma movimentação registrada" : "No transactions recorded yet")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto select-none">
                        {hasActiveFilters
                          ? (lang === "pt" ? "Tente remover os filtros ou buscar por outro termo para visualizar as operações da conta." : "Try resetting your filter parameters or search terms.")
                          : (lang === "pt" ? "Esta conta ainda não possui movimentações financeiras registradas." : "This account has not recorded any financial movements yet.")}
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2.5 flex-wrap">
                        {hasActiveFilters && (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="px-4 py-2 rounded-full bg-secondary text-foreground text-xs font-semibold cursor-pointer select-none hover:bg-secondary/80 transition border border-border"
                          >
                            {lang === "pt" ? "Redefinir filtros" : "Reset filters"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf()}
                          disabled={downloadingPdf || txsLoading}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold shadow-xs transition cursor-pointer select-none disabled:opacity-50"
                          title={lang === "pt" ? "Baixar extrato bancário em PDF" : "Download bank statement in PDF"}
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>
                            {downloadingPdf
                              ? (lang === "pt" ? "Gerando PDF…" : "Generating…")
                              : (lang === "pt" ? "Baixar extrato" : "Download statement")}
                          </span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 border-t border-border/60">
                      {filteredTxs.map((tx) => {
                        const signedAmt = getTxSignedAmount(tx);
                        const isIn = signedAmt >= 0;
                        const cat = classifyCategory(tx);
                        return (
                          <div
                            key={tx.id}
                            onClick={() => setSelectedTx(tx)}
                            className="flex items-center gap-4 py-4 hover:bg-secondary/40 transition cursor-pointer px-3 rounded-xl group transaction-record"
                          >
                            <span
                              className={`w-10 h-10 rounded-full flex items-center justify-center text-xs shrink-0 select-none transition ${
                                isIn ? "bg-emerald-500/15 text-emerald-600 group-hover:scale-105" : "bg-secondary text-foreground group-hover:scale-105"
                              }`}
                            >
                              {isIn ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition">
                                  {tx.type}
                                </p>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary border border-border/50 text-muted-foreground select-none">
                                  {categoryLabelMap[cat]}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground truncate mt-0.5 select-text">
                                {tx.description ?? "—"}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 select-none">
                                <span>{new Date(tx.created_at).toLocaleDateString("en-GB")}</span>
                                <span>·</span>
                                <span>{new Date(tx.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <p className={`text-sm sm:text-base font-semibold tabular-nums select-text ${isIn ? "text-emerald-600" : "text-foreground"}`}>
                                {mask((isIn ? "+" : "-") + formatMoney(Math.abs(signedAmt), currency))}
                              </p>
                              <span className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5 select-none opacity-0 group-hover:opacity-100 transition">
                                <span>{lang === "pt" ? "Ver detalhes" : "View details"}</span>
                                <ChevronRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Transfer Receipts */}
              {activeTab === "receipts" && (
                <div className="px-7 pb-8 min-h-[340px]">
                  {transfersLoading ? (
                    <div className="py-20 text-center">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-xs text-muted-foreground">{lang === "pt" ? "Carregando comprovantes…" : "Loading receipts…"}</p>
                    </div>
                  ) : filteredTransfers.length === 0 ? (
                    <div className="text-center py-20 border-t border-border/60">
                      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-3 text-muted-foreground select-none">
                        <FileText className="w-5 h-5" />
                      </div>
                      <p className="text-base font-semibold select-none">
                        {lang === "pt" ? "Nenhum comprovante encontrado" : "No transfer receipts found"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto select-none">
                        {lang === "pt"
                          ? "Você ainda não possui transferências internacionais com comprovantes gerados nesta conta."
                          : "You have not submitted any transfers with generated receipts yet."}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/40 border-t border-border/60">
                      {filteredTransfers.map((tr) => {
                        const st = statusMap[tr.status] ?? statusMap.solicitado;
                        const StatusIcon = st.icon;
                        return (
                          <div
                            key={tr.id}
                            className="py-4.5 flex items-center justify-between gap-4 flex-wrap hover:bg-secondary/30 transition px-3 rounded-xl transaction-record"
                          >
                            <div className="flex items-center gap-3.5 min-w-[240px]">
                              <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 select-none">
                                <Landmark className="w-5 h-5" />
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground select-text">{tr.beneficiary_name}</p>
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border select-none ${st.cls}`}>
                                    <StatusIcon className="w-3 h-3" />
                                    {st.label}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 select-text">
                                  {tr.bank_name} · {tr.to_country}
                                </p>
                                <div className="flex items-center gap-2 mt-1 select-none">
                                  <span className="text-[11px] font-mono text-muted-foreground select-text" data-copyable="true">
                                    Protocol: {tr.protocol || "Not available"}
                                  </span>
                                  {tr.protocol && (
                                    <button
                                      type="button"
                                      onClick={() => copyProtocol(tr.protocol!)}
                                      className="text-muted-foreground hover:text-foreground transition cursor-pointer"
                                      title="Copy protocol"
                                    >
                                      {copiedId === tr.protocol ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 ml-auto">
                              <div className="text-right">
                                <p className="text-sm font-semibold tabular-nums text-foreground select-text">
                                  {tr.currency_from} {tr.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-xs tabular-nums text-muted-foreground select-text">
                                  ≈ {tr.currency_to} {tr.converted_amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 select-none">
                                  {new Date(tr.created_at).toLocaleDateString("en-GB")}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => setSelectedReceiptId(tr.id)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition border border-border shrink-0 cursor-pointer select-none"
                              >
                                <FileText className="w-3.5 h-3.5 text-primary" />
                                <span>{lang === "pt" ? "Ver comprovante" : "View receipt"}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Transaction Detail Dialog */}
            <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
              <DialogContent className="max-w-md rounded-3xl p-6 bg-card border border-border shadow-2xl">
                {selectedTx && (
                  <div className="space-y-5">
                    <DialogHeader className="text-left space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-primary select-none">
                          B Bank S.A.
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full select-none">
                          <CheckCircle2 className="w-3 h-3" />
                          Settled
                        </span>
                      </div>
                      <DialogTitle className="text-xl font-bold tracking-tight text-foreground select-none">
                        {lang === "pt" ? "Detalhes da Movimentação" : "Transaction Details"}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-muted-foreground select-none">
                        {lang === "pt" ? "Registro auditado da conta corrente britânica." : "Official audited record from your UK current account."}
                      </DialogDescription>
                    </DialogHeader>

                    {/* Amount Banner */}
                    <div className="p-4 rounded-2xl bg-secondary/50 border border-border/60 text-center">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground block font-semibold select-none">
                        {Number(selectedTx.amount) >= 0 ? (lang === "pt" ? "Valor Creditado" : "Credited Amount") : (lang === "pt" ? "Valor Debitado" : "Debited Amount")}
                      </span>
                      <p className={`text-2xl font-bold tabular-nums mt-1 select-text ${Number(selectedTx.amount) >= 0 ? "text-emerald-600" : "text-foreground"}`}>
                        {formatMoney(Math.abs(Number(selectedTx.amount)), currency)}
                      </p>
                      <span className="inline-block mt-1 text-[11px] font-medium text-muted-foreground select-none">
                        {classifyCategory(selectedTx) === "fees"
                          ? (lang === "pt" ? "Tarifa / Encargo bancário" : "Bank fee / charge")
                          : classifyCategory(selectedTx) === "transfers"
                          ? (lang === "pt" ? "Transferência Faster Payments / SWIFT" : "Faster Payments / SWIFT Transfer")
                          : (lang === "pt" ? "Lançamento em conta corrente" : "Current account entry")}
                      </span>
                    </div>

                    {/* Detail Key-Values */}
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-2 border-b border-border/40">
                        <span className="text-muted-foreground select-none">{lang === "pt" ? "Descrição" : "Description"}</span>
                        <span className="font-semibold text-foreground text-right max-w-[240px] select-text">
                          {selectedTx.description || "—"}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/40">
                        <span className="text-muted-foreground select-none">{lang === "pt" ? "Data e Horário" : "Date & Time"}</span>
                        <span className="font-medium text-foreground select-text">
                          {new Date(selectedTx.created_at).toLocaleString("en-GB")}
                        </span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/40">
                        <span className="text-muted-foreground select-none">{lang === "pt" ? "Tipo do Lançamento" : "Type"}</span>
                        <span className="font-medium text-foreground select-text">{selectedTx.type}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-border/40 items-center">
                        <span className="text-muted-foreground select-none">{lang === "pt" ? "Identificador (ID)" : "Transaction ID"}</span>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground select-text">
                          <span>{selectedTx.id.slice(0, 8)}…{selectedTx.id.slice(-6)}</span>
                          <button
                            type="button"
                            onClick={() => copyTxId(selectedTx.id)}
                            className="p-1 hover:text-foreground text-muted-foreground transition cursor-pointer select-none"
                            title="Copy full UUID"
                          >
                            {copiedTxId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between py-2 items-center">
                        <span className="text-muted-foreground select-none">{lang === "pt" ? "Instituição" : "Institution"}</span>
                        <span className="font-medium text-foreground select-none">B Bank S.A.</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTx(null)}
                        className="w-full py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer select-none"
                      >
                        {lang === "pt" ? "Fechar detalhes" : "Close"}
                      </button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Official Transfer Receipt Modal */}
            <TransferReceiptModal
              open={!!selectedReceiptId}
              onClose={() => setSelectedReceiptId(null)}
              transferId={selectedReceiptId}
            />
          </div>
        );
      }}
    </AccountShell>
  );
}
