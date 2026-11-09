import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronRight, Search, ShieldCheck, ShieldAlert, CheckCircle2,
  Lock, AlertTriangle, FileText, Landmark, Clock, Info, HelpCircle
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { AccountShell } from "@/components/AccountShell";
import { useProfile, useAccount, formatMoney } from "@/lib/account";

function BloqueioErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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

export const Route = createFileRoute("/bloqueio-judicial")({
  component: BloqueioPage,
  head: () => ({ meta: [{ title: "Account Restrictions & Legal Orders — Secure Portal" }] }),
  errorComponent: BloqueioErrorComponent,
});

export function BloqueioPage() {
  const { t, lang } = useI18n();
  const { profile, loading: profileLoading } = useProfile();
  const { balance, currency, loading: accountLoading } = useAccount();

  const [q, setQ] = useState("");

  const isBlocked = !!profile?.account_blocked;
  const isTransferLocked = !!profile?.transfer_locked;
  const hasAnyRestriction = isBlocked || isTransferLocked;

  // Audit records derived directly from real database state
  const restrictionsList = [];

  if (isBlocked) {
    restrictionsList.push({
      id: "REST-BLK-001",
      type: lang === "pt" ? "Bloqueio Total de Conta" : "Account Block",
      origin: "B Bank Compliance / Legal Oversight",
      appliedAt: profile?.account_blocked_at ? new Date(profile.account_blocked_at).toLocaleString("en-GB") : "Recent",
      amount: "Total Balance",
      status: lang === "pt" ? "Ativo" : "Active",
      severity: "high",
      impact: lang === "pt" ? "Acesso e movimentações de saída suspensos." : "Outbound transactions temporarily suspended.",
    });
  }

  if (isTransferLocked) {
    restrictionsList.push({
      id: "REST-LCK-002",
      type: lang === "pt" ? "Trava Preventiva de Transferências" : "Transfer Lock",
      origin: "Risk Monitoring & AML Protection",
      appliedAt: profile?.account_blocked_at ? new Date(profile.account_blocked_at).toLocaleString("en-GB") : "Active",
      amount: "Outgoing transfers",
      status: lang === "pt" ? "Ativo" : "Active",
      severity: "medium",
      impact: lang === "pt" ? "Transferências e remessas retidas para verificação de segurança." : "Transfers on hold pending verification.",
    });
  }

  const filteredRecords = restrictionsList.filter((r) => {
    if (!q.trim()) return true;
    const term = q.toLowerCase();
    return (
      r.id.toLowerCase().includes(term) ||
      r.type.toLowerCase().includes(term) ||
      r.origin.toLowerCase().includes(term)
    );
  });

  return (
    <AccountShell>
      {() => (
        <div className="mx-auto max-w-7xl px-6 py-6">
          {/* Breadcrumb Navigation */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6 select-none">
            <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.home")}</Link>
            <ChevronRight className="w-4 h-4" />
            <Link to="/conta" className="hover:text-primary transition">{t("conta.tab.digital")}</Link>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">
              {lang === "pt" ? "Restrições da Conta" : "Account Restrictions"}
            </span>
          </nav>

          <section className="bg-background border border-border/60 rounded-2xl shadow-sm p-7 space-y-8">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold tracking-tight select-none">
                  {lang === "pt" ? "Restrições da Conta & Ordens Judiciais" : "Account Restrictions & Legal Orders"}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl select-none">
                  {lang === "pt"
                    ? "Painel de transparência sobre ordens judiciais, bloqueios e travas operacionais aplicadas à sua conta sob as diretrizes de compliance vigentes."
                    : "Transparency panel regarding court orders, operational restrictions, and compliance holds applied to your account."}
                </p>
              </div>

              {/* Account Restriction Status Indicator */}
              <div className="p-4 rounded-2xl bg-secondary/40 border border-border/60 min-w-[200px] text-right select-none">
                <p className="text-xs font-semibold text-muted-foreground flex items-center justify-end gap-1.5 uppercase tracking-wider">
                  <span className={`w-2.5 h-2.5 rounded-full ${hasAnyRestriction ? "bg-rose-500 animate-pulse" : "bg-emerald-500"}`} />
                  {lang === "pt" ? "Status da Conta" : "Account Status"}
                </p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${hasAnyRestriction ? "text-rose-600" : "text-foreground"}`}>
                  {hasAnyRestriction ? (isBlocked ? (lang === "pt" ? "Bloqueada" : "Blocked") : (lang === "pt" ? "Trava Ativa" : "Locked")) : (lang === "pt" ? "Regular" : "Good Standing")}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {hasAnyRestriction
                    ? (lang === "pt" ? "Restrição operacional registrada no banco" : "Operational restriction active in DB")
                    : (lang === "pt" ? "Nenhuma restrição registrada" : "No restrictions recorded")}
                </p>
              </div>
            </div>

            {/* Status Reassurance or Alert Card */}
            {!hasAnyRestriction ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-4 select-none">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    {lang === "pt"
                      ? "Nenhuma restrição registrada nesta conta"
                      : "No restrictions recorded on this account"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {lang === "pt"
                      ? "Não há ordens judiciais, bloqueios cadastrais ou travas operacionais associadas a este titular no banco de dados. Os parâmetros de movimentação e acesso à conta encontram-se liberados."
                      : "There are no court orders, account blocks, or operational holds associated with this profile in the database. Account access and transfer parameters are currently in good standing."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-4 select-none">
                <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
                    {lang === "pt" ? "Aviso Importante: Restrição Operacional Aplicada" : "Important Notice: Active Operational Restriction"}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {lang === "pt"
                      ? "Identificamos uma restrição cadastral ativa na sua conta. Durante a vigência deste status, algumas operações financeiras de débito ou transferências externas podem ficar temporariamente retidas."
                      : "An active restriction has been placed on your account. During this period, certain outbound financial transactions or transfers may be temporarily placed on hold."}
                  </p>
                  <p className="text-xs font-semibold text-foreground pt-1">
                    {lang === "pt"
                      ? "Para esclarecimentos ou envio de documentação comprobatória, utilize o canal oficial de Suporte B Bank."
                      : "For clarification or to provide supporting documentation, please contact the B Bank Support desk."}
                  </p>
                </div>
              </div>
            )}

            {/* Real Database Verification Categories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
              <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {lang === "pt" ? "Acesso à Conta" : "Account Access"}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isBlocked ? "bg-rose-500/15 text-rose-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                    {isBlocked ? (lang === "pt" ? "Bloqueado" : "Blocked") : (lang === "pt" ? "Liberado" : "Clear")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "pt"
                    ? "Parâmetro geral de login e movimentação de conta corrente no sistema."
                    : "General login and account operation parameter in the system."}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {lang === "pt" ? "Trava de Transferências" : "Transfer Lock"}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isTransferLocked ? "bg-amber-500/15 text-amber-600" : "bg-emerald-500/15 text-emerald-600"}`}>
                    {isTransferLocked ? (lang === "pt" ? "Ativa" : "Active") : (lang === "pt" ? "Liberada" : "Clear")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "pt"
                    ? "Mecanismo preventivo de controle para transferências externas."
                    : "Preventive control parameter for outgoing transfers."}
                </p>
              </div>

              <div className="p-4 rounded-xl border border-border/70 bg-card space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {lang === "pt" ? "Ordens Judiciais Externas" : "External Court Liens"}
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                    {lang === "pt" ? "Sem Apontamento" : "No Record"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {lang === "pt"
                    ? "Registros de Third Party Debt Orders ou Freezing Injunctions no cadastro."
                    : "Third Party Debt Orders or Freezing Injunction records in database."}
                </p>
              </div>
            </div>

            {/* Search Filter for Records */}
            <div className="space-y-4 pt-4 border-t border-border/60">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder={lang === "pt" ? "Pesquisar registro ou protocolo…" : "Search restriction record or protocol…"}
                    className="w-full h-11 pl-10 pr-4 rounded-full border border-border bg-secondary/30 text-xs sm:text-sm outline-none focus:bg-background focus:border-primary transition"
                  />
                </div>
                <span className="text-xs text-muted-foreground select-none">
                  {filteredRecords.length} {lang === "pt" ? "registro(s) localizado(s)" : "record(s) found"}
                </span>
              </div>

              {/* Records Table or Empty State */}
              {filteredRecords.length === 0 ? (
                <div className="py-16 text-center border rounded-2xl border-dashed border-border/70 bg-secondary/10">
                  <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto mb-2 select-none" />
                  <p className="text-sm font-semibold text-foreground select-none">
                    {lang === "pt"
                      ? "Nenhuma restrição registrada nesta conta"
                      : "No restrictions recorded on this account"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto select-none">
                    {lang === "pt"
                      ? "Não foram encontrados apontamentos judiciais, bloqueios ou travas operacionais no banco de dados para esta conta."
                      : "No legal liens, court orders, or operational locks were found in the database for this account."}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 overflow-hidden divide-y divide-border/40">
                  {filteredRecords.map((item) => (
                    <div key={item.id} className="p-4 flex items-center justify-between gap-4 flex-wrap bg-card hover:bg-secondary/20 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-foreground select-text">{item.type}</span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 border border-rose-500/30 select-none">
                            {item.status}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground select-text">
                          {item.origin} · Protocol: <span className="font-mono">{item.id}</span>
                        </p>
                        <p className="text-xs text-muted-foreground select-none">{item.impact}</p>
                      </div>

                      <div className="text-right select-none">
                        <p className="text-xs font-semibold text-foreground">{item.amount}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{item.appliedAt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Explanatory Regulatory Footer Note */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 flex items-start gap-3 text-xs text-muted-foreground select-none">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {lang === "pt"
                  ? "As informações acima refletem os parâmetros cadastrais e operacionais registrados nos sistemas do B Bank. Em caso de dúvidas sobre apontamentos ou providências de regularização, contate a equipe de Compliance ou seu gerente."
                  : "The information above reflects account and compliance parameters recorded in B Bank operational systems. For queries regarding restrictions or resolution procedures, please contact B Bank Compliance or your Relationship Manager."}
              </p>
            </div>
          </section>
        </div>
      )}
    </AccountShell>
  );
}
