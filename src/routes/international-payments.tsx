import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal, openLoginModal } from "@/components/SignupModal";
import {
  Globe, ArrowRight, ShieldCheck, CheckCircle2, Clock,
  Landmark, AlertCircle, RefreshCw
} from "lucide-react";

export const Route = createFileRoute("/international-payments")({
  component: InternationalPaymentsPage,
  head: () => ({
    meta: [
      { title: "International Payments & Transfers — Secure Portal" },
      { name: "description", content: "Send money from the UK to over 150 countries. Transparent exchange rates, SWIFT and SEPA payments in EUR, USD, PLN, and global currencies from your GBP (£) account." },
    ],
  }),
});

function InternationalPaymentsPage() {
  const [sendAmountGBP, setSendAmountGBP] = useState(1000);
  const [destCurrency, setDestCurrency] = useState<"EUR" | "USD" | "PLN">("EUR");

  const rates = {
    EUR: 1.185,
    USD: 1.295,
    PLN: 5.120,
  };

  const receivedAmount = (sendAmountGBP * rates[destCurrency]).toFixed(2);

  const formatGBP = (v: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(v);

  return (
    <PublicPageShell
      title="International Payments & Wire Transfers"
      subtitle="Send money securely from your B Bank Current Account to more than 150 countries worldwide. Fast settlement across SWIFT and SEPA networks."
      badge="Global Remittance"
      breadcrumb={[{ label: "Payments & Transfers", to: "/" }, { label: "International Payments" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Rates Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Illustrative Remittance Benchmark Notice</h4>
            <p className="opacity-90">
              The foreign exchange conversion rates shown below are <strong>illustrative benchmark rates</strong>. Real transfers executed within Online Banking generate authentic receipts and records in your statement.
            </p>
          </div>
        </div>

        {/* Interactive International Transfer Estimator */}
        <section className="p-8 rounded-3xl border border-primary/30 bg-primary/5 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Interactive International Transfer Estimator</h2>
              <p className="text-xs text-muted-foreground">Check illustrative indicative exchange rates from GBP (£)</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-2">
                  You send from GBP account: <span className="text-primary font-bold">{formatGBP(sendAmountGBP)}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={25000}
                  step={100}
                  value={sendAmountGBP}
                  onChange={(e) => setSendAmountGBP(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground/80 block mb-2">Destination Currency</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["EUR", "USD", "PLN"] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setDestCurrency(curr)}
                      className={`py-2.5 px-3 rounded-xl border text-center transition ${
                        destCurrency === curr
                          ? "border-primary bg-primary text-primary-foreground font-bold shadow-sm"
                          : "border-border bg-card text-foreground hover:border-primary/50 text-xs font-semibold"
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results Box */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="border-b border-border/50 pb-3">
                  <span className="text-xs text-muted-foreground block">Recipient Receives (Estimated)</span>
                  <span className="text-3xl font-black text-primary mt-1 block">
                    {receivedAmount} {destCurrency}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Indicative Rate:</span>
                    <span className="font-semibold text-foreground">1 GBP = {rates[destCurrency]} {destCurrency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transfer Fee:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">£0.00 (Online via app)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Estimated Delivery:</span>
                    <span className="font-semibold text-foreground">Same Day / Next Working Day</span>
                  </div>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-border/40">
                <Link
                  to="/transferencia"
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>Start Transfer in Online Banking</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Global Clearing Networks */}
        <section className="grid sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-2">
            <Clock className="w-7 h-7 text-primary mb-1" />
            <h4 className="font-bold text-base text-foreground">SEPA Euro Payments</h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Fast, standardized Euro payments to 36 European countries using IBAN with low cost and rapid clearing.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-2">
            <Landmark className="w-7 h-7 text-primary mb-1" />
            <h4 className="font-bold text-base text-foreground">SWIFT Wire Network</h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Global reach covering virtually every financial institution worldwide with full end-to-end SWIFT gpi tracking.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-2">
            <ShieldCheck className="w-7 h-7 text-primary mb-1" />
            <h4 className="font-bold text-base text-foreground">HMRC & Sanctions Compliance</h4>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Automated UK sanctions screening and statutory reporting to ensure full compliance with international anti-money laundering laws.
            </p>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
