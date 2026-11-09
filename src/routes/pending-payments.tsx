import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PublicPageShell } from "@/components/PublicPageShell";
import { getMyPendingPayments } from "@/lib/support.functions";
import { useAuth } from "@/lib/auth";
import { useAccount, formatMoney } from "@/lib/account";
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  RefreshCw,
  Send,
  Lock,
  FileText,
  HelpCircle,
  AlertTriangle,
} from "lucide-react";

function PendingPaymentsErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
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

export const Route = createFileRoute("/pending-payments")({
  component: PendingPaymentsPage,
  head: () => ({
    meta: [
      { title: "Pending Payments & Balances — Secure Portal" },
      {
        name: "description",
        content:
          "Monitor unsettled transactions, transfer approvals, standing orders, and pending payments in real time.",
      },
    ],
  }),
  errorComponent: PendingPaymentsErrorComponent,
});

function PendingPaymentsPage() {
  const { user } = useAuth();
  const { balance, currency, accountNumber } = useAccount();
  const fetchPendingFn = useServerFn(getMyPendingPayments);

  const [loading, setLoading] = useState(false);
  const [pendingData, setPendingData] = useState<{
    authenticated: boolean;
    items: any[];
    totalGBP: number;
  }>({
    authenticated: false,
    items: [],
    totalGBP: 0,
  });

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetchPendingFn();
      setPendingData(res);
    } catch (e) {
      console.error("Failed to load pending payments:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  return (
    <PublicPageShell
      title="Pending Payments & Outstandings"
      breadcrumb={[
        { label: "Home", to: "/" },
        { label: "Accounts & Transfers", to: "/transferencia" },
        { label: "Pending Payments" },
      ]}
    >
      <div className="space-y-8">
        {/* Intro Banner */}
        <div className="bg-gradient-to-r from-[#00395D] to-[#002238] rounded-xl p-8 text-white relative overflow-hidden shadow-lg border border-white/10">
          <div className="absolute right-0 top-0 w-80 h-full opacity-10 pointer-events-none flex items-center justify-center">
            <Clock className="w-64 h-64 text-white" />
          </div>
          <div className="relative z-10 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#00AEEF]/20 text-[#00AEEF] border border-[#00AEEF]/30 mb-4">
              <Clock className="w-3.5 h-3.5" />
              Real-time Settlement Queue
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
              Pending Payments & Outstandings
            </h2>
            <p className="text-gray-200 text-sm md:text-base leading-relaxed">
              Track your outgoing transfers awaiting administrative clearance,
              unsettled card authorisations, and scheduled disbursements across your
              B Bank sterling accounts.
            </p>
          </div>
        </div>

        {user ? (
          /* =========================================================================
             AUTHENTICATED VIEW
             ========================================================================= */
          <div className="space-y-8">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-sm font-medium">Total Pending Outflow</span>
                  <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-semibold tabular-nums text-gray-900">
                  {formatMoney(pendingData.totalGBP, "GBP")}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {pendingData.items.length}{" "}
                  {pendingData.items.length === 1 ? "operation" : "operations"} in
                  verification queue
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-sm font-medium">Available Sterling Balance</span>
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-semibold tabular-nums text-gray-900">
                  {formatMoney(balance, currency || "GBP")}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Account: {accountNumber || "UK Current Account"}
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between text-gray-500 mb-2">
                  <span className="text-sm font-medium">Security Clearances</span>
                  <div className="w-8 h-8 rounded-full bg-sky-50 text-[#00AEEF] flex items-center justify-center">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-[#00395D]">
                  Dual Authorization
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Under B Bank financial safeguards & AML protocols
                </p>
              </div>
            </div>

            {/* List Header & Controls */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Pending Transfers & Faster Payments
                  </h3>
                  <p className="text-sm text-gray-500">
                    Transactions awaiting administrative confirmation or settlement
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={loadData}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                  <Link
                    to="/transferencia"
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#00AEEF] hover:bg-[#0098d4] rounded-lg transition-colors shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    New Transfer
                  </Link>
                </div>
              </div>

              {/* Transactions Table */}
              {pendingData.items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-400 mx-auto flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h4 className="text-base font-semibold text-gray-800">
                    No Pending Outstandings
                  </h4>
                  <p className="text-sm text-gray-500 max-w-md mx-auto mt-1 mb-6">
                    You have no transfers, payment orders or scheduled debts awaiting
                    authorisation. All balances are fully cleared.
                  </p>
                  <Link
                    to="/transferencia"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#00AEEF] hover:underline"
                  >
                    Send money via Faster Payments <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Date & Reference</th>
                        <th className="px-6 py-3 font-semibold">Beneficiary</th>
                        <th className="px-6 py-3 font-semibold">Destination</th>
                        <th className="px-6 py-3 font-semibold">Status</th>
                        <th className="px-6 py-3 font-semibold text-right">Amount (GBP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingData.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">
                              {new Date(item.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                              Ref: {item.protocol || item.reference || item.id.slice(0, 8)}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-gray-800">
                              {item.beneficiary_name || "Beneficiary"}
                            </div>
                            {item.purpose && (
                              <div className="text-xs text-gray-500 italic">
                                {item.purpose}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                              {item.to_country || "United Kingdom"}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              Awaiting Approval
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-semibold tabular-nums text-gray-900">
                            {formatMoney(item.amount, item.currency_from || "GBP")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Additional Guidance Box */}
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-sky-100 text-[#00395D] rounded-lg mt-0.5">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#00395D]">
                    Need immediate assistance with an in-flight payment?
                  </h4>
                  <p className="text-xs text-sky-900 mt-1">
                    If an outgoing transaction is delayed past standard cut-off times,
                    you can review the audit logs in our Help Centre or raise a complaint
                    protocol directly with our customer desk.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/help"
                  className="px-4 py-2 text-xs font-bold text-[#00395D] bg-white border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors whitespace-nowrap"
                >
                  Help Centre
                </Link>
                <Link
                  to="/complaints"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#00395D] rounded-lg hover:bg-[#002842] transition-colors whitespace-nowrap"
                >
                  File Complaint
                </Link>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================================
             UNAUTHENTICATED / GUEST VIEW
             ========================================================================= */
          <div className="space-y-8">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-sky-50 text-[#00AEEF] mx-auto flex items-center justify-center mb-4">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Sign In to View Your Pending Payments
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-6">
                For security reasons, real-time pending transactions, debit authorizations,
                and open transfer balances require authenticated access to your B Bank
                UK digital account.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <a
                  href="/#login"
                  className="w-full sm:w-auto px-6 py-3 bg-[#00AEEF] hover:bg-[#0098d4] text-white font-semibold text-sm rounded-lg transition-colors shadow-md"
                >
                  Sign In to Online Banking
                </a>
                <Link
                  to="/contact"
                  className="w-full sm:w-auto px-6 py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-sm rounded-lg transition-colors"
                >
                  Contact Support Desk
                </Link>
              </div>
            </div>

            {/* Information Grid: How B Bank Handles Pending Payments */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-[#00AEEF] flex items-center justify-center mb-4">
                  <Clock className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">
                  Faster Payments Scheme
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Most UK domestic transfers clear in seconds. When transactions require
                  secondary security verification, they appear in your Pending Queue.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-[#00AEEF] flex items-center justify-center mb-4">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">
                  Debit Authorisations
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Card transactions are pre-authorised immediately and settled within
                  1-3 business days. Your available balance reflects these holds in real
                  time.
                </p>
              </div>

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-sky-50 text-[#00AEEF] flex items-center justify-center mb-4">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h4 className="font-bold text-gray-900 mb-2">
                  Fraud Detection Safeguards
                </h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Unusual transfers trigger automated compliance reviews. Our team
                  inspects high-value orders to safeguard funds against unauthorised
                  diversions.
                </p>
              </div>
            </div>

            {/* UK Regulatory Clearing & Settlement Context */}
            <div className="p-6 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-500 space-y-2">
              <p className="font-semibold text-gray-700">
                Clearing & Settlement Information:
              </p>
              <p>
                Domestic clearing operates under standard payment rails and internal compliance review procedures. Standard payments settle within minutes, while items held for compliance review may take up to 2 hours.
              </p>
            </div>
          </div>
        )}
      </div>
    </PublicPageShell>
  );
}
