import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Crown, ShieldCheck, CheckCircle2, ArrowRight, Plane,
  Users, Sparkles, Building, Gem, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/premier")({
  component: PremierPage,
  head: () => ({
    meta: [
      { title: "Premier Banking Privileges — Secure Portal Wealth" },
      { name: "description", content: "Exclusive everyday banking, dedicated relationship management, airport lounge access and preferential lending rates with Secure Portal Premier Banking." },
    ],
  }),
});

function PremierPage() {
  const privileges = [
    {
      title: "Dedicated Premier Team",
      desc: "Direct access to our senior 24/7 UK-based Premier service centre, bypassing automated call queues.",
      icon: Users,
    },
    {
      title: "Worldwide Travel Insurance",
      desc: "Comprehensive multi-trip family travel insurance underwritten by Zurich, including winter sports cover.",
      icon: Plane,
    },
    {
      title: "Preferential Rates & Limits",
      desc: "Higher daily debit ATM withdrawal limits of £1,000 and exclusive discounts on residential mortgages.",
      icon: Gem,
    },
    {
      title: "Fee-Free International Payments",
      desc: "Send money worldwide in foreign currencies with zero transfer fees from mobile and online banking.",
      icon: ShieldCheck,
    },
  ];

  return (
    <PublicPageShell
      title="B Bank Premier Banking"
      subtitle="Refined banking designed for individuals with high net worth or complex financial requirements. Enjoy exclusive privileges, dedicated support, and enhanced lifestyle benefits."
      badge="B Bank Premier"
      breadcrumb={[{ label: "Cards & Rewards", to: "/" }, { label: "Premier Banking" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Privileges Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Premier Privileges & Criteria Notice</h4>
            <p className="opacity-90">
              Premier eligibility (£75,000+ income or £100,000+ investments) requires income verification and relationship assessment during account onboarding.
            </p>
          </div>
        </div>

        {/* Privileges Grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {privileges.map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="p-7 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-foreground">{p.title}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Eligibility Criteria */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-5">
          <div className="flex items-center gap-3">
            <Crown className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-bold text-foreground">Premier Eligibility Criteria</h3>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            To qualify for a fee-free B Bank Premier Current Account, you must satisfy at least one of the following criteria:
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border/60 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Criterion 1</span>
              <h4 className="font-bold text-sm text-foreground">£75,000+ Annual Gross Income</h4>
              <p className="text-xs text-muted-foreground">Paid directly into your B Bank Premier Current Account.</p>
            </div>
            <div className="p-5 rounded-2xl bg-card border border-border/60 space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Criterion 2</span>
              <h4 className="font-bold text-sm text-foreground">£100,000+ Savings or Investments</h4>
              <p className="text-xs text-muted-foreground">Held in qualifying savings accounts or investments with B Bank.</p>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={openSignupModal}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-sm"
            >
              Register Digital Account to Enquire
            </button>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
