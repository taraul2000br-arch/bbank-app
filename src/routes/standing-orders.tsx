import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useTransition } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock, ShieldCheck, CheckCircle2, ArrowRight, ArrowLeftRight,
  HelpCircle, AlertCircle, RefreshCw, Plus, X, Trash2, Clock, Landmark,
  ChevronRight, Calendar, Info, Database, AlertTriangle
} from "lucide-react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { AccountShell } from "@/components/AccountShell";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/account";
import {
  listMyScheduledPayments,
  createScheduledPaymentDb,
  cancelScheduledPaymentDb,
  migrateLocalScheduledPaymentsDb,
} from "@/lib/standing-orders.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function StandingOrdersErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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

export const Route = createFileRoute("/standing-orders")({
  component: StandingOrdersRouteComponent,
  head: () => ({
    meta: [
      { title: "Standing Orders & Scheduled Payments — Secure Portal" },
      { name: "description", content: "Manage recurring standing orders, schedule future payments, and understand the UK Direct Debit Guarantee scheme." },
    ],
  }),
  errorComponent: StandingOrdersErrorComponent,
});

interface ScheduledPayment {
  id: string;
  beneficiaryName: string;
  sortCode: string;
  accountNumber: string;
  amount: number;
  scheduledDate: string;
  frequency: "one-off" | "monthly" | "weekly";
  reference: string;
  status: "active" | "cancelled";
  createdAt: string;
  isLocalDemo?: boolean;
}

function StandingOrdersRouteComponent() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) return null;

  if (user) {
    return <AuthenticatedStandingOrders user={user} />;
  }

  return <PublicStandingOrders />;
}

