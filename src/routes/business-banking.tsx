import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Briefcase, CheckCircle2, ArrowRight, ShieldCheck, Smartphone,
  BarChart, Users, Building2, Sparkles, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/business-banking")({
  component: BusinessBankingPage,
  head: () => ({
    meta: [
      { title: "Business Banking & Current Accounts — Secure Portal" },
      { name: "description", content: "Empower your UK business with a Secure Portal Business Current Account. 12 months free everyday banking, accounting software sync and 24/7 UK business support." },
    ],
  }),
});

function BusinessBankingPage() {
  const tiers = [
    {
      name: "Start-up & Sole Trader",
      turnover: "Turnover up to £100k",
      freeMonths: "12 Months Free Banking",
      features: [
        "12 months free everyday business banking for new businesses",
        "Standard UK Sort Code (e.g. 10-80-00) and dedicated Business Account Number",
        "Direct integration with Xero, QuickBooks and FreeAgent",
        "Contactless Visa Business debit card with customized employee limits",
        "Access to B Bank Digital Business Banking app",
      ],
      cta: "Register Digital Account to Enquire",
      popular: true,
    },
    {
      name: "Established Business",
      turnover: "Turnover £100k – £6.5M",
      freeMonths: "Simple Tariffs from £8.50/mo",
      features: [
        "Dedicated UK Business Relationship Manager support",
        "High-volume Bacs, CHAPS and Faster Payments",
        "Multi-user dual authorization for company payroll and disbursements",
        "Foreign currency accounts (USD, EUR, GBP) with preferential FX margins",
        "Access to business borrowing and asset finance facilities",
      ],
      cta: "Register Digital Account to Enquire",
      popular: false,
    },
  ];

  return (
    <PublicPageShell
      title="Business Banking in the UK"
      subtitle="From sole traders and high-growth start-ups to established enterprises. Trusted financial infrastructure to help your British business thrive."
      badge="UK Business Banking"
      breadcrumb={[{ label: "Business Banking", to: "/" }, { label: "Business Current Account" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Commercial Business Account Notice</h4>
            <p className="opacity-90">
              Commercial business accounts require Companies House verification, identity checks, and commercial underwriting in accordance with UK banking standards.
            </p>
          </div>
        </div>

        {/* Tiers Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={`p-8 rounded-3xl border flex flex-col justify-between transition ${
                tier.popular
                  ? "border-primary bg-primary/5 shadow-xl ring-1 ring-primary/20"
                  : "border-border/70 bg-card hover:border-primary/40 shadow-sm"
              }`}
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-primary">{tier.turnover}</span>
                <h3 className="text-2xl font-bold text-foreground mt-1">{tier.name}</h3>
                <div className="my-4 px-3.5 py-1.5 rounded-xl bg-background border border-border/60 text-xs font-bold text-emerald-600 dark:text-emerald-400 inline-block">
                  {tier.freeMonths}
                </div>

                <hr className="my-5 border-border/50" />

                <ul className="space-y-3.5">
                  {tier.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-8 mt-6 border-t border-border/40">
                <button
                  type="button"
                  onClick={openSignupModal}
                  className="w-full py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 shadow-sm"
                >
                  <span>{tier.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Business Integrations */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-6">
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Seamless UK Accounting Software Connections</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Connect your B Bank business account directly to leading bookkeeping platforms through secure Open Banking feeds. Reconcile transactions, manage VAT returns, and automate invoices effortlessly.
          </p>
          <div className="grid sm:grid-cols-3 gap-4 text-xs font-semibold text-foreground">
            <div className="p-4 rounded-xl bg-card border border-border text-center">Xero Automated Feed</div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">QuickBooks Direct Sync</div>
            <div className="p-4 rounded-xl bg-card border border-border text-center">FreeAgent Live Bank Feed</div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
