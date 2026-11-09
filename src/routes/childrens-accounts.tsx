import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPageShell } from "@/components/PublicPageShell";
import { openSignupModal } from "@/components/SignupModal";
import {
  Users, Shield, Smartphone, CreditCard, Sparkles, CheckCircle2,
  Lock, ArrowRight, HeartHandshake, AlertCircle
} from "lucide-react";

export const Route = createFileRoute("/childrens-accounts")({
  component: ChildrensAccountsPage,
  head: () => ({
    meta: [
      { title: "Children's & Young Person Accounts — Secure Portal" },
      { name: "description", content: "Empower the next generation with YoungSaver (11-15) and Young Person's Accounts (16-17) in GBP (£). Contactless debit card and parental safety controls." },
    ],
  }),
});

function ChildrensAccountsPage() {
  const accounts = [
    {
      name: "YoungSaver Account",
      ageRange: "Ages 11 – 15",
      headline: "First steps to independent money management",
      features: [
        "Free contactless Visa debit card with tailored spending limits",
        "No monthly account fees",
        "Parent or guardian view and control via B Bank app",
        "ATM daily cash withdrawal limit restricted to £50 for safety",
        "Blocked from adult merchant categories automatically",
        "Earn interest on every pound saved in GBP (£)",
      ],
      cta: "Open YoungSaver",
    },
    {
      name: "Young Person's Account",
      ageRange: "Ages 16 – 17",
      headline: "Freedom and tools to manage wages, college, or apprenticeships",
      features: [
        "Full contactless Visa debit card with Apple Pay & Google Pay",
        "Direct salary and apprentice stipend deposits via Bacs",
        "Mobile banking app with instant spending notifications",
        "No overdraft facility to ensure young people never fall into debt",
        "Standing orders and Faster Payments for bills & rent",
        "Free transition to adult B Bank Current Account at age 18",
      ],
      cta: "Open Young Person's Account",
    },
  ];

  return (
    <PublicPageShell
      title="Children's & Youth Accounts"
      subtitle="Safe, digital, and fee-free everyday banking designed specifically for young people in the UK. Build lasting financial confidence with parental peace of mind."
      badge="Youth & Family Banking"
      breadcrumb={[{ label: "Everyday Banking", to: "/" }, { label: "Children's Accounts" }]}
    >
      <div className="max-w-5xl space-y-12">
        {/* Information Notice */}
        <div className="p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5 text-sky-950 dark:text-sky-100 flex items-start gap-3.5">
          <AlertCircle className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm space-y-1 leading-relaxed">
            <h4 className="font-semibold text-sm">Youth & Family Banking Information Notice</h4>
            <p className="opacity-90">
              Children's and Young Person's accounts require parent/guardian identity verification and certified documentation in accordance with UK banking guidelines.
            </p>
          </div>
        </div>

        {/* Account Cards */}
        <div className="grid md:grid-cols-2 gap-8">
          {accounts.map((acc, idx) => (
            <div
              key={idx}
              className="p-8 rounded-3xl border border-border/70 bg-card hover:border-primary/40 transition flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-3">
                  {acc.ageRange}
                </div>
                <h3 className="text-2xl font-bold text-foreground">{acc.name}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {acc.headline}
                </p>

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
                  <span>{acc.cta}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Parental Security Safeguards */}
        <section className="p-8 rounded-3xl bg-secondary/30 border border-border/60 space-y-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <h3 className="text-lg font-bold text-foreground">Built with British Safety & Parental Controls</h3>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-background border border-border/40">
              <Lock className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-bold text-sm text-foreground">Zero Overdraft</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Young accounts cannot go overdrawn. Transactions are simply declined if funds are insufficient, preventing unexpected charges.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-background border border-border/40">
              <Smartphone className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-bold text-sm text-foreground">Instant Card Freeze</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Misplaced debit cards can be temporarily locked and unlocked instantly within the B Bank app by either the child or parent.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-background border border-border/40">
              <HeartHandshake className="w-5 h-5 text-primary mb-2" />
              <h4 className="font-bold text-sm text-foreground">Age-Appropriate Restrictions</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Automatic merchant category blocking ensures cards cannot be used for gambling, adult venues, or restricted services.
              </p>
            </div>
          </div>
        </section>
      </div>
    </PublicPageShell>
  );
}