function AuthenticatedStandingOrders({ user }: { user: { id: string } }) {
  const { t, lang } = useI18n();
  const storageKey = `bbank_scheduled_payments_demo_${user.id}`;

  const fetchPaymentsFn = useServerFn(listMyScheduledPayments);
  const createPaymentFn = useServerFn(createScheduledPaymentDb);
  const cancelPaymentFn = useServerFn(cancelScheduledPaymentDb);
  const migratePaymentsFn = useServerFn(migrateLocalScheduledPaymentsDb);

  const [activeTab, setActiveTab] = useState<"my-schedules" | "guide">("my-schedules");
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<ScheduledPayment[]>([]);
  const [localItemsToMigrate, setLocalItemsToMigrate] = useState<ScheduledPayment[]>([]);
  const [migrating, setMigrating] = useState(false);

  const [newModalOpen, setNewModalOpen] = useState(false);
  const [beneficiaryName, setBeneficiaryName] = useState("");
  const [sortCode, setSortCode] = useState("10-80-00");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [frequency, setFrequency] = useState<"one-off" | "monthly" | "weekly">("monthly");
  const [reference, setReference] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load from Supabase or fallback to local storage
  const loadPayments = async () => {
    setLoading(true);
    try {
      const res = await fetchPaymentsFn();
      if (res.dbReady) {
        setDbReady(true);
        setPayments(
          res.payments.map((p) => ({
            id: p.id,
            beneficiaryName: p.beneficiary_name,
            sortCode: p.sort_code,
            accountNumber: p.account_number,
            amount: p.amount,
            scheduledDate: p.scheduled_date,
            frequency: p.frequency,
            reference: p.reference || "",
            status: p.status === "cancelled" ? "cancelled" : "active",
            createdAt: p.created_at,
            isLocalDemo: false,
          }))
        );

        // Check if there are local offline items awaiting migration
        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setLocalItemsToMigrate(parsed);
              }
            }
          } catch (e) {
            console.error("Local storage read error for migration", e);
          }
        }
      } else {
        // Table not yet created in Supabase: use local storage state
        setDbReady(false);
        let localList: ScheduledPayment[] = [];
        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem(storageKey);
            if (saved) localList = JSON.parse(saved);
          } catch (e) {
            console.error("Local storage read error", e);
          }
        }
        if (localList.length === 0) {
          localList = [
            {
              id: "SO-88412",
              beneficiaryName: "British Gas Residential",
              sortCode: "20-04-15",
              accountNumber: "40918234",
              amount: 85.5,
              scheduledDate: "2026-11-01",
              frequency: "monthly",
              reference: "GAS-BILL-OCT26",
              status: "active",
              createdAt: "2026-10-18T10:00:00.000Z",
              isLocalDemo: true,
            },
          ];
        }
        setPayments(localList);
      }
    } catch (err) {
      console.error("Failed to fetch scheduled payments", err);
      setDbReady(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [user.id]);

  // Persist local state only when dbReady === false
  useEffect(() => {
    if (dbReady === false && typeof window !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(payments));
      } catch (e) {
        console.error("Local storage save error", e);
      }
    }
  }, [payments, dbReady, storageKey]);

  const handleCancel = async (id: string) => {
    if (dbReady) {
      try {
        const res = await cancelPaymentFn({ data: { id } });
        if (res.ok) {
          setPayments((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: "cancelled" } : p))
          );
        }
      } catch (e) {
        console.error("Cancel failed", e);
      }
    } else {
      setPayments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: "cancelled" } : p))
      );
    }
  };

  const handleDelete = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const handleMigrateLocalItems = async () => {
    if (localItemsToMigrate.length === 0) return;
    setMigrating(true);
    try {
      const res = await migratePaymentsFn({
        data: {
          items: localItemsToMigrate.map((item) => ({
            beneficiaryName: item.beneficiaryName,
            sortCode: item.sortCode,
            accountNumber: item.accountNumber,
            amount: item.amount,
            scheduledDate: item.scheduledDate,
            frequency: item.frequency,
            reference: item.reference,
            status: item.status,
          })),
        },
      });
      if (res.ok) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(storageKey);
        }
        setLocalItemsToMigrate([]);
        await loadPayments();
      }
    } catch (err) {
      console.error("Migration failed", err);
    } finally {
      setMigrating(false);
    }
  };

  const handleDismissMigration = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
    setLocalItemsToMigrate([]);
  };

  const tomorrowStr = useMemoTomorrow();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!beneficiaryName.trim()) {
      setFormError(lang === "pt" ? "Informe o nome do favorecido." : "Please enter the beneficiary name.");
      return;
    }
    const parsedAmt = parseFloat(amount);
    if (!parsedAmt || parsedAmt <= 0) {
      setFormError(lang === "pt" ? "Informe um valor válido em GBP (£)." : "Please enter a valid GBP amount.");
      return;
    }
    if (!scheduledDate) {
      setFormError(lang === "pt" ? "Selecione uma data futura para o agendamento." : "Please select a future execution date.");
      return;
    }

    setSubmitting(true);

    if (dbReady) {
      try {
        const res = await createPaymentFn({
          data: {
            beneficiary_name: beneficiaryName.trim(),
            sort_code: sortCode.trim(),
            account_number: accountNumber.trim() || "88392019",
            amount: parsedAmt,
            scheduled_date: scheduledDate,
            frequency,
            reference: reference.trim() || "Standing Order",
          },
        });

        if (res.ok && res.payment) {
          const newPayment: ScheduledPayment = {
            id: res.payment.id,
            beneficiaryName: res.payment.beneficiary_name,
            sortCode: res.payment.sort_code,
            accountNumber: res.payment.account_number,
            amount: Number(res.payment.amount),
            scheduledDate: res.payment.scheduled_date,
            frequency: (res.payment.frequency as "one-off" | "monthly" | "weekly") || "monthly",
            reference: res.payment.reference || "",
            status: "active",
            createdAt: res.payment.created_at,
            isLocalDemo: false,
          };
          setPayments((prev) => [newPayment, ...prev]);
          setNewModalOpen(false);
          setBeneficiaryName("");
          setAmount("");
          setScheduledDate("");
          setReference("");
        } else {
          setFormError(res.error || (lang === "pt" ? "Erro ao salvar agendamento." : "Error saving scheduled payment."));
        }
      } catch (err: any) {
        setFormError(err?.message || (lang === "pt" ? "Erro de comunicação com o servidor." : "Server communication error."));
      } finally {
        setSubmitting(false);
      }
    } else {
      // Local offline fallback mode
      const newPayment: ScheduledPayment = {
        id: "SO-" + Math.floor(10000 + Math.random() * 90000),
        beneficiaryName: beneficiaryName.trim(),
        sortCode: sortCode.trim(),
        accountNumber: accountNumber.trim() || "88392019",
        amount: parsedAmt,
        scheduledDate,
        frequency,
        reference: reference.trim() || "Standing Order",
        status: "active",
        createdAt: new Date().toISOString(),
        isLocalDemo: true,
      };

      setPayments((prev) => [newPayment, ...prev]);
      setSubmitting(false);
      setNewModalOpen(false);
      setBeneficiaryName("");
      setAmount("");
      setScheduledDate("");
      setReference("");
    }
  };

  return (
    <AccountShell>
      {({ currency }) => (
        <div className="mx-auto max-w-7xl px-6 py-6">
          {/* Breadcrumbs */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 select-none">
            <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.home")}</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.digital")}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">
              {lang === "pt" ? "Pagamentos Agendados" : "Scheduled Payments"}
            </span>
          </nav>

          <section className="bg-background border border-border/60 rounded-2xl shadow-sm p-7 space-y-7">
            {/* Header + Tabs Switcher */}
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold tracking-tight select-none">
                  {lang === "pt" ? "Pagamentos Agendados & Standing Orders" : "Scheduled Payments & Standing Orders"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl select-none">
                  {lang === "pt"
                    ? "Gerencie cobranças automáticas, ordens permanentes de pagamento (Standing Orders) e agendamentos futuros para contas de consumo ou aluguel."
                    : "Manage automated recurring payments, standing orders, and schedule future transfers for rent, utility bills, or subscriptions."}
                </p>
              </div>

              <div className="flex items-center gap-2 select-none">
                <button
                  type="button"
                  onClick={() => setNewModalOpen(true)}
                  className="h-10 px-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-2 hover:opacity-90 transition cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>{lang === "pt" ? "Novo Agendamento" : "New Scheduled Payment"}</span>
                </button>
              </div>
            </div>

            {/* Toggle Tabs */}
            <div className="flex items-center gap-2 bg-secondary/60 p-1.5 rounded-full border border-border max-w-fit select-none">
              <button
                type="button"
                onClick={() => setActiveTab("my-schedules")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  activeTab === "my-schedules"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "pt" ? "Meus Agendamentos" : "My Scheduled Payments"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("guide")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                  activeTab === "guide"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {lang === "pt" ? "Guia & Direct Debit Guarantee" : "UK Standing Orders & Direct Debits Guide"}
              </button>
            </div>

            {activeTab === "my-schedules" ? (
              <div className="space-y-6">
                {/* Safe Execution Notice */}
                <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-start gap-3 text-xs leading-relaxed select-none">
                  <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground block">
                      {lang === "pt" ? "Programação Segura de Pagamentos" : "Secure Scheduled Execution"}
                    </span>
                    <span className="text-muted-foreground">
                      {lang === "pt"
                        ? "Os pagamentos agendados permanecem em custódia programada e NÃO são debitados antecipadamente do saldo da sua conta corrente. A liquidação ocorre pontualmente na data selecionada."
                        : "Scheduled payments remain queued and are NOT debited in advance from your available account balance. Funds are settled on the scheduled date."}
                    </span>
                  </div>
                </div>

                {/* Local Storage Migration Banner */}
                {dbReady && localItemsToMigrate.length > 0 && (
                  <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start justify-between gap-4 text-xs leading-relaxed select-none">
                    <div className="flex items-start gap-3">
                      <Database className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-foreground block">
                          {lang === "pt" ? "Migração de Agendamentos Locais" : "Import Local Schedules to Supabase"}
                        </span>
                        <p className="text-muted-foreground">
                          {lang === "pt"
                            ? `Detectamos ${localItemsToMigrate.length} agendamento(s) salvo(s) localmente no navegador. Deseja importá-los para a sua conta no Supabase?`
                            : `We detected ${localItemsToMigrate.length} scheduled payment(s) saved in this browser. Would you like to import them to your Supabase account?`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={migrating}
                        onClick={handleMigrateLocalItems}
                        className="px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 transition cursor-pointer shadow-sm text-xs"
                      >
                        {migrating
                          ? (lang === "pt" ? "Importando…" : "Importing…")
                          : (lang === "pt" ? "Salvar no Banco" : "Import to DB")}
                      </button>
                      <button
                        type="button"
                        onClick={handleDismissMigration}
                        className="px-3 py-1.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground font-medium transition cursor-pointer text-xs"
                      >
                        {lang === "pt" ? "Ignorar" : "Dismiss"}
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Scheduled Payments */}
                {loading ? (
                  <div className="py-12 text-center text-xs text-muted-foreground select-none">
                    {lang === "pt" ? "Carregando agendamentos…" : "Loading scheduled payments…"}
                  </div>
                ) : payments.length === 0 ? (
                  <div className="py-16 text-center border rounded-2xl border-dashed border-border/70 bg-secondary/10">
                    <CalendarClock className="w-10 h-10 text-muted-foreground mx-auto mb-2 select-none" />
                    <p className="text-sm font-semibold text-foreground select-none">
                      {lang === "pt" ? "Nenhum pagamento agendado" : "No scheduled payments"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto select-none">
                      {lang === "pt"
                        ? "Você ainda não possui ordens de pagamento futuro ou standing orders configuradas nesta conta."
                        : "You currently have no scheduled standing orders or recurring future payments set up on this account."}
                    </p>
                    <button
                      type="button"
                      onClick={() => setNewModalOpen(true)}
                      className="mt-4 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold cursor-pointer select-none"
                    >
                      {lang === "pt" ? "Criar meu primeiro agendamento" : "Create first scheduled payment"}
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 border border-border/60 rounded-2xl overflow-hidden">
                    {payments.map((p) => {
                      const isCancelled = p.status === "cancelled";
                      return (
                        <div
                          key={p.id}
                          className={`p-4.5 flex items-center justify-between gap-4 flex-wrap bg-card transition ${
                            isCancelled ? "opacity-60 bg-muted/20" : "hover:bg-secondary/20"
                          }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-[240px]">
                            <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 select-none">
                              <CalendarClock className="w-5 h-5" />
                            </span>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold text-foreground select-text">
                                  {p.beneficiaryName}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border select-none ${
                                    isCancelled
                                      ? "bg-rose-500/15 text-rose-600 border-rose-500/30"
                                      : "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                                  }`}
                                >
                                  {isCancelled ? (lang === "pt" ? "Cancelado" : "Cancelled") : (lang === "pt" ? "Agendado" : "Scheduled")}
                                </span>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground select-none">
                                  {p.frequency === "monthly" ? "Mensal" : p.frequency === "weekly" ? "Semanal" : "Único"}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground select-text">
                                Sort Code: {p.sortCode} · Acc: {p.accountNumber} · Ref: {p.reference}
                              </p>
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 select-none">
                                <Clock className="w-3 h-3 text-primary" />
                                <span>{lang === "pt" ? "Data de execução:" : "Execution date:"} <strong>{p.scheduledDate}</strong></span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 ml-auto">
                            <div className="text-right">
                              <p className="text-base font-bold tabular-nums text-foreground select-text">
                                {formatMoney(p.amount, currency)}
                              </p>
                              <span className="text-[10px] text-muted-foreground select-none">
                                ID: {p.id}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 select-none">
                              {!isCancelled ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancel(p.id)}
                                  className="px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-900 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition cursor-pointer"
                                >
                                  {lang === "pt" ? "Cancelar" : "Cancel"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(p.id)}
                                  className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-rose-600 transition cursor-pointer"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <StandingOrdersGuide />
            )}

            {/* New Scheduled Payment Modal */}
            <Dialog open={newModalOpen} onOpenChange={setNewModalOpen}>
              <DialogContent className="max-w-lg rounded-3xl p-6 bg-card border border-border shadow-2xl">
                <DialogHeader className="text-left space-y-1">
                  <div className="flex items-center gap-2 text-primary text-xs font-bold uppercase tracking-wider select-none">
                    <CalendarClock className="w-4 h-4" />
                    B Bank Scheduled Payments
                  </div>
                  <DialogTitle className="text-xl font-bold tracking-tight text-foreground select-none">
                    {lang === "pt" ? "Novo Agendamento Bancário" : "New Scheduled Payment"}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground select-none">
                    {lang === "pt"
                      ? "Configure uma ordem permanente ou transferência agendada em GBP."
                      : "Set up a UK standing order or scheduled transfer in GBP."}
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreate} className="space-y-4 pt-2">
                  {formError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs font-medium">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      {lang === "pt" ? "Nome do Favorecido / Organização *" : "Beneficiary / Organisation Name *"}
                    </label>
                    <input
                      type="text"
                      value={beneficiaryName}
                      onChange={(e) => setBeneficiaryName(e.target.value)}
                      placeholder="e.g. British Gas, London Council, Landlord"
                      className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none focus:bg-background focus:border-primary transition"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Sort Code
                      </label>
                      <input
                        type="text"
                        value={sortCode}
                        onChange={(e) => setSortCode(e.target.value)}
                        placeholder="10-80-00"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none font-mono focus:bg-background focus:border-primary transition"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        Account Number
                      </label>
                      <input
                        type="text"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="8 digits"
                        maxLength={8}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none font-mono focus:bg-background focus:border-primary transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        {lang === "pt" ? "Valor em GBP (£) *" : "Amount in GBP (£) *"}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs sm:text-sm outline-none font-semibold focus:bg-background focus:border-primary transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        {lang === "pt" ? "Data de Execução *" : "Scheduled Date *"}
                      </label>
                      <input
                        type="date"
                        min={tomorrowStr}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs outline-none focus:bg-background focus:border-primary transition"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        {lang === "pt" ? "Frequência" : "Frequency"}
                      </label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value as any)}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs outline-none focus:bg-background focus:border-primary transition"
                      >
                        <option value="monthly">{lang === "pt" ? "Mensal (Standing Order)" : "Monthly (Standing Order)"}</option>
                        <option value="weekly">{lang === "pt" ? "Semanal" : "Weekly"}</option>
                        <option value="one-off">{lang === "pt" ? "Pagamento Único Futuro" : "One-off Future Payment"}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground block mb-1">
                        {lang === "pt" ? "Referência / Identificador" : "Reference / Particulars"}
                      </label>
                      <input
                        type="text"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        placeholder="e.g. RENT-NOV26"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-secondary/30 text-xs outline-none focus:bg-background focus:border-primary transition"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-secondary/50 border border-border/50 text-[11px] text-muted-foreground select-none leading-relaxed">
                    {lang === "pt"
                      ? "Aviso: O valor não será debitado agora. O agendamento ficará registrado no sistema e será executado na data programada."
                      : "Notice: Funds will not be debited now. The payment instruction is registered and will settle automatically on the scheduled date."}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setNewModalOpen(false)}
                      className="flex-1 py-2.5 rounded-full border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer select-none"
                    >
                      {lang === "pt" ? "Cancelar" : "Dismiss"}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition cursor-pointer shadow-sm select-none"
                    >
                      {submitting
                        ? (lang === "pt" ? "Salvando…" : "Saving…")
                        : (lang === "pt" ? "Confirmar Agendamento" : "Confirm Schedule")}
                    </button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </section>
        </div>
      )}
    </AccountShell>
  );
}

function useMemoTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function StandingOrdersGuide() {
  const comparison = [
    {
      feature: "Who sets it up?",
      standingOrder: "You instruct your bank directly",
      directDebit: "The organisation or merchant with your permission",
    },
    {
      feature: "Payment Amount",
      standingOrder: "Fixed amount (e.g., monthly rent)",
      directDebit: "Can vary (e.g., utility bills, credit card minimums)",
    },
    {
      feature: "Payment Frequency",
      standingOrder: "Fixed recurring dates in GBP",
      directDebit: "Scheduled as agreed with the provider",
    },
    {
      feature: "Protection Scheme",
      standingOrder: "Standard UK Faster Payments rules",
      directDebit: "Protected by the statutory Direct Debit Guarantee",
    },
    {
      feature: "Cancellation",
      standingOrder: "Cancel anytime in the B Bank app",
      directDebit: "Cancel anytime in the B Bank app & notify merchant",
    },
  ];

  return (
    <div className="space-y-6 pt-2">
      {/* Direct Debit Guarantee Highlight */}
      <section className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 flex items-start gap-4">
        <ShieldCheck className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-1" />
        <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
          <h4 className="font-bold text-base text-foreground">The UK Direct Debit Guarantee</h4>
          <p>
            If an error is made in the payment of your Direct Debit by B Bank S.A. or the billing organisation, you are entitled to a full and immediate refund of the amount paid from your bank.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <div className="rounded-2xl border border-border/70 overflow-hidden bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left">
            <thead className="bg-secondary/50 text-foreground font-semibold border-b border-border/60">
              <tr>
                <th className="p-4 sm:p-5">Feature</th>
                <th className="p-4 sm:p-5 text-primary">Standing Order</th>
                <th className="p-4 sm:p-5 text-primary">Direct Debit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {comparison.map((row, i) => (
                <tr key={i} className="hover:bg-muted/30 transition">
                  <td className="p-4 sm:p-5 font-semibold text-foreground">{row.feature}</td>
                  <td className="p-4 sm:p-5 text-muted-foreground">{row.standingOrder}</td>
                  <td className="p-4 sm:p-5 text-muted-foreground">{row.directDebit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PublicStandingOrders() {
  return (
    <PublicPageShell
      title="Standing Orders & Direct Debits"
      subtitle="Take the hassle out of paying monthly rent, utility bills, and subscriptions. Manage all your recurring automated payments seamlessly from your B Bank Current Account."
      badge="Automated UK Payments"
      breadcrumb={[{ label: "Payments & Transfers", to: "/" }, { label: "Standing Orders & Direct Debits" }]}
    >
      <div className="max-w-5xl space-y-12">
        <StandingOrdersGuide />
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg font-bold text-foreground">Manage Existing Recurring Payments</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Log in to your B Bank account to view, amend, or cancel your scheduled standing orders and direct debits with zero fees.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/conta"
              className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Access My Scheduled Payments
            </Link>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
