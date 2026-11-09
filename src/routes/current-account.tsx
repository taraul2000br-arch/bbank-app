import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal, openLoginModal } from "@/components/SignupModal";
import {
  Landmark, ShieldCheck, CreditCard, ArrowRight, CheckCircle2,
  Smartphone, Sparkles, AlertCircle, HelpCircle, ChevronRight
} from "lucide-react";

export const Route = createFileRoute("/current-account")({
  component: CurrentAccountPage,
  head: () => ({
    meta: [
      { title: "Current Accounts — Secure Portal" },
      { name: "description", content: "Explore Secure Portal everyday current accounts. No monthly account fees, contactless Visa debit, 24/7 mobile app and UK Sort Code & Account Number." },
    ],
  }),
});

function CurrentAccountPage() {
  const [selectedTier, setSelectedTier] = useState<"standard" | "premier">("standard");

  const accounts = [
    {
      id: "standard",
      name: "B Bank Account",
      monthlyFee: "£0.00",
      description: "Our core everyday digital current account with zero monthly fee and complete digital banking controls.",
      features: [
        "Free contactless Visa debit card in GBP (£)",
        "Standard UK Sort Code (e.g. 10-80-00) and unique 8-digit Account Number",
        "Free domestic Faster Payments and Direct Debits",
        "Mobile banking app with biometric authentication",
        "Optional arranged overdraft facility (subject to status)",
        "Industry-standard data security and dedicated multi-factor authentication",
      ],
      popular: true,
    },
    {
      id: "premier",
      name: "Premier Current Account",
      monthlyFee: "£0.00",
      description: "Exclusive everyday banking with enhanced benefits, high-tier transfer limits, and dedicated 24/7 UK support.",
      features: [
        "Black contactless Visa debit card with higher daily ATM limits",
        "Dedicated 24/7 Premier Relationship Support Team",
        "Fee-free international payments via mobile & online banking",
        "Eligibility: £75,000+ gross annual income paid in, or £100,000+ in UK savings/investments",
        "Exclusive mortgage and loan preferential rates",
        "Access to B Bank Rewards and cashback benefits",
      ],
      popular: false,
    },
  ];

  return (
    <PublicPageShell
      title="Everyday Current Accounts"
      subtitle="Manage your money with complete confidence. Free UK everyday banking with standard Sort Code, contactless debit card, and 24/7 mobile management."
      badge="UK Everyday Banking"
      breadcrumb={[{ label: "Everyday Banking", to: "/" }, { label: "Current Account" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1">
            <h4 className="font-semibold text-sm">Online Banking Account Notice</h4>
            <p className="opacity-90 leading-relaxed">
              This platform provides B Bank personal current account services. Eligible applicants receive a dedicated Sort Code and Account Number with digital Faster Payments and standing orders.
            </p>
          </div>
        </div>

        {/* Account Tiers */}
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Choose your everyday account</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Whether you need everyday simplicity or premier features, our UK accounts provide seamless GBP banking.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className={`relative rounded-3xl p-8 border transition flex flex-col justify-between ${
                  acc.popular
                    ? "border-primary bg-primary/5 shadow-xl shadow-primary/5 ring-1 ring-primary/20"
                    : "border-border/70 bg-card hover:border-primary/40 shadow-sm"
                }`}
              >
                {acc.popular && (
                  <span className="absolute -top-3 left-8 px-3.5 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider">
                    Most Popular
                  </span>
                )}

                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground">{acc.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{acc.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">{acc.monthlyFee}</div>
                      <span className="text-[11px] text-muted-foreground">monthly fee</span>
                    </div>
                  </div>

                  <hr className="my-6 border-border/50" />

                  <ul className="space-y-3.5">
                    {acc.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-foreground/90">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
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
                    <span>Open Account Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Key Features */}
        <section className="grid sm:grid-cols-3 gap-5">
          <div className="p-6 rounded-2xl border border-border/60 bg-card">
            <Smartphone className="w-8 h-8 text-primary mb-3" />
            <h4 className="font-bold text-base text-foreground">Mobile & Online Banking</h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Control debit cards, freeze spending, check live balances in GBP (£), and make instant Faster Payments anytime.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border/60 bg-card">
            <CreditCard className="w-8 h-8 text-primary mb-3" />
            <h4 className="font-bold text-base text-foreground">Contactless Visa Debit</h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Pay with a tap up to £100 or use Apple Pay and Google Pay with zero foreign transaction markup on selected accounts.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-border/60 bg-card">
            <ShieldCheck className="w-8 h-8 text-primary mb-3" />
            <h4 className="font-bold text-base text-foreground">Confirmation of Payee</h4>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
              Automated UK name verification before sending money, protecting your funds from Authorized Push Payment (APP) scams.
            </p>
          </div>
        </section>

        {/* Open Account Service */}
        <section className="p-8 rounded-3xl bg-secondary/40 border border-border/60 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-lg font-bold text-foreground">Open your B Bank account today</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              Apply online in minutes with standard digital verification. Enjoy instantaneous sterling account features, digital transfers, and complete online card management.
            </p>
          </div>
          <button
            type="button"
            onClick={openSignupModal}
            className="px-6 py-3 rounded-full bg-foreground text-background text-sm font-semibold hover:opacity-90 transition shrink-0"
          >
            Open Account
          </button>
        </section>
      </div>
    </PublicPageShell>
  );
}
